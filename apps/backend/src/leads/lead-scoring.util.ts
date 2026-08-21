export interface LeadScoreInput {
  /** Score of every linked LeadSource row; empty if the lead has no source set. */
  sourceScores: number[];
  /** Score of the lead's LeadStatus row; null if no status is set. */
  statusScore: number | null;
  /** True when the lead's status is classified LeadStage.LOST. */
  isLost: boolean;
  estimatedValue: number | null;
  /** Days since last activity, or since creation if no activity logged yet. */
  daysSinceActivity: number;
}

const FALLBACK_SOURCE_SCORE = 8;
const FALLBACK_STATUS_SCORE = 5;

/** Rule-based 0-100 lead score — no formula was specified by the client spec (unlike Dealer
 * Health, which was), so this combines source quality, pipeline progress, activity recency,
 * and deal size into one weighted figure. Recomputed on every activity/status write, not
 * computed live on read (cached on Lead.score). A LOST lead always scores 0 regardless of
 * its other factors — it's a dead lead, not a cold-but-viable one.
 *
 * Source/status weights live on the LeadSource/LeadStatus rows themselves (score column)
 * rather than a hardcoded map here, since the CRM's taxonomy is staff-editable and open-ended. */
export function computeLeadScore(input: LeadScoreInput): number {
  if (input.isLost) return 0;

  const sourceScore = input.sourceScores.length > 0 ? Math.max(...input.sourceScores) : FALLBACK_SOURCE_SCORE;
  const statusScore = input.statusScore ?? FALLBACK_STATUS_SCORE;

  let recencyScore: number;
  if (input.daysSinceActivity <= 3) recencyScore = 25;
  else if (input.daysSinceActivity <= 7) recencyScore = 18;
  else if (input.daysSinceActivity <= 14) recencyScore = 10;
  else if (input.daysSinceActivity <= 30) recencyScore = 5;
  else recencyScore = 0;

  let valueScore: number;
  const value = input.estimatedValue ?? 0;
  if (value >= 1000000) valueScore = 20;
  else if (value >= 500000) valueScore = 15;
  else if (value >= 200000) valueScore = 10;
  else if (value > 0) valueScore = 5;
  else valueScore = 0;

  return Math.min(100, sourceScore + statusScore + recencyScore + valueScore);
}
