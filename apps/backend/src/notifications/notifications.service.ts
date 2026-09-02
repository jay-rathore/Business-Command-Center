import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationType, PermissionModule, Priority, Prisma, RoleName } from "@prisma/client";
import { NotificationItem, PaginatedResponse } from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext, resolveDefaultOrganizationId } from "../common/context/tenant-context";
import { CurrentUserData } from "../common/types/jwt-payload.interface";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { DealersService } from "../dealers/dealers.service";
import { ProjectsService } from "../projects/projects.service";
import { NotificationsListQueryDto } from "./dto/notifications-list-query.dto";

// ₹20L — same "high-value" framing AttentionFeedService already uses for stuck projects.
const HIGH_VALUE_THRESHOLD = 2000000;

const SUPERUSER_ROLES: RoleName[] = [RoleName.OWNER, RoleName.ADMIN];

export interface NotifyInput {
  organizationId: string;
  type: NotificationType;
  priority: Priority;
  title: string;
  message: string;
  linkModule?: PermissionModule;
  linkRecordId?: string;
  targetRole?: RoleName;
}

@Injectable()
export class NotificationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly dealers: DealersService,
    private readonly projects: ProjectsService,
  ) {}

  async onApplicationBootstrap() {
    // Populates immediately on a fresh boot rather than waiting for the 6am cron — same
    // rationale as DealerScoringService.onApplicationBootstrap.
    const organizationId = await resolveDefaultOrganizationId(this.prisma);
    await TenantContext.run({ organizationId }, () => this.scan());
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM) // after the 2am dealer/customer scoring jobs, see dealer-scoring.service.ts
  async scanCron() {
    const organizationId = await resolveDefaultOrganizationId(this.prisma);
    await TenantContext.run({ organizationId }, () => this.scan());
  }

  /** Idempotent create: skips if an unread notification with the same {organizationId, type,
   * linkRecordId} already exists, so a nightly rescan (or a repeated CRM sync) doesn't spam —
   * but a dismissed/read one can resurface if the underlying problem recurs. */
  async notify(input: NotifyInput): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        organizationId: input.organizationId,
        type: input.type,
        linkRecordId: input.linkRecordId ?? null,
        isRead: false,
      },
      select: { id: true },
    });
    if (existing) return;

    await this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        type: input.type,
        priority: input.priority,
        title: input.title,
        message: input.message,
        linkModule: input.linkModule ?? null,
        linkRecordId: input.linkRecordId ?? null,
        targetRole: input.targetRole ?? null,
      },
    });
  }

  async findAll(user: CurrentUserData, query: NotificationsListQueryDto): Promise<PaginatedResponse<NotificationItem>> {
    const { page, pageSize, isRead } = query;
    const where: Prisma.NotificationWhereInput = {
      ...this.visibilityWhere(user),
      ...(isRead !== undefined ? { isRead } : {}),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return buildPaginatedResponse(notifications.map((n) => this.toItem(n)), total, page, pageSize);
  }

  async getUnreadCount(user: CurrentUserData): Promise<number> {
    return this.prisma.notification.count({ where: { ...this.visibilityWhere(user), isRead: false } });
  }

  async markRead(id: string, user: CurrentUserData): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, ...this.visibilityWhere(user) },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(user: CurrentUserData): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { ...this.visibilityWhere(user), isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  private visibilityWhere(user: CurrentUserData): Prisma.NotificationWhereInput {
    if (SUPERUSER_ROLES.includes(user.roleName)) {
      return { organizationId: user.organizationId };
    }
    return {
      organizationId: user.organizationId,
      OR: [{ userId: user.sub }, { targetRole: user.roleName }],
    };
  }

  private toItem(n: {
    id: string;
    type: NotificationType;
    priority: Priority;
    title: string;
    message: string;
    linkModule: PermissionModule | null;
    linkRecordId: string | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationItem {
    return {
      id: n.id,
      type: n.type,
      priority: n.priority,
      title: n.title,
      message: n.message,
      linkModule: n.linkModule,
      linkRecordId: n.linkRecordId,
      isRead: n.isRead,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }

  private async scan(): Promise<void> {
    const organizationId = TenantContext.get().organizationId;
    try {
      await Promise.all([
        this.scanOverdueLeads(organizationId),
        this.scanDealerRisk(organizationId),
        this.scanStuckProjects(organizationId),
      ]);
      this.logger.log("Notification scan completed");
    } catch (err) {
      this.logger.error(`Notification scan failed: ${String(err)}`, err instanceof Error ? err.stack : undefined);
    }
  }

  // Mirrors LeadsService.countOverdue()'s exact `where` — re-implemented directly here (rather
  // than injecting LeadsService) so NotificationsModule doesn't import LeadsModule, which
  // would create a cycle since LeadsService also needs to call notify() on lead creation.
  private async scanOverdueLeads(organizationId: string): Promise<void> {
    const overdueCount = await this.prisma.lead.count({
      where: {
        nextFollowUpAt: { lt: new Date() },
        OR: [{ statusId: null }, { status: { stage: { notIn: ["WON", "LOST"] } } }],
      },
    });
    if (overdueCount === 0) return;

    await this.notify({
      organizationId,
      type: NotificationType.MISSED_FOLLOW_UP,
      priority: overdueCount > 10 ? Priority.CRITICAL : Priority.HIGH,
      title: `${overdueCount} overdue sales follow-ups`,
      message: "Leads past their next follow-up date",
      linkModule: PermissionModule.LEADS,
      targetRole: RoleName.SALES_MANAGER,
    });
  }

  private async scanDealerRisk(organizationId: string): Promise<void> {
    const riskDealers = await this.dealers.getRiskAlerts();
    for (const d of riskDealers) {
      const isInactive = d.status === "INACTIVE";
      await this.notify({
        organizationId,
        type: isInactive ? NotificationType.INACTIVE_DEALER : NotificationType.DEALER_RISK,
        priority: isInactive ? Priority.HIGH : Priority.MEDIUM,
        title: `${d.name} ${isInactive ? "has gone inactive" : "is becoming inactive"}`,
        message: `${d.city}, ${d.state} · health score ${d.healthScore ?? "—"}`,
        linkModule: PermissionModule.DEALERS,
        linkRecordId: d.id,
        targetRole: RoleName.DEALER_MANAGER,
      });
    }
  }

  private async scanStuckProjects(organizationId: string): Promise<void> {
    const stuckProjects = await this.projects.getStuckProjects();
    for (const p of stuckProjects.filter((p) => p.estimatedValue >= HIGH_VALUE_THRESHOLD)) {
      await this.notify({
        organizationId,
        type: NotificationType.HIGH_VALUE_PROJECT,
        priority: Priority.HIGH,
        title: `${p.name} inactive for ${p.daysInStage} days`,
        message: "High-value project stuck in pipeline",
        linkModule: PermissionModule.PROJECTS,
        linkRecordId: p.id,
        targetRole: RoleName.SALES_MANAGER,
      });
    }
  }
}
