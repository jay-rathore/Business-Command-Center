import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CampaignPlatform, CampaignStatus, Prisma } from "@prisma/client";
import { CampaignDetail, CampaignListItem, ChannelBreakdownEntry, MarketingKpis, PaginatedResponse } from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { MarketingListQueryDto } from "./dto/marketing-list-query.dto";

type CampaignRow = Prisma.MarketingCampaignGetPayload<{}>;

const ALL_PLATFORMS: CampaignPlatform[] = ["GOOGLE_ADS", "META_ADS", "WEBSITE", "WHATSAPP", "ORGANIC", "OTHER"];

@Injectable()
export class MarketingService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async findAll(query: MarketingListQueryDto): Promise<PaginatedResponse<CampaignListItem>> {
    const { page, pageSize, sortBy, sortDir, q, platform, status } = query;

    const where: Prisma.MarketingCampaignWhereInput = {
      ...(platform ? { platform } : {}),
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const [campaigns, total] = await Promise.all([
      this.prisma.marketingCampaign.findMany({
        where,
        orderBy: this.mapColumnSort(sortBy, sortDir),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.marketingCampaign.count({ where }),
    ]);

    return buildPaginatedResponse(campaigns.map((c) => this.toListItem(c)), total, page, pageSize);
  }

  async findOne(id: string): Promise<CampaignDetail> {
    const campaign = await this.prisma.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException("Campaign not found");
    return { ...this.toListItem(campaign), notes: campaign.notes };
  }

  async getKpis(): Promise<MarketingKpis> {
    const campaigns = await this.prisma.marketingCampaign.findMany();

    let totalSpend = 0;
    let totalLeads = 0;
    let activeCampaigns = 0;
    let demoSpend = 0;
    let demoRevenue = 0;
    const campaignsByPlatform = Object.fromEntries(ALL_PLATFORMS.map((p) => [p, 0])) as Record<CampaignPlatform, number>;

    for (const c of campaigns) {
      totalSpend += Number(c.spend);
      totalLeads += c.leadsCount;
      if (c.status === "ACTIVE") activeCampaigns += 1;
      campaignsByPlatform[c.platform] += 1;
      // Excludes zero-spend channels (Organic/Website) too — their fabricated "revenue" has no
      // matching spend to divide against, so including it would inflate the blended ratio with
      // revenue that isn't actually tied to any ad cost.
      if (!c.metaCampaignId && Number(c.spend) > 0) {
        demoSpend += Number(c.spend);
        demoRevenue += Number(c.revenue);
      }
    }

    return {
      totalSpend,
      totalLeads,
      blendedCpl: totalLeads > 0 ? totalSpend / totalLeads : null,
      activeCampaigns,
      campaignsByPlatform,
      demoRevenue,
      blendedRoas: demoRevenue > 0 && demoSpend > 0 ? demoRevenue / demoSpend : null,
    };
  }

  async getChannelBreakdown(): Promise<ChannelBreakdownEntry[]> {
    const campaigns = await this.prisma.marketingCampaign.findMany();
    const byPlatform = new Map<CampaignPlatform, ChannelBreakdownEntry>();
    for (const platform of ALL_PLATFORMS) byPlatform.set(platform, { platform, spend: 0, leadsCount: 0, campaignCount: 0 });

    for (const c of campaigns) {
      const entry = byPlatform.get(c.platform)!;
      entry.spend += Number(c.spend);
      entry.leadsCount += c.leadsCount;
      entry.campaignCount += 1;
    }

    return ALL_PLATFORMS.map((p) => byPlatform.get(p)!);
  }

  private mapColumnSort(sortBy: string | undefined, sortDir: "asc" | "desc"): Prisma.MarketingCampaignOrderByWithRelationInput {
    switch (sortBy) {
      case "spend":
        return { spend: sortDir };
      case "leadsCount":
        return { leadsCount: sortDir };
      case "startDate":
        return { startDate: sortDir };
      case "createdAt":
        return { createdAt: sortDir };
      case "name":
      default:
        return { name: sortDir };
    }
  }

  private toListItem(campaign: CampaignRow): CampaignListItem {
    const spend = Number(campaign.spend);
    const revenue = Number(campaign.revenue);
    return {
      id: campaign.id,
      name: campaign.name,
      platform: campaign.platform,
      status: campaign.status,
      spend,
      leadsCount: campaign.leadsCount,
      revenue,
      cpl: campaign.leadsCount > 0 ? spend / campaign.leadsCount : null,
      // Never compute ROAS against real spend with fabricated revenue — revenue stays 0 for
      // Meta-synced rows, so this naturally reads as "not available" for live campaigns. Also
      // guard spend > 0 explicitly rather than relying on JSON.stringify turning Infinity into
      // null for zero-spend channels (Website/Organic).
      roas: revenue > 0 && spend > 0 ? revenue / spend : null,
      source: campaign.metaCampaignId ? "live" : "demo",
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate?.toISOString() ?? null,
    };
  }
}
