import { Injectable } from "@nestjs/common";
import { ContributorEntry, ContributorTab } from "@hpl/shared";
import { SalesService } from "../sales/sales.service";
import { DealersService } from "../dealers/dealers.service";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class ContributorsService {
  constructor(
    private readonly sales: SalesService,
    private readonly dealers: DealersService,
    private readonly projects: ProjectsService,
  ) {}

  async getContributors(tab: ContributorTab): Promise<ContributorEntry[]> {
    switch (tab) {
      case "dealers": {
        const leaderboard = await this.dealers.getLeaderboard();
        return leaderboard.map((d) => ({ id: d.id, name: d.name, value: d.revenue }));
      }
      case "products": {
        const breakdown = await this.sales.getBreakdown("product");
        return breakdown.map((b) => ({ id: b.id, name: b.name, value: b.revenue }));
      }
      case "states": {
        const breakdown = await this.sales.getBreakdown("state");
        return breakdown.map((b) => ({ id: b.id, name: b.name, value: b.revenue }));
      }
      case "executives": {
        const breakdown = await this.sales.getBreakdown("executive");
        return breakdown.map((b) => ({ id: b.id, name: b.name, value: b.revenue }));
      }
      case "projects": {
        const kanban = await this.projects.getKanban();
        return kanban
          .flatMap((c) => c.projects)
          .filter((p) => p.stage !== "COMPLETED" && p.stage !== "LOST")
          .sort((a, b) => b.estimatedValue - a.estimatedValue)
          .slice(0, 5)
          .map((p) => ({ id: p.id, name: p.name, value: p.estimatedValue }));
      }
    }
  }
}
