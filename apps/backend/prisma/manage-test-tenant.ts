/**
 * Dev-only helper for manually verifying tenant isolation (see [[project_saas_multitenant_roadmap]]
 * memory / org-scope.extension.ts): creates or deletes a second Organization + one OWNER user,
 * completely separate from HPL Maker (tenant #1), so you can log in as it and confirm every
 * screen shows zero of HPL Maker's data.
 *
 * Usage:
 *   npm run db:test-tenant:create
 *   npm run db:test-tenant:delete
 */
import { PrismaClient, RoleName } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SLUG = "test-tenant";
const NAME = "Test Tenant";
const EMAIL = "owner@test-tenant.demo";
const PASSWORD = "TestTenant123!";

async function create() {
  const org = await prisma.organization.upsert({
    where: { slug: SLUG },
    update: {},
    create: { slug: SLUG, name: NAME },
  });

  const ownerRole = await prisma.role.findFirstOrThrow({ where: { name: RoleName.OWNER } });
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: EMAIL } },
    update: { passwordHash },
    create: { organizationId: org.id, email: EMAIL, name: "Test Tenant Owner", passwordHash, roleId: ownerRole.id },
  });

  console.log(`Created/updated test tenant "${NAME}" (${org.id})`);
  console.log(`\nLog in with:\n  Email:    ${EMAIL}\n  Password: ${PASSWORD}\n`);
  console.log("Every list/dashboard should show zero data — that's the point. Run");
  console.log("`npm run db:test-tenant:delete` when you're done.");
}

async function del() {
  const org = await prisma.organization.findUnique({ where: { slug: SLUG } });
  if (!org) {
    console.log("No test tenant found — nothing to delete.");
    return;
  }
  // Deliberately narrow: only removes the one user this script creates. If you created other
  // rows under this tenant while testing, the Organization delete below will fail on an FK
  // constraint (Restrict) rather than silently cascading — clean those up first, then re-run.
  await prisma.user.deleteMany({ where: { organizationId: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  console.log(`Deleted test tenant "${NAME}" (${org.id})`);
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "create") return create();
  if (cmd === "delete") return del();
  throw new Error('Usage: ts-node prisma/manage-test-tenant.ts <create|delete>');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
