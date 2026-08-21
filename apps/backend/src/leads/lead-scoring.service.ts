import { Inject, Injectable } from "@nestjs/common";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { computeLeadScore } from "./lead-scoring.util";

@Injectable()
export class LeadScoringService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async recomputeOne(leadId: string): Promise<number> {
    const lead = await this.prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: { status: true, sources: { include: { leadSource: true } } },
    });
    const now = new Date();
    const referenceDate = lead.lastActivityAt ?? lead.createdAt;
    const daysSinceActivity = Math.round((now.getTime() - referenceDate.getTime()) / 86400000);

    const score = computeLeadScore({
      sourceScores: lead.sources.map((s) => s.leadSource.score),
      statusScore: lead.status?.score ?? null,
      isLost: lead.status?.stage === "LOST",
      estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
      daysSinceActivity,
    });

    await this.prisma.lead.update({ where: { id: leadId }, data: { score } });
    return score;
  }
}
