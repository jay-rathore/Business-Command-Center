import { ProjectCategory, ProjectStage } from "../enums";

export interface ProjectListItem {
  id: string;
  projectCode: string;
  name: string;
  customerName: string | null;
  architectName: string | null;
  builderName: string | null;
  dealerName: string | null;
  salesExecName: string | null;
  city: string;
  state: string;
  category: ProjectCategory;
  typeLabel: string;
  estimatedValue: number;
  weightedValue: number;
  expectedHplQty: number | null;
  stage: ProjectStage;
  probability: number;
  stageSince: string;
  daysInStage: number;
  expectedCloseAt: string | null;
  nextFollowUpAt: string | null;
  lastActivityAt: string | null;
  isStuck: boolean;
  isClosingSoon: boolean;
}

export interface ProjectActivityItem {
  id: string;
  type: string;
  fromStage: ProjectStage | null;
  toStage: ProjectStage | null;
  note: string | null;
  performedByName: string | null;
  occurredAt: string;
}

export interface ProjectDetail extends ProjectListItem {
  notes: string | null;
  activities: ProjectActivityItem[];
}

export interface ProjectsKpis {
  totalProjects: number;
  activePipeline: number;
  pipelineValue: number;
  weightedPipeline: number;
  ordersWon: number;
  winRate: number;
  avgDealSize: number;
  stuckProjects: number;
}

export interface StageDistributionEntry {
  stage: ProjectStage;
  label: string;
  count: number;
  value: number;
}

export interface KanbanColumn {
  stage: ProjectStage;
  label: string;
  totalValue: number;
  projects: ProjectListItem[];
}
