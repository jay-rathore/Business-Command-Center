import { Injectable } from "@nestjs/common";
import { BusinessHealthSignal, DealersKpis, HealthStatus, LeadsKpis, ProjectsKpis, SalesOverview } from "@hpl/shared";
import { SalesService } from "../sales/sales.service";
import { LeadsService } from "../leads/leads.service";
import { DealersService } from "../dealers/dealers.service";
import { ProjectsService } from "../projects/projects.service";

/** Rolls up Sales/Leads/Dealers/Projects into the Command Center's 6 Business Health
 * signals — composes the existing module services rather than querying Prisma directly.
 * Marketing and Customer signals are honestly marked "pending" (not faked) since those
 * modules are Phase 2/2 respectively and have no data to roll up yet. */
@Injectable()
export class BusinessHealthService {
  constructor(
    private readonly sales: SalesService,
    private readonly leads: LeadsService,
    private readonly dealers: DealersService,
    private readonly projects: ProjectsService,
  ) {}

  async getSignals(): Promise<BusinessHealthSignal[]> {
    const [salesOverview, leadsKpis, dealersKpis, projectsKpis] = await Promise.all([
      this.sales.getOverview(),
      this.leads.getKpis(),
      this.dealers.getKpis(),
      this.projects.getKpis(),
    ]);

    return [
      this.salesHealth(salesOverview),
      this.leadHealth(leadsKpis),
      this.dealerHealth(dealersKpis),
      this.pipelineHealth(projectsKpis),
      {
        key: "marketing",
        name: "Marketing Health",
        status: "pending",
        description: "Marketing module ships in Phase 2 — spend, CPL and ROAS tracking will populate this signal.",
      },
      {
        key: "customer",
        name: "Customer Health",
        status: "pending",
        description: "Customer module ships in Phase 2 — satisfaction and complaint tracking will populate this signal.",
      },
    ];
  }

  private salesHealth(overview: SalesOverview): BusinessHealthSignal {
    const achievement = overview.achievement;
    let status: HealthStatus = "pending";
    let description = "No sales target set for the current period yet.";
    if (achievement !== null) {
      if (achievement >= 90) {
        status = "good";
        description = `On track — ${achievement.toFixed(0)}% of monthly target achieved.`;
      } else if (achievement >= 70) {
        status = "warn";
        description = `Slightly behind — ${achievement.toFixed(0)}% of monthly target achieved.`;
      } else {
        status = "crit";
        description = `Well behind target — only ${achievement.toFixed(0)}% achieved this month.`;
      }
    }
    return { key: "sales", name: "Sales Health", status, description };
  }

  private leadHealth(kpis: LeadsKpis): BusinessHealthSignal {
    let status: HealthStatus;
    let description: string;
    if (kpis.conversionRate >= 25) {
      status = "good";
      description = `Healthy conversion — ${kpis.conversionRate.toFixed(0)}% of decided leads won.`;
    } else if (kpis.conversionRate >= 12) {
      status = "warn";
      description = `Conversion softening — ${kpis.conversionRate.toFixed(0)}% of decided leads won.`;
    } else {
      status = "crit";
      description = `Low conversion — only ${kpis.conversionRate.toFixed(0)}% of decided leads won.`;
    }
    return { key: "leads", name: "Lead Health", status, description };
  }

  private dealerHealth(kpis: DealersKpis): BusinessHealthSignal {
    const atRiskShare = kpis.totalDealers > 0 ? ((kpis.atRiskDealers + kpis.inactiveDealers) / kpis.totalDealers) * 100 : 0;
    let status: HealthStatus;
    let description: string;
    if (atRiskShare <= 20) {
      status = "good";
      description = `${kpis.activeDealers} of ${kpis.totalDealers} dealers are active and healthy.`;
    } else if (atRiskShare <= 40) {
      status = "warn";
      description = `${kpis.atRiskDealers + kpis.inactiveDealers} dealers (${atRiskShare.toFixed(0)}%) are at-risk or inactive.`;
    } else {
      status = "crit";
      description = `${atRiskShare.toFixed(0)}% of the dealer network is at-risk or inactive.`;
    }
    return { key: "dealers", name: "Dealer Health", status, description };
  }

  private pipelineHealth(kpis: ProjectsKpis): BusinessHealthSignal {
    const stuckShare = kpis.activePipeline > 0 ? (kpis.stuckProjects / kpis.activePipeline) * 100 : 0;
    let status: HealthStatus;
    let description: string;
    if (stuckShare <= 25) {
      status = "good";
      description = `Pipeline moving well — ${kpis.stuckProjects} of ${kpis.activePipeline} active projects stuck.`;
    } else if (stuckShare <= 50) {
      status = "warn";
      description = `${kpis.stuckProjects} of ${kpis.activePipeline} active projects have stalled.`;
    } else {
      status = "crit";
      description = `Over half the active pipeline (${kpis.stuckProjects} of ${kpis.activePipeline}) is stuck.`;
    }
    return { key: "pipeline", name: "Pipeline Health", status, description };
  }
}
