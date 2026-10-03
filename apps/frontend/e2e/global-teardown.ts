import { execFileSync } from "node:child_process";

// Removes the rows the suite creates (test tenants, company profiles, quotations, lead notes) from the
// LOCAL Docker database so repeated runs don't pile junk into the app. Never touches a remote target.
export default function globalTeardown() {
  const base = process.env.BASE_URL ?? "http://localhost:3005";
  if (!/localhost|127\.0\.0\.1/.test(base)) return;

  const sql = `
    begin;
    create temp table _q as select distinct "quotationId" as id from "QuotationItem" where "itemName" in ('E2E HPL Sheet', 'UI E2E Sheet');
    delete from "InvoiceItem" where "invoiceId" in (select id from "Invoice" where "quotationId" in (select id from _q));
    delete from "Invoice" where "quotationId" in (select id from _q);
    delete from "QuotationItem" where "quotationId" in (select id from _q);
    delete from "Quotation" where id in (select id from _q);
    delete from "CompanyProfile" where label like 'E2E %';
    delete from "LeadActivity" where note like 'e2e%';
    create temp table _u as select id from "User" where "organizationId" in (select id from "Organization" where slug like 'e2e-%');
    delete from "Notification" where "userId" in (select id from _u);
    delete from "AuditLog" where "userId" in (select id from _u);
    delete from "SalesExecutive" where "userId" in (select id from _u);
    delete from "User" where id in (select id from _u);
    delete from "Organization" where slug like 'e2e-%';
    commit;`;
  try {
    execFileSync("docker", ["exec", "-i", "hpl-command-center-postgres-1", "sh", "-c", "psql -v ON_ERROR_STOP=1 -q -U $POSTGRES_USER -d $POSTGRES_DB"], {
      input: sql,
      stdio: ["pipe", "ignore", "pipe"],
    });
  } catch (err) {
    console.warn("e2e teardown skipped:", (err as Error).message.split("\n")[0]);
  }
}
