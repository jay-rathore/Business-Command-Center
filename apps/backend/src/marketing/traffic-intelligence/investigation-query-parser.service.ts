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
          description:
            'why_low = traffic dropped, why_high = traffic increased, compare_periods, recommend_campaign, or general',
        },
        dateFrom: {
          type: 'string',
          description:
            'Absolute start date of the period to investigate, YYYY-MM-DD',
        },
        dateTo: {
          type: 'string',
          description:
            'Absolute end date of the period to investigate, YYYY-MM-DD. Same as dateFrom for a single-day question.',
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
          content: `Today's date is ${toDateKey(now)} (YYYY-MM-DD). Resolve relative dates ("yesterday", "last week") against it.`,
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
    if (/\b(compare|versus|vs\.?)\b/.test(lower)) return 'compare_periods';
    if (/\b(low|drop|decrease|down|fell|fewer|lower)\b/.test(lower))
      return 'why_low';
    if (/\b(high|spike|increase|up|surge|more|higher)\b/.test(lower))
      return 'why_high';
    return 'general';
  }
}
