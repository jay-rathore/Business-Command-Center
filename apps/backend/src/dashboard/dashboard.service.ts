import { Inject, Injectable } from "@nestjs/common";
import { AiExecutiveSummary, DashboardSummary, HealthStatus } from "@hpl/shared";
import { SalesService } from "../sales/sales.service";
import { LeadsService } from "../leads/leads.service";
import { ProjectsService } from "../projects/projects.service";
import { BusinessHealthService } from "./business-health.service";
import { AttentionFeedService } from "./attention-feed.service";
import { ContributorsService } from "./contributors.service";
import { INSIGHT_GENERATOR } from "./ai-summary.service";
import type { InsightGeneratorPort } from "./ai-summary.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly sales: SalesService,
    private readonly leads: LeadsService,
    private readonly projects: ProjectsService,
    private readonly businessHealth: BusinessHealthService,
    private readonly attentionFeed: AttentionFeedService,
    private readonly contributors: ContributorsService,
    @Inject(INSIGHT_GENERATOR) private readonly insightGenerator: InsightGeneratorPort,
  ) {}

  async getSummary(dateFrom?: string, dateTo?: string): Promise<DashboardSummary> {
    const [salesOverview, leadsKpis, projectsKpis] = await Promise.all([
      this.sales.getOverview(dateFrom, dateTo),
      this.leads.getKpis(dateFrom, dateTo),
      this.projects.getKpis(),
    ]);

    return {
      revenue: {
        key: "revenue",
        label: "Revenue",
        value: salesOverview.revenue,
        format: "currency",
        delta: salesOverview.growth,
        status: this.statusFromDelta(salesOverview.growth),
      },
      orders: {
        key: "orders",
        label: "Orders",
        value: salesOverview.orders,
        format: "number",
        delta: null,
        status: "good",
      },
      targetAchievement: {
        key: "targetAchievement",
        label: "Target Achievement",
        value: salesOverview.achievement ?? 0,
        format: "percent",
        delta: null,
        status: this.statusFromAchievement(salesOverview.achievement),
      },
      pipelineValue: {
        key: "pipelineValue",
        label: "Pipeline Value",
        value: projectsKpis.pipelineValue,
        format: "currency",
        delta: null,
        status: "good",
      },
      newLeads: {
        key: "newLeads",
        label: "New Leads",
        value: leadsKpis.newThisMonth,
        format: "number",
        delta: null,
        status: "good",
      },
      conversionRate: {
        key: "conversionRate",
        label: "Conversion Rate",
        value: leadsKpis.conversionRate,
        format: "percent",
        delta: null,
        status: this.statusFromConversion(leadsKpis.conversionRate),
      },
    };
  }

  async getAiSummary(): Promise<AiExecutiveSummary> {
    const [summary, health, attention, topContributors] = await Promise.all([
      this.getSummary(),
      this.businessHealth.getSignals(),
      this.attentionFeed.getFeed(),
      this.contributors.getContributors("dealers"),
    ]);

    return this.insightGenerator.generate({ summary, health, attention, topContributor: topContributors[0] ?? null });
  }

  private statusFromDelta(delta: number | null): HealthStatus {
    if (delta === null) return "pending";
    return delta >= 0 ? "good" : delta >= -10 ? "warn" : "crit";
  }

  private statusFromAchievement(achievement: number | null): HealthStatus {
    if (achievement === null) return "pending";
    return achievement >= 90 ? "good" : achievement >= 70 ? "warn" : "crit";
  }

  private statusFromConversion(rate: number): HealthStatus {
    return rate >= 25 ? "good" : rate >= 12 ? "warn" : "crit";
  }
}
