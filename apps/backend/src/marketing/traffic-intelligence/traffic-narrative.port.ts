import { TrafficInvestigationResult } from '@hpl/shared';

/** Swap point for LLM-phrased narrative — mirrors InsightGeneratorPort in
 * ../../dashboard/ai-summary.service.ts. The composer only ever rephrases an already-fully-computed
 * TrafficInvestigationResult; it must never invent or alter a number, so `compose` takes the
 * finished result and returns the same shape with polished prose in its string fields. */
export interface TrafficNarrativePort {
  compose(
    result: TrafficInvestigationResult,
  ): Promise<TrafficInvestigationResult> | TrafficInvestigationResult;
}

export const TRAFFIC_NARRATIVE_COMPOSER = Symbol('TRAFFIC_NARRATIVE_COMPOSER');
