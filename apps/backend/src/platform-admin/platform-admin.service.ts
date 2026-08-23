import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { ResetAdminPasswordDto } from "./dto/reset-admin-password.dto";

const PASSWORD_HASH_ROUNDS = 12;

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  userCount: number;
  leadCount: number;
}

export interface CreateOrganizationResult {
  organization: OrganizationSummary;
  adminEmail: string;
  temporaryPassword: string;
}

export interface ResetPasswordResult {
  adminEmail: string;
  temporaryPassword: string;
}

function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}

/** Every method here deliberately operates ACROSS tenant boundaries (listing every org,
 * creating/updating a user in an org that isn't the caller's own) — so this injects the base,
 * unscoped PrismaService, never the org-scope-extended client. Same reasoning as
 * IntegrationConnectionsService.listActive(): the extension would either block these reads
 * (no TenantContext to scope to) or silently misdirect these writes (force organizationId to
 * the *caller's* org instead of the org actually being acted on). */
@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrganizations(): Promise<OrganizationSummary[]> {
    const [organizations, userCounts, leadCounts] = await Promise.all([
      this.prisma.organization.findMany({ orderBy: { createdAt: "asc" } }),
      this.prisma.user.groupBy({ by: ["organizationId"], _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ["organizationId"], _count: { _all: true } }),
    ]);

    const userCountByOrg = new Map(userCounts.map((c) => [c.organizationId, c._count._all]));
    const leadCountByOrg = new Map(leadCounts.map((c) => [c.organizationId, c._count._all]));

    return organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      isActive: org.isActive,
      createdAt: org.createdAt,
      userCount: userCountByOrg.get(org.id) ?? 0,
      leadCount: leadCountByOrg.get(org.id) ?? 0,
    }));
  }

  async createOrganization(dto: CreateOrganizationDto): Promise<CreateOrganizationResult> {
    const existingSlug = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) throw new ConflictException(`Organization slug "${dto.slug}" is already taken`);

    const ownerRole = await this.prisma.role.findFirstOrThrow({ where: { name: RoleName.OWNER } });
    const temporaryPassword = dto.password ?? generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        users: {
          create: {
            email: dto.adminEmail,
            name: dto.adminName,
            passwordHash,
            roleId: ownerRole.id,
          },
        },
      },
    });

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        isActive: organization.isActive,
        createdAt: organization.createdAt,
        userCount: 1,
        leadCount: 0,
      },
      adminEmail: dto.adminEmail,
      temporaryPassword,
    };
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto): Promise<OrganizationSummary> {
    await this.requireOrganization(id);

    if (dto.slug) {
      const existingSlug = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
      if (existingSlug && existingSlug.id !== id) {
        throw new ConflictException(`Organization slug "${dto.slug}" is already taken`);
      }
    }

    await this.prisma.organization.update({
      where: { id },
      data: { name: dto.name, slug: dto.slug },
    });
    return this.toSummary(id);
  }

  async setOrganizationActive(id: string, isActive: boolean, callerOrganizationId: string): Promise<OrganizationSummary> {
    if (id === callerOrganizationId) {
      throw new ForbiddenException("You can't suspend your own organization — you'd lock yourself out");
    }
    await this.requireOrganization(id);
    await this.prisma.organization.update({ where: { id }, data: { isActive } });
    return this.toSummary(id);
  }

  /** Resets the password of that org's OWNER user (there's no per-org user-management screen
   * yet — this targets the admin account created alongside the org, the one case this exists
   * for today: recovering from a lost/never-relayed temporary password). Returns the new
   * temporary password once, same as createOrganization — never stored or logged in plaintext.
   * Blocked for the caller's own organization — resetting your own account this way would log
   * you out with no way back in except another platform admin, and there's normally only one. */
  async resetAdminPassword(id: string, dto: ResetAdminPasswordDto, callerOrganizationId: string): Promise<ResetPasswordResult> {
    if (id === callerOrganizationId) {
      throw new ForbiddenException("You can't reset your own organization's admin password from here");
    }
    await this.requireOrganization(id);

    const admin = await this.prisma.user.findFirst({
      where: { organizationId: id, role: { name: RoleName.OWNER } },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) throw new NotFoundException("This organization has no OWNER user to reset");

    const temporaryPassword = dto.password ?? generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
    await this.prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash, refreshTokenHash: null },
    });

    return { adminEmail: admin.email, temporaryPassword };
  }

  private async requireOrganization(id: string) {
    const existing = await this.prisma.organization.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Organization not found");
    return existing;
  }

  private async toSummary(id: string): Promise<OrganizationSummary> {
    const [organization, userCount, leadCount] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id } }),
      this.prisma.user.count({ where: { organizationId: id } }),
      this.prisma.lead.count({ where: { organizationId: id } }),
    ]);
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      isActive: organization.isActive,
      createdAt: organization.createdAt,
      userCount,
      leadCount,
    };
  }
}
