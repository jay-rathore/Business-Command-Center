import { Inject, Injectable } from '@nestjs/common';
import { PRISMA_EXTENDED_CLIENT } from '../../prisma/prisma-extended.provider';
import type { ExtendedPrismaClient } from '../../prisma/prisma-extended.provider';

export interface CampaignChangeSnapshot {
  status: string;
  dailyBudget: number | null;
  name: string;
}

/** Diffs a campaign's tracked fields (status/dailyBudget/name) between syncs and writes one
 * CampaignEvent row per changed field — MarketingCampaign itself is upserted in place with no
 * history of its own, so this is the only record of "when did this change" that the Traffic
 * Intelligence root-cause engine can correlate against. Called from MetaAdsSyncService /
 * GoogleAdsSyncService right before their existing upsert, using the row they already fetch to
 * decide created vs updated. detectedAt defaults to now(), i.e. sync time — not necessarily the
 * exact moment the change happened on the ad platform. */
@Injectable()
export class CampaignEventService {
  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT)
    private readonly prisma: ExtendedPrismaClient,
  ) {}

  async recordChanges(
    organizationId: string,
    campaignId: string,
    before: CampaignChangeSnapshot | null,
    after: CampaignChangeSnapshot,
  ): Promise<void> {
    if (!before) return; // newly created campaign — nothing to diff against

    const changes: Array<{
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }> = [];

    if (before.status !== after.status) {
      changes.push({
        field: 'status',
        oldValue: before.status,
        newValue: after.status,
      });
    }
    if (before.dailyBudget !== after.dailyBudget) {
      changes.push({
        field: 'dailyBudget',
        oldValue:
          before.dailyBudget != null ? String(before.dailyBudget) : null,
        newValue: after.dailyBudget != null ? String(after.dailyBudget) : null,
      });
    }
    if (before.name !== after.name) {
      changes.push({
        field: 'name',
        oldValue: before.name,
        newValue: after.name,
      });
    }

    if (changes.length === 0) return;

    await this.prisma.campaignEvent.createMany({
      data: changes.map((c) => ({ organizationId, campaignId, ...c })),
    });
  }
}
