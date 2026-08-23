import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityType, ProjectStage, Prisma } from "@prisma/client";
import {
  KanbanColumn,
  PaginatedResponse,
  ProjectDetail,
  ProjectListItem,
  ProjectsKpis,
  StageDistributionEntry,
} from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext } from "../common/context/tenant-context";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { ProjectsListQueryDto } from "./dto/projects-list-query.dto";
import { UpdateProjectStageDto } from "./dto/update-stage.dto";
import { daysBetween, isProjectClosingSoon, isProjectStuck, weightedValue } from "./project-pipeline.util";

const STAGE_ORDER: { stage: ProjectStage; label: string }[] = [
  { stage: ProjectStage.LEAD, label: "Lead" },
  { stage: ProjectStage.DISCOVERY, label: "Discovery" },
  { stage: ProjectStage.SAMPLE, label: "Sample" },
  { stage: ProjectStage.DESIGN_APPROVAL, label: "Design Approval" },
  { stage: ProjectStage.QUOTATION, label: "Quotation" },
  { stage: ProjectStage.NEGOTIATION, label: "Negotiation" },
  { stage: ProjectStage.ORDER, label: "Order" },
  { stage: ProjectStage.COMPLETED, label: "Completed" },
  { stage: ProjectStage.LOST, label: "Lost" },
];
const OPEN_STAGES = STAGE_ORDER.filter((s) => s.stage !== "COMPLETED" && s.stage !== "LOST").map((s) => s.stage);

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: { customer: true; architect: true; builder: true; dealer: true; salesExec: true };
}>;

@Injectable()
export class ProjectsService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async findAll(query: ProjectsListQueryDto): Promise<PaginatedResponse<ProjectListItem>> {
    const { page, pageSize, sortBy, sortDir, q, stage } = query;

    const where: Prisma.ProjectWhereInput = {
      ...(stage ? { stage } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { projectCode: { contains: q, mode: "insensitive" as const } },
              { city: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: { customer: true, architect: true, builder: true, dealer: true, salesExec: true },
        orderBy: this.mapSort(sortBy, sortDir),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return buildPaginatedResponse(projects.map((p) => this.toListItem(p)), total, page, pageSize);
  }

  async findOne(id: string): Promise<ProjectDetail> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        customer: true,
        architect: true,
        builder: true,
        dealer: true,
        salesExec: true,
        activities: { include: { performedBy: true }, orderBy: { occurredAt: "desc" } },
      },
    });
    if (!project) throw new NotFoundException("Project not found");

    return {
      ...this.toListItem(project),
      notes: project.notes,
      activities: project.activities.map((a) => ({
        id: a.id,
        type: a.type,
        fromStage: a.fromStage,
        toStage: a.toStage,
        note: a.note,
        performedByName: a.performedBy?.name ?? null,
        occurredAt: a.occurredAt.toISOString(),
      })),
    };
  }

  async getKanban(): Promise<KanbanColumn[]> {
    const projects = await this.prisma.project.findMany({
      include: { customer: true, architect: true, builder: true, dealer: true, salesExec: true },
      orderBy: { estimatedValue: "desc" },
    });
    const items = projects.map((p) => this.toListItem(p));

    return STAGE_ORDER.map(({ stage, label }) => {
      const colItems = items.filter((i) => i.stage === stage);
      return {
        stage,
        label,
        totalValue: colItems.reduce((sum, i) => sum + i.estimatedValue, 0),
        projects: colItems,
      };
    });
  }

  async getKpis(): Promise<ProjectsKpis> {
    const projects = await this.prisma.project.findMany();
    const items = projects.map((p) => this.toListItemBase(p));

    const active = items.filter((i) => !["COMPLETED", "LOST"].includes(i.stage));
    const won = items.filter((i) => i.stage === "COMPLETED" || i.stage === "ORDER");
    const decided = items.filter((i) => ["COMPLETED", "ORDER", "LOST"].includes(i.stage));
    const pipelineValue = active.reduce((sum, i) => sum + i.estimatedValue, 0);
    const weightedPipeline = active.reduce((sum, i) => sum + i.weightedValue, 0);
    const stuckCount = active.filter((i) => i.isStuck).length;

    return {
      totalProjects: items.length,
      activePipeline: active.length,
      pipelineValue,
      weightedPipeline,
      ordersWon: won.length,
      winRate: decided.length > 0 ? (won.length / decided.length) * 100 : 0,
      avgDealSize: items.length > 0 ? items.reduce((sum, i) => sum + i.estimatedValue, 0) / items.length : 0,
      stuckProjects: stuckCount,
    };
  }

  async getStageDistribution(): Promise<StageDistributionEntry[]> {
    const projects = await this.prisma.project.findMany();
    const items = projects.map((p) => this.toListItemBase(p));

    return STAGE_ORDER.map(({ stage, label }) => {
      const inStage = items.filter((i) => i.stage === stage);
      return { stage, label, count: inStage.length, value: inStage.reduce((sum, i) => sum + i.estimatedValue, 0) };
    });
  }

  async getStuckProjects(): Promise<ProjectListItem[]> {
    const projects = await this.prisma.project.findMany({
      where: { stage: { in: OPEN_STAGES } },
      include: { customer: true, architect: true, builder: true, dealer: true, salesExec: true },
    });
    return projects.map((p) => this.toListItem(p)).filter((p) => p.isStuck).sort((a, b) => b.daysInStage - a.daysInStage);
  }

  async getClosingSoon(): Promise<ProjectListItem[]> {
    const projects = await this.prisma.project.findMany({
      where: { stage: { in: OPEN_STAGES }, expectedCloseAt: { not: null } },
      include: { customer: true, architect: true, builder: true, dealer: true, salesExec: true },
    });
    return projects
      .map((p) => this.toListItem(p))
      .filter((p) => p.isClosingSoon)
      .sort((a, b) => new Date(a.expectedCloseAt!).getTime() - new Date(b.expectedCloseAt!).getTime());
  }

  async updateStage(id: string, dto: UpdateProjectStageDto): Promise<ProjectDetail> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project not found");

    const now = new Date();
    await this.prisma.projectActivity.create({
      data: {
        organizationId: TenantContext.get().organizationId,
        projectId: id,
        type: ActivityType.STATUS_CHANGE,
        fromStage: project.stage,
        toStage: dto.toStage,
        note: dto.note,
        occurredAt: now,
      },
    });

    await this.prisma.project.update({
      where: { id },
      data: { stage: dto.toStage, stageSince: now, lastActivityAt: now },
    });

    return this.findOne(id);
  }

  private mapSort(sortBy: string | undefined, sortDir: "asc" | "desc"): Prisma.ProjectOrderByWithRelationInput {
    switch (sortBy) {
      case "estimatedValue":
        return { estimatedValue: sortDir };
      case "probability":
        return { probability: sortDir };
      case "expectedCloseAt":
        return { expectedCloseAt: sortDir };
      case "stageSince":
        return { stageSince: sortDir };
      case "name":
      default:
        return { name: sortDir };
    }
  }

  private toListItemBase(project: Prisma.ProjectGetPayload<object>) {
    const now = new Date();
    const estimatedValue = Number(project.estimatedValue);
    const daysInStage = daysBetween(project.stageSince, now);
    const daysToClose = project.expectedCloseAt ? daysBetween(now, project.expectedCloseAt) : null;

    return {
      stage: project.stage,
      estimatedValue,
      weightedValue: weightedValue(estimatedValue, project.probability),
      daysInStage,
      isStuck: isProjectStuck(project.stage, daysInStage),
      isClosingSoon: isProjectClosingSoon(project.stage, daysToClose),
    };
  }

  private toListItem(project: ProjectWithRelations): ProjectListItem {
    const base = this.toListItemBase(project);
    return {
      id: project.id,
      projectCode: project.projectCode,
      name: project.name,
      customerName: project.customer?.name ?? null,
      architectName: project.architect?.name ?? null,
      builderName: project.builder?.name ?? null,
      dealerName: project.dealer?.name ?? null,
      salesExecName: project.salesExec?.name ?? null,
      city: project.city,
      state: project.state,
      category: project.category,
      typeLabel: project.typeLabel,
      estimatedValue: base.estimatedValue,
      weightedValue: base.weightedValue,
      expectedHplQty: project.expectedHplQty,
      stage: project.stage,
      probability: project.probability,
      stageSince: project.stageSince.toISOString(),
      daysInStage: base.daysInStage,
      expectedCloseAt: project.expectedCloseAt?.toISOString() ?? null,
      nextFollowUpAt: project.nextFollowUpAt?.toISOString() ?? null,
      lastActivityAt: project.lastActivityAt?.toISOString() ?? null,
      isStuck: base.isStuck,
      isClosingSoon: base.isClosingSoon,
    };
  }
}
