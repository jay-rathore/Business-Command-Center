import { Injectable } from "@nestjs/common";
import { AiExecutiveSummary, AttentionItem, BusinessHealthSignal, ContributorEntry, DashboardSummary } from "@hpl/shared";

export interface InsightGeneratorContext {
  summary: DashboardSummary;
  health: BusinessHealthSignal[];
  attention: AttentionItem[];
  topContributor: ContributorEntry | null;
}

/** Swap point for a real LLM later (per spec: "architecture should allow future integration
 * with OpenAI") — DashboardService only depends on this interface, never the concrete
 * implementation, so a LlmInsightGenerator can be substituted via DI without touching the
 * controller. */
export interface InsightGeneratorPort {
  generate(context: InsightGeneratorContext): AiExecutiveSummary;
}

export const INSIGHT_GENERATOR = Symbol("INSIGHT_GENERATOR");

@Injectable()
export class RuleBasedInsightGenerator implements InsightGeneratorPort {
  generate(context: InsightGeneratorContext): AiExecutiveSummary {
    const { summary, health, attention, topContributor } = context;
    const revenueDelta = summary.revenue.delta;

    let narrative: string;
    if (revenueDelta === null) {
      narrative = "Revenue trend data is still building up for a period-over-period comparison.";
    } else if (revenueDelta >= 0) {
      narrative = `Business performance is up ${revenueDelta.toFixed(1)}% this month.`;
    } else {
      narrative = `Business performance is down ${Math.abs(revenueDelta).toFixed(1)}% this month.`;
    }

    if (topContributor) {
      narrative += ` ${topContributor.name} is the leading contributor this period.`;
    }

    const criticalSignals = health.filter((h) => h.status === "crit");
    if (criticalSignals.length > 0) {
      narrative += ` ${criticalSignals.map((s) => s.name).join(" and ")} ${
        criticalSignals.length === 1 ? "needs" : "need"
      } immediate attention.`;
    } else {
      const warnSignals = health.filter((h) => h.status === "warn");
      if (warnSignals.length > 0) {
        narrative += ` Keep an eye on ${warnSignals.map((s) => s.name).join(" and ")}.`;
      }
    }

    const recommendedActions = attention.slice(0, 3).map((a) => a.title);

    return {
      narrative,
      recommendedActions,
      generatedAt: new Date().toISOString(),
    };
  }
}
