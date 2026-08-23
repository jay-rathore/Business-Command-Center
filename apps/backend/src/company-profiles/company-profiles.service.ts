import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CompanyProfile, CompanyProfileOption } from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext } from "../common/context/tenant-context";
import { UpsertCompanyProfileDto } from "./dto/upsert-company-profile.dto";

@Injectable()
export class CompanyProfilesService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async findAll(): Promise<CompanyProfile[]> {
    const rows = await this.prisma.companyProfile.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(this.toDto);
  }

  /** Slim read used by the Quotations module's picker — active templates only, no bank/GSTIN
   * details, so roles without settings:read can still choose a letterhead when creating a
   * quotation. */
  async findOptions(): Promise<CompanyProfileOption[]> {
    const rows = await this.prisma.companyProfile.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        label: true,
        isDefault: true,
        defaultAdvancePercent: true,
        defaultBeforeDispatchPercent: true,
        defaultTermsAndConditions: true,
        validityDays: true,
      },
    });
    return rows;
  }

  async findOne(id: string): Promise<CompanyProfile> {
    const row = await this.prisma.companyProfile.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Company profile not found");
    return this.toDto(row);
  }

  async create(dto: UpsertCompanyProfileDto): Promise<CompanyProfile> {
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.companyProfile.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.companyProfile.create({ data: { ...dto, organizationId: TenantContext.get().organizationId } });
    });
    return this.toDto(row);
  }

  async update(id: string, dto: UpsertCompanyProfileDto): Promise<CompanyProfile> {
    await this.findOne(id);
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.companyProfile.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.companyProfile.update({ where: { id }, data: dto });
    });
    return this.toDto(row);
  }

  private toDto = (row: {
    id: string;
    label: string;
    isDefault: boolean;
    isActive: boolean;
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    phone: string;
    email: string | null;
    gstin: string;
    logoDataUrl: string | null;
    bankName: string;
    bankAccountNumber: string;
    bankIfsc: string;
    bankSwift: string | null;
    defaultTermsAndConditions: string;
    defaultAdvancePercent: number;
    defaultBeforeDispatchPercent: number;
    validityDays: number;
  }): CompanyProfile => ({
    id: row.id,
    label: row.label,
    isDefault: row.isDefault,
    isActive: row.isActive,
    name: row.name,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    phone: row.phone,
    email: row.email,
    gstin: row.gstin,
    logoDataUrl: row.logoDataUrl,
    bankName: row.bankName,
    bankAccountNumber: row.bankAccountNumber,
    bankIfsc: row.bankIfsc,
    bankSwift: row.bankSwift,
    defaultTermsAndConditions: row.defaultTermsAndConditions,
    defaultAdvancePercent: row.defaultAdvancePercent,
    defaultBeforeDispatchPercent: row.defaultBeforeDispatchPercent,
    validityDays: row.validityDays,
  });
}
