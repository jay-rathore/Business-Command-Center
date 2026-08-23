/**
 * Grants or revokes cross-tenant /platform-admin access for an existing user. There's no
 * self-serve way to do this on purpose — it's meant for the SaaS operator's own account(s)
 * only. See PlatformAdminGuard / User.isPlatformAdmin in schema.prisma.
 *
 * Usage: npm run db:set-platform-admin -- <email> <on|off>
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [email, mode] = process.argv.slice(2);
  if (!email || (mode !== "on" && mode !== "off")) {
    throw new Error("Usage: ts-node prisma/set-platform-admin.ts <email> <on|off>");
  }
  const isPlatformAdmin = mode === "on";

  const candidates = await prisma.user.findMany({ where: { email }, include: { organization: true } });
  if (candidates.length === 0) throw new Error(`No user found with email "${email}"`);
  if (candidates.length > 1) {
    throw new Error(
      `Multiple users share the email "${email}" across different organizations: ` +
        candidates.map((u) => u.organization.name).join(", ") +
        ". Use Prisma Studio to disambiguate by id instead.",
    );
  }

  const user = candidates[0];
  await prisma.user.update({ where: { id: user.id }, data: { isPlatformAdmin } });
  console.log(`${isPlatformAdmin ? "Granted" : "Revoked"} platform admin access for ${email} (${user.organization.name})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
