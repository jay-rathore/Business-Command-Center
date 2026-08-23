import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TrafficInvestigationResult } from '@hpl/shared';
import { TrafficNarrativePort } from './traffic-narrative.port';

/** Default, always-available composer — RootCauseEngineService already generates complete,
 * correct sentences for every string field directly from the computed evidence (mirrors
 * RuleBasedInsightGenerator in ../../dashboard/ai-summary.service.ts: a real, usable answer with
 * zero AI cost/dependency), so this is an identity pass. TrafficIntelligenceService tries
 * OpenAiTrafficNarrativeComposer first when OPENAI_API_KEY is configured and falls back to this
 * on any failure. */
@Injectable()
export class RuleBasedTrafficNarrativeComposer implements TrafficNarrativePort {
  compose(result: TrafficInvestigationResult): TrafficInvestigationResult {
    return result;
  }
}

const REPHRASE_TOOL_NAME = 'rephrase_investigation';

function buildToolSchema(
  evidenceCount: number,
  contributingCount: number,
  notCausedCount: number,
) {
  return {
    type: 'function' as const,
    function: {
      name: REPHRASE_TOOL_NAME,
      description:
        'Rephrase each field for clarity and a natural, confident tone. Use ONLY the numbers already present in the input — never introduce, recompute, or alter any number, date, or campaign name.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description:
              "One clear sentence explaining what happened, e.g. 'Traffic decreased by 38% on 15/08/2026.'",
          },
          primaryCauseSummary: {
            type: ['string', 'null'],
            description:
              'Rephrased primary cause explanation, or null if there is no primary cause.',
          },
          supportingEvidenceSummaries: {
            type: 'array',
            items: { type: 'string' },
            minItems: evidenceCount,
            maxItems: evidenceCount,
          },
          contributingFactorSummaries: {
            type: 'array',
            items: { type: 'string' },
            minItems: contributingCount,
            maxItems: contributingCount,
          },
          notCausedBySummaries: {
            type: 'array',
            items: { type: 'string' },
            minItems: notCausedCount,
            maxItems: notCausedCount,
          },
          recommendedAction: { type: 'string' },
        },
        required: [
          'summary',
          'supportingEvidenceSummaries',
          'contributingFactorSummaries',
          'notCausedBySummaries',
          'recommendedAction',
        ],
      },
    },
  };
}

interface RephraseResult {
  summary: string;
  primaryCauseSummary: string | null;
  supportingEvidenceSummaries: string[];
  contributingFactorSummaries: string[];
  notCausedBySummaries: string[];
  recommendedAction: string;
}

/** Rephrases an already-fully-computed TrafficInvestigationResult into more natural prose via
 * forced OpenAI function-calling — same pattern as business-card-ai-parser.service.ts. Every
 * number/classification/reference in the result is decided by RootCauseEngineService before this
 * ever runs; the model is only allowed to touch the string fields, and even then only through a
 * schema that requires it to return exactly as many evidence strings as were given, so a
 * mismatched response is easy to detect and reject. */
@Injectable()
export class OpenAiTrafficNarrativeComposer implements TrafficNarrativePort {
  private readonly logger = new Logger(OpenAiTrafficNarrativeComposer.name);
  private client: OpenAI | undefined;

  constructor(private readonly config: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.config.getOrThrow<string>('OPENAI_API_KEY');
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async compose(
    result: TrafficInvestigationResult,
  ): Promise<TrafficInvestigationResult> {
    const model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o';
    const schema = buildToolSchema(
      result.supportingEvidence.length,
      result.contributingFactors.length,
      result.notCausedBy.length,
    );

    const response = await this.getClient().chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You phrase a marketing traffic-investigation result for a business owner. You are given the fully computed result as JSON. Rephrase only for clarity and tone — never add, remove, or change any number, percentage, date, or campaign name.',
        },
        { role: 'user', content: JSON.stringify(result) },
      ],
      tools: [schema],
      tool_choice: { type: 'function', function: { name: REPHRASE_TOOL_NAME } },
    });

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function')
      throw new Error('OpenAI did not return a structured rephrase');

    const rephrased = JSON.parse(toolCall.function.arguments) as RephraseResult;
    if (
      rephrased.supportingEvidenceSummaries.length !==
        result.supportingEvidence.length ||
      rephrased.contributingFactorSummaries.length !==
        result.contributingFactors.length ||
      rephrased.notCausedBySummaries.length !== result.notCausedBy.length
    ) {
      throw new Error(
        'OpenAI rephrase item count did not match the input — discarding to avoid dropping evidence',
      );
    }

    return {
      ...result,
      summary: rephrased.summary,
      primaryCause: result.primaryCause
        ? {
            ...result.primaryCause,
            summary:
              rephrased.primaryCauseSummary ?? result.primaryCause.summary,
          }
        : null,
      supportingEvidence: result.supportingEvidence.map((e, i) => ({
        ...e,
        summary: rephrased.supportingEvidenceSummaries[i],
      })),
      contributingFactors: result.contributingFactors.map((e, i) => ({
        ...e,
        summary: rephrased.contributingFactorSummaries[i],
      })),
      notCausedBy: result.notCausedBy.map((e, i) => ({
        ...e,
        summary: rephrased.notCausedBySummaries[i],
      })),
      recommendedAction: rephrased.recommendedAction,
    };
  }
}
