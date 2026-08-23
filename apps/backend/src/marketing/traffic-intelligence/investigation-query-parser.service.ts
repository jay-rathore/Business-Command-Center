import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { InvestigationIntent } from '@hpl/shared';
import { toDateKey } from './analysis/period.util';

export interface ParsedInvestigationQuery {
  intent: InvestigationIntent;
  dateFrom: string;
  dateTo: string;
}

const PARSE_TOOL_NAME = 'resolve_investigation_query';
const VALID_INTENTS: InvestigationIntent[] = [
  'why_low',
  'why_high',
  'compare_periods',
  'recommend_campaign',
  'general',
];

// Each description below is deliberately specific with a positive AND a negative example — a
// bare one-line label per intent (the original version of this schema) let the model guess loosely
// and it defaulted to recommend_campaign/compare_periods far too often for plain investigation
// questions. See classifyIntent() below for the matching regex-fallback taxonomy, kept in sync.
const INTENT_DESCRIPTIONS: Record<InvestigationIntent, string> = {
  why_low:
    'The user is asking WHY traffic/visitors DROPPED or was LOW. Example: "why was traffic low yesterday", "why did visitors decrease compared to last week". This takes priority over compare_periods even when a comparison baseline like "compared to last week" or "vs last month" is named — naming a baseline is just how the drop is being measured, not a request for a neutral side-by-side comparison.',
  why_high:
    'The user is asking WHY traffic/visitors ROSE or SPIKED. Example: "why did traffic increase", "what caused the spike on 18 Aug", "why is traffic up vs last week". Same priority-over-compare_periods rule as why_low.',
  compare_periods:
    'The user wants a neutral side-by-side comparison of two named periods, WITHOUT asking "why" a change happened. Example: "compare this week to last week", "August vs July traffic numbers". If the question contains "why" plus a directional word (low/high/dropped/increased/decreased), it is why_low/why_high instead, never this — "why" always signals a root-cause question, not a plain comparison.',
  recommend_campaign:
    'The user is asking WHICH SPECIFIC CAMPAIGN to run, re-run, or scale up — i.e. asking for a campaign pick/ranking. Example: "which campaign should I re-run", "what campaign converts best". Do NOT use this for general "what should I do to improve traffic" questions with no request for a specific campaign name — that is why_high or general instead, answered with the recommendedAction field, not a campaign ranking.',
  general:
    'Anything else: "what happened on <date>", open-ended forward-looking advice ("what should I change to increase traffic next week"), or a factual question about a period that is not clearly a drop/spike/comparison/campaign-pick. This is the safe default — prefer it over guessing one of the other four.',
};

const PARSE_TOOL_SCHEMA = {
  type: 'function' as const,
  function: {
    name: PARSE_TOOL_NAME,
    description:
      'Resolve a free-text traffic question into a classified intent and a concrete absolute date range to investigate.',
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: VALID_INTENTS,
          description: VALID_INTENTS.map(
            (i) => `${i}: ${INTENT_DESCRIPTIONS[i]}`,
          ).join(' | '),
        },
        dateFrom: {
          type: 'string',
          description:
            'Absolute start date of the period to investigate, YYYY-MM-DD. If the question has no date/period reference at all, use yesterday.',
        },
        dateTo: {
          type: 'string',
          description:
            'Absolute end date of the period to investigate, YYYY-MM-DD. Same as dateFrom for a single-day question. For a forward-looking question ("next week"), there is no future data yet — use the most recent trailing period (last 7 days) instead so the answer is grounded in real data.',
        },
      },
      required: ['intent', 'dateFrom', 'dateTo'],
    },
  },
};

const DDMMYYYY = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;

/** Turns a free-text question ("Why was my website traffic so low on 15/08/2026?") into a
 * structured {intent, dateFrom, dateTo} that RootCauseEngineService can run against — mirrors
 * business-card-ai-parser.service.ts's forced-tool-call pattern. Falls back to a regex/keyword
 * parser (handles the spec's DD/MM/YYYY format plus "yesterday"/"last week") when OPENAI_API_KEY
 * is unset or the call fails, so the investigate endpoint still works without AI configured. */
@Injectable()
export class InvestigationQueryParserService {
  private readonly logger = new Logger(InvestigationQueryParserService.name);
  private client: OpenAI | undefined;

  constructor(private readonly config: ConfigService) {}

  async parse(
    question: string,
    now: Date = new Date(),
  ): Promise<ParsedInvestigationQuery> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return this.parseWithRegex(question, now);

    try {
      return await this.parseWithOpenAi(question, now, apiKey);
    } catch (err) {
      this.logger.warn(
        `OpenAI query parse failed, falling back to regex parser: ${err instanceof Error ? err.message : err}`,
      );
      return this.parseWithRegex(question, now);
    }
  }

  private async parseWithOpenAi(
    question: string,
    now: Date,
    apiKey: string,
  ): Promise<ParsedInvestigationQuery> {
    if (!this.client) this.client = new OpenAI({ apiKey });
    const model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o';

    const response = await this.client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: [
            `Today's date is ${toDateKey(now)} (YYYY-MM-DD). Resolve relative dates ("yesterday", "last week") against it.`,
            'Classify the question into exactly one intent using this taxonomy (in order of precedence — only pick a specific intent if the question clearly matches it; "general" is the safe default):',
            ...VALID_INTENTS.map((i) => `- ${i}: ${INTENT_DESCRIPTIONS[i]}`),
          ].join('\n'),
        },
        { role: 'user', content: question },
      ],
      tools: [PARSE_TOOL_SCHEMA],
      tool_choice: { type: 'function', function: { name: PARSE_TOOL_NAME } },
    });

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function')
      throw new Error('OpenAI did not return a structured query');

    const parsed = JSON.parse(
      toolCall.function.arguments,
    ) as ParsedInvestigationQuery;
    if (!VALID_INTENTS.includes(parsed.intent))
      throw new Error(`Unrecognized intent: ${parsed.intent}`);
    return parsed;
  }

  private parseWithRegex(
    question: string,
    now: Date,
  ): ParsedInvestigationQuery {
    const lower = question.toLowerCase();
    const intent = this.classifyIntent(lower);

    const ddmmyyyy = question.match(DDMMYYYY);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const date = toDateKey(
        new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
      );
      return { intent, dateFrom: date, dateTo: date };
    }

    if (lower.includes('last week')) {
      const to = toDateKey(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000));
      const from = toDateKey(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      return { intent, dateFrom: from, dateTo: to };
    }

    if (lower.includes('today')) {
      const today = toDateKey(now);
      return { intent, dateFrom: today, dateTo: today };
    }

    // Default: yesterday — the most common "why did traffic move" reference point when no date is given.
    const yesterday = toDateKey(
      new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    );
    return { intent, dateFrom: yesterday, dateTo: yesterday };
  }

  private classifyIntent(lower: string): InvestigationIntent {
    if (/\b(recommend|re-run|rerun|which campaign)\b/.test(lower))
      return 'recommend_campaign';
    // Forward-looking / open-ended advice phrasing ("what should I do", "how can I improve") is
    // general even if it happens to contain a directional word like "increase" — it's not a
    // root-cause "why did X change" question. Checked before why_low/why_high for that reason.
    if (
      /\b(what should i|what can i|how can i|how do i|how should i)\b/.test(
        lower,
      )
    )
      return 'general';
    // why_low/why_high checked BEFORE compare_periods: a question like "why did visitors decrease
    // compared to last week" names a comparison baseline but is still a root-cause "why" question,
    // not a request for a neutral side-by-side comparison — see INTENT_DESCRIPTIONS above, kept in
    // sync with this fallback.
    if (/\b(low|drop|decrease|down|fell|fewer|lower)\b/.test(lower))
      return 'why_low';
    if (/\b(high|spike|increase|up|surge|more|higher)\b/.test(lower))
      return 'why_high';
    if (/\b(compare|versus|vs\.?)\b/.test(lower)) return 'compare_periods';
    return 'general';
  }
}
