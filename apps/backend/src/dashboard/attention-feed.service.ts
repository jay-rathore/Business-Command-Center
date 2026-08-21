import { Injectable } from "@nestjs/common";
import { AttentionItem, AttentionPriority } from "@hpl/shared";
import { LeadsService } from "../leads/leads.service";
import { DealersService } from "../dealers/dealers.service";
import { ProjectsService } from "../projects/projects.service";

const PRIORITY_RANK: Record<AttentionPriority, number> = { critical: 0, high: 1, medium: 2 };
const HIGH_VALUE_THRESHOLD = 2000000; // ₹20L — matches the "high-value project" framing used on the Projects page

@Injectable()
export class AttentionFeedService {
  constructor(
    private readonly leads: LeadsService,
    private readonly dealers: DealersService,
    private readonly projects: ProjectsService,
  ) {}

  async getFeed(): Promise<AttentionItem[]> {
    const [overdueCount, riskDealers, stuckProjects] = await Promise.all([
      this.leads.countOverdue(),
      this.dealers.getRiskAlerts(),
      this.projects.getStuckProjects(),
    ]);

    const items: AttentionItem[] = [];

    if (overdueCount > 0) {
      items.push({
        id: "overdue-leads",
        priority: overdueCount > 10 ? "critical" : "high",
        title: `${overdueCount} overdue sales follow-ups`,
        meta: "Leads past their next follow-up date",
        value: null,
        module: "LEADS",
        recordId: null,
      });
    }

    for (const p of stuckProjects.filter((p) => p.estimatedValue >= HIGH_VALUE_THRESHOLD).slice(0, 3)) {
      items.push({
        id: `stuck-${p.id}`,
        priority: "high",
        title: `${p.name} inactive for ${p.daysInStage} days`,
        meta: "High-value project stuck in pipeline",
        value: p.estimatedValue,
        module: "PROJECTS",
        recordId: p.id,
      });
    }

    for (const d of riskDealers.filter((d) => d.status === "INACTIVE").slice(0, 3)) {
      items.push({
        id: `dealer-${d.id}`,
        priority: "high",
        title: `${d.name} has gone inactive`,
        meta: `${d.city}, ${d.state} · health score ${d.healthScore ?? "—"}`,
        value: null,
        module: "DEALERS",
        recordId: d.id,
      });
    }

    for (const d of riskDealers.filter((d) => d.status === "AT_RISK").slice(0, 2)) {
      items.push({
        id: `dealer-risk-${d.id}`,
        priority: "medium",
        title: `${d.name} is becoming inactive`,
        meta: `${d.city}, ${d.state} · health score ${d.healthScore ?? "—"}`,
        value: null,
        module: "DEALERS",
        recordId: d.id,
      });
    }

    return items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  }
}
