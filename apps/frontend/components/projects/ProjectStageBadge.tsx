import { ProjectStage } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";

const VARIANT = {
  LEAD: "neutral",
  DISCOVERY: "neutral",
  SAMPLE: "accent",
  DESIGN_APPROVAL: "accent",
  QUOTATION: "accent",
  NEGOTIATION: "warning",
  ORDER: "good",
  COMPLETED: "good",
  LOST: "critical",
} as const;

const LABEL: Record<ProjectStage, string> = {
  LEAD: "Lead",
  DISCOVERY: "Discovery",
  SAMPLE: "Sample",
  DESIGN_APPROVAL: "Design Approval",
  QUOTATION: "Quotation",
  NEGOTIATION: "Negotiation",
  ORDER: "Order",
  COMPLETED: "Completed",
  LOST: "Lost",
};

export function ProjectStageBadge({ stage }: { stage: ProjectStage }) {
  return <Badge variant={VARIANT[stage]}>{LABEL[stage]}</Badge>;
}
