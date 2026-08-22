import { ComponentType } from "react";
import { ProductDrawerContent } from "@/components/products/ProductDrawerContent";
import { DealerDrawerContent } from "@/components/dealers/DealerDrawerContent";
import { CustomerDrawerContent } from "@/components/customers/CustomerDrawerContent";
import { CampaignDrawerContent } from "@/components/marketing/CampaignDrawerContent";
import { LeadDrawerContent } from "@/components/leads/LeadDrawerContent";
import { ProjectDrawerContent } from "@/components/projects/ProjectDrawerContent";
import { QuotationDrawerContent } from "@/components/quotations/QuotationDrawerContent";

/** type -> renderer, keyed to match the string passed to useDrawerStore().open(type, data). */
export const drawerRegistry: Record<string, ComponentType<{ data: any }>> = {
  product: ProductDrawerContent,
  dealer: DealerDrawerContent,
  customer: CustomerDrawerContent,
  campaign: CampaignDrawerContent,
  lead: LeadDrawerContent,
  project: ProjectDrawerContent,
  quotation: QuotationDrawerContent,
};
