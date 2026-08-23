import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { InvestigationIntent } from '@hpl/shared';
import { toDateKey } from './analysis/period.util';

export interface ParsedInvestigationQuery {
  intent: InvestigationIntent;
  dateFrom: string;
  dateTo: string;
  /** True when the question itself names or clearly implies a date/period ("yesterday",
   * "15/08/2026", "last week", "on Aug 5th"). False when no date/period was mentioned at all and
   * dateFrom/dateTo below are just the default fallback (yesterday) — callers that only want a
   * period-scoped answer when the user actually asked for one (e.g. recommend_campaign) should
   * check this rather than assuming dateFrom/dateTo were user-specified. */
  dateWasExplicit: boolean;
}

const PARSE_TOOL_NAME = 'resolve_investigation_query';
const VALID_INTENTS: InvestigationIntent[] = [
  'out_of_scope',
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
  out_of_scope:
    'The question has NOTHING to do with website traffic, marketing campaigns, leads, conversions, or this business\'s marketing performance — general knowledge, personal, or entirely unrelated questions. Example: "who is the prime minister of India", "what\'s the weather today", "write me a poem", "what is 2+2". Checked FIRST, before every other intent — if the question isn\'t about this Command Center\'s marketing/traffic data at all, it is always this, never one of the others below.',
  why_low:
    'The user is asking WHY traffic/visitors DROPPED or was LOW. Example: "why was traffic low yesterday", "why did visitors decrease compared to last week". This takes priority over compare_periods even when a comparison baseline like "compared to last week" or "vs last month" is named — naming a baseline is just how the drop is being measured, not a request for a neutral side-by-side comparison.',
  why_high:
    'The user is asking WHY traffic/visitors ROSE or SPIKED. Example: "why did traffic increase", "what caused the spike on 18 Aug", "why is traffic up vs last week". Same priority-over-compare_periods rule as why_low.',
  compare_periods:
    'The user wants a neutral side-by-side comparison of two named periods, WITHOUT asking "why" a change happened. Example: "compare this week to last week", "August vs July traffic numbers". If the question contains "why" plus a directional word (low/high/dropped/increased/decreased), it is why_low/why_high instead, never this — "why" always signals a root-cause question, not a plain comparison.',
  recommend_campaign:
    'The user is asking WHICH SPECIFIC CAMPAIGN to run, re-run, scale up, or performed best — i.e. asking for a campaign pick/ranking, whether about all-time performance or a specific date ("which campaign gave best results on Aug 5th"). Example: "which campaign should I re-run", "what campaign converts best", "which campaign performed best last week". Do NOT use this for general "what should I do to improve traffic" questions with no request for a specific campaign name — that is why_high or general instead, answered with the recommendedAction field, not a campaign ranking.',
  general:
    'A traffic/marketing-related question that is not clearly a drop/spike/comparison/campaign-pick — "what happened on <date>", open-ended forward-looking advice ("what should I change to increase traffic next week"), or a factual question about website/campaign performance for a period. This is the safe default for ON-TOPIC questions — prefer it over guessing one of the other three when unsure, but never use it for a question that has nothing to do with marketing/traffic at all (that is out_of_scope).',
};

const PARSE_TOOL_SCHEMA = {
  type: 'function' as const,
  function: {
    name: PARSE_TOOL_NAME,
    description:
      'Resolve a free-text question into a classified intent and a concrete absolute date range to investigate. The question may not be about marketing/traffic at all — classify those as out_of_scope rather than forcing a traffic answer onto an unrelated question.',
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
            'Absolute start date of the period to investigate, YYYY-MM-DD. If the question has no date/period reference at all, use yesterday. For out_of_scope, just use yesterday — it is ignored.',
        },
        dateTo: {
          type: 'string',
          description:
            'Absolute end date of the period to investigate, YYYY-MM-DD. Same as dateFrom for a single-day question. For a forward-looking question ("next week"), there is no future data yet — use the most recent trailing period (last 7 days) instead so the answer is grounded in real data.',
        },
        dateWasExplicit: {
          type: 'boolean',
          description:
            'true if the question itself names or clearly implies a date/period ("yesterday", "15/08/2026", "last week", "on Aug 5th", "next week"). false only when no date/period is mentioned anywhere in the question and dateFrom/dateTo above are just your default fallback.',
        },
      },
      required: ['intent', 'dateFrom', 'dateTo', 'dateWasExplicit'],
    },
  },
};

const DDMMYYYY = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
const DATE_SIGNAL =
  /\b(today|yesterday|last week|last month|this week|this month)\b/;
// Broad on-topic vocabulary for the no-AI-configured fallback — a question that matches neither
// this nor a date reference is assumed to have nothing to do with marketing/traffic at all. This
// is a blunter instrument than the OpenAI path's judgment call, but a safe default: it only
// widens what counts as "on topic," so it can misclassify a truly novel on-topic phrasing as
// out_of_scope, but should never do the more harmful thing (treat an unrelated question as a real
// traffic investigation and fabricate a confident-sounding answer for it).
const ON_TOPIC_KEYWORDS =
  /\b(traffic|visitor|visitors|website|site|campaign|campaigns|lead|leads|conversion|conversions|session|sessions|click|clicks|spend|budget|marketing|analytics|search console|google ads|meta|facebook|instagram|ads?|revenue|roas|ctr|impressions?)\b/;

/** Turns a free-text question ("Why was my website traffic so low on 15/08/2026?") into a
 * structured {intent, dateFrom, dateTo, dateWasExplicit} that RootCauseEngineService /
 * CampaignRecommendationService can run against — mirrors business-card-ai-parser.service.ts's
 * forced-tool-call pattern. Falls back to a regex/keyword parser (handles the spec's DD/MM/YYYY
 * format plus "yesterday"/"last week") when OPENAI_API_KEY is unset or the call fails, so the
 * investigate endpoint still works without AI configured. */
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
            'Classify the question into exactly one intent using this taxonomy (in order of precedence — only pick a specific intent if the question clearly matches it; "general" is the safe default for ON-TOPIC questions, "out_of_scope" is checked first for anything else):',
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
      return { intent, dateFrom: date, dateTo: date, dateWasExplicit: true };
    }

    if (lower.includes('last week')) {
      const to = toDateKey(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000));
      const from = toDateKey(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      return { intent, dateFrom: from, dateTo: to, dateWasExplicit: true };
    }

    if (lower.includes('today')) {
      const today = toDateKey(now);
      return { intent, dateFrom: today, dateTo: today, dateWasExplicit: true };
    }

    if (lower.includes('yesterday')) {
      const yesterday = toDateKey(
        new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      );
      return {
        intent,
        dateFrom: yesterday,
        dateTo: yesterday,
        dateWasExplicit: true,
      };
    }

    // Default: yesterday — the most common "why did traffic move" reference point when no date is given.
    const yesterday = toDateKey(
      new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    );
    return {
      intent,
      dateFrom: yesterday,
      dateTo: yesterday,
      dateWasExplicit: false,
    };
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

    // Fell through to the catch-all: only treat it as a legitimate "general" traffic/marketing
    // question if it actually mentions marketing/traffic vocabulary or a recognizable date/period
    // reference — otherwise it's likely unrelated entirely (e.g. "who is the prime minister of
    // India") and forcing a traffic investigation onto it would fabricate a confident-sounding but
    // meaningless answer. See ON_TOPIC_KEYWORDS/DATE_SIGNAL above.
    if (
      ON_TOPIC_KEYWORDS.test(lower) ||
      DATE_SIGNAL.test(lower) ||
      DDMMYYYY.test(lower)
    )
      return 'general';
    return 'out_of_scope';
  }
}
