import { ProjectStage } from "@prisma/client";

export const STUCK_THRESHOLD_DAYS = 20;
export const CLOSING_SOON_THRESHOLD_DAYS = 20;

const TERMINAL_STAGES: ProjectStage[] = [ProjectStage.ORDER, ProjectStage.COMPLETED, ProjectStage.LOST];
const CLOSED_STAGES: ProjectStage[] = [ProjectStage.COMPLETED, ProjectStage.LOST];

export function daysBetween(earlier: Date, later: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86400000);
}

export function isProjectStuck(stage: ProjectStage, daysInStage: number): boolean {
  return !TERMINAL_STAGES.includes(stage) && daysInStage > STUCK_THRESHOLD_DAYS;
}

export function isProjectClosingSoon(stage: ProjectStage, daysToClose: number | null): boolean {
  return !CLOSED_STAGES.includes(stage) && daysToClose !== null && daysToClose >= 0 && daysToClose <= CLOSING_SOON_THRESHOLD_DAYS;
}

export function weightedValue(estimatedValue: number, probability: number): number {
  return estimatedValue * (probability / 100);
}
