import {
  ActivityType,
  CampaignPlatform,
  CampaignStatus,
  CustomerType,
  DealerStatus,
  OrderStatus,
  Prisma,
  PrismaClient,
  ProjectCategory,
  ProjectStage,
  RoleName,
  SalesTargetScope,
  TargetPeriodType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ROLE_PERMISSION_MATRIX, expandActions, permissionCode } from '../src/rbac/role-permission-matrix';
import { computeLeadScore } from '../src/leads/lead-scoring.util';

// A bare, unextended PrismaClient — the org-scope Prisma extension (see
// src/prisma/org-scope.extension.ts) reads the current tenant from AsyncLocalStorage, which
// only exists inside an HTTP request; a one-off seed script has no request, so every call
// below sets `organizationId` explicitly instead of relying on that extension.
const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Passw0rd!123';

const ORG_SLUG = 'hpl-maker';
const ORG_NAME = 'HPL Maker';

// Fixed-seed PRNG (mulberry32) so re-seeding produces the same "random" demo dataset —
// reproducible without hand-typing every row.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260819);
function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function randChoice<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function randWeighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [value, weight] of entries) {
    if (r < weight) return value;
    r -= weight;
  }
  return entries[entries.length - 1][0];
}
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// HPL Maker is tenant #1 — see [[project_saas_multitenant_roadmap]]. Every other seed
// function below takes organizationId and stamps it onto every row it creates.
async function seedOrganization(): Promise<string> {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: ORG_NAME },
    create: { slug: ORG_SLUG, name: ORG_NAME },
  });
  console.log(`Seeded organization "${org.name}" (${org.id})`);
  return org.id;
}

const DEMO_USERS: { email: string; name: string; role: RoleName; designation?: string }[] = [
  { email: 'owner@hplmaker.demo', name: 'Rajesh Kulkarni', role: RoleName.OWNER },
  { email: 'admin@hplmaker.demo', name: 'System Admin', role: RoleName.ADMIN },
  { email: 'sales.manager@hplmaker.demo', name: 'Meera Iyer', role: RoleName.SALES_MANAGER },
  {
    email: 'sales.exec@hplmaker.demo',
    name: 'Ananya Deshpande',
    role: RoleName.SALES_EXECUTIVE,
    designation: 'Senior Sales Executive',
  },
  { email: 'marketing@hplmaker.demo', name: 'Farhan Sheikh', role: RoleName.MARKETING_MANAGER },
  { email: 'dealer.manager@hplmaker.demo', name: 'Karan Malhotra', role: RoleName.DEALER_MANAGER },
];

// Roles/Permissions are global system RBAC, shared across all tenants — not org-scoped.
async function seedRolesAndPermissions(): Promise<Map<RoleName, string>> {
  const roleIdByName = new Map<RoleName, string>();

  for (const roleName of Object.keys(ROLE_PERMISSION_MATRIX) as RoleName[]) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    roleIdByName.set(roleName, role.id);
  }

  for (const [roleName, specs] of Object.entries(ROLE_PERMISSION_MATRIX) as [RoleName, (typeof ROLE_PERMISSION_MATRIX)[RoleName]][]) {
    const roleId = roleIdByName.get(roleName)!;

    for (const spec of specs) {
      for (const action of expandActions(spec.actions)) {
        const code = permissionCode(spec.module, action);
        const permission = await prisma.permission.upsert({
          where: { code },
          update: {},
          create: { code, module: spec.module, action },
        });

        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: permission.id } },
          update: {},
          create: { roleId, permissionId: permission.id },
        });
      }
    }
  }

  console.log(`Seeded ${roleIdByName.size} roles + permission matrix`);
  return roleIdByName;
}

async function seedUsers(organizationId: string, roleIdByName: Map<RoleName, string>) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const demoUser of DEMO_USERS) {
    const roleId = roleIdByName.get(demoUser.role);
    if (!roleId) throw new Error(`Role not seeded: ${demoUser.role}`);

    const user = await prisma.user.upsert({
      where: { organizationId_email: { organizationId, email: demoUser.email } },
      update: { name: demoUser.name, roleId },
      create: {
        organizationId,
        email: demoUser.email,
        name: demoUser.name,
        passwordHash,
        roleId,
      },
    });

    if (demoUser.role === RoleName.SALES_EXECUTIVE) {
      await prisma.salesExecutive.upsert({
        where: { userId: user.id },
        update: { name: demoUser.name, designation: demoUser.designation ?? 'Sales Executive' },
        create: {
          organizationId,
          employeeCode: 'EMP-001',
          userId: user.id,
          name: demoUser.name,
          email: demoUser.email,
          designation: demoUser.designation ?? 'Sales Executive',
          hireDate: new Date('2023-06-01'),
        },
      });
    }
  }

  console.log(`Seeded ${DEMO_USERS.length} demo users`);
}

const PRODUCT_CATEGORIES = ['Interior HPL', 'Exterior Cladding', 'Compact Laminate', 'Bathroom Cubicle'] as const;

const PRODUCT_SHADES: { name: string; design: string }[] = [
  { name: 'Walnut Brown', design: 'Wood Grain' },
  { name: 'Rustic Teak', design: 'Wood Grain' },
  { name: 'Golden Oak', design: 'Wood Grain' },
  { name: 'Rosewood Grain', design: 'Wood Grain' },
  { name: 'Ivory Matte', design: 'Solid Matte' },
  { name: 'Charcoal Grey', design: 'Solid Matte' },
  { name: 'Graphite Solid', design: 'Solid Matte' },
  { name: 'Onyx Black Marble', design: 'Marble Finish' },
  { name: 'Carrara White Marble', design: 'Marble Finish' },
  { name: 'Slate Stone', design: 'Stone Finish' },
  { name: 'Sandstone Beige', design: 'Stone Finish' },
  { name: 'Pearl White', design: 'Solid Gloss' },
  { name: 'Arctic White', design: 'Solid Gloss' },
  { name: 'Mahogany Red', design: 'Solid Textured' },
  { name: 'Forest Green', design: 'Solid Textured' },
  { name: 'Copper Metallic', design: 'Solid Metallic' },
  { name: 'Silver Streak', design: 'Solid Metallic' },
  { name: 'Terracotta Weave', design: 'Digital Print' },
];

// (category, shadeName, code, unitPrice) — 28 SKUs, realistic HPL sheet pricing in INR/sheet.
const PRODUCT_CATALOG: { category: (typeof PRODUCT_CATEGORIES)[number]; shade: string; code: string; unitPrice: number }[] = [
  { category: 'Interior HPL', shade: 'Walnut Brown', code: '6013', unitPrice: 1250 },
  { category: 'Interior HPL', shade: 'Rustic Teak', code: '6021', unitPrice: 1320 },
  { category: 'Interior HPL', shade: 'Golden Oak', code: '6034', unitPrice: 1180 },
  { category: 'Interior HPL', shade: 'Rosewood Grain', code: '6047', unitPrice: 1290 },
  { category: 'Interior HPL', shade: 'Ivory Matte', code: '6102', unitPrice: 980 },
  { category: 'Interior HPL', shade: 'Charcoal Grey', code: '6115', unitPrice: 1010 },
  { category: 'Interior HPL', shade: 'Graphite Solid', code: '6128', unitPrice: 1040 },
  { category: 'Interior HPL', shade: 'Pearl White', code: '6201', unitPrice: 1100 },
  { category: 'Interior HPL', shade: 'Terracotta Weave', code: '6310', unitPrice: 1450 },
  { category: 'Interior HPL', shade: 'Mahogany Red', code: '6322', unitPrice: 1360 },
  { category: 'Interior HPL', shade: 'Forest Green', code: '6335', unitPrice: 1340 },
  { category: 'Exterior Cladding', shade: 'Onyx Black Marble', code: '7014', unitPrice: 2450 },
  { category: 'Exterior Cladding', shade: 'Carrara White Marble', code: '7027', unitPrice: 2520 },
  { category: 'Exterior Cladding', shade: 'Slate Stone', code: '7041', unitPrice: 2380 },
  { category: 'Exterior Cladding', shade: 'Sandstone Beige', code: '7053', unitPrice: 2290 },
  { category: 'Exterior Cladding', shade: 'Charcoal Grey', code: '7066', unitPrice: 2410 },
  { category: 'Exterior Cladding', shade: 'Copper Metallic', code: '7078', unitPrice: 2680 },
  { category: 'Exterior Cladding', shade: 'Silver Streak', code: '7091', unitPrice: 2650 },
  { category: 'Compact Laminate', shade: 'Ivory Matte', code: '8103', unitPrice: 3150 },
  { category: 'Compact Laminate', shade: 'Charcoal Grey', code: '8117', unitPrice: 3220 },
  { category: 'Compact Laminate', shade: 'Walnut Brown', code: '8129', unitPrice: 3280 },
  { category: 'Compact Laminate', shade: 'Graphite Solid', code: '8142', unitPrice: 3190 },
  { category: 'Compact Laminate', shade: 'Slate Stone', code: '8155', unitPrice: 3340 },
  { category: 'Compact Laminate', shade: 'Arctic White', code: '8168', unitPrice: 3120 },
  { category: 'Bathroom Cubicle', shade: 'Pearl White', code: '9021', unitPrice: 2850 },
  { category: 'Bathroom Cubicle', shade: 'Arctic White', code: '9034', unitPrice: 2790 },
  { category: 'Bathroom Cubicle', shade: 'Charcoal Grey', code: '9047', unitPrice: 2920 },
  { category: 'Bathroom Cubicle', shade: 'Sandstone Beige', code: '9059', unitPrice: 2870 },
];

async function seedProductCatalog(organizationId: string) {
  const categoryIdByName = new Map<string, string>();
  for (const name of PRODUCT_CATEGORIES) {
    const category = await prisma.productCategory.upsert({
      where: { organizationId_name: { organizationId, name } },
      update: {},
      create: { organizationId, name },
    });
    categoryIdByName.set(name, category.id);
  }

  const shadeIdByName = new Map<string, string>();
  for (const shade of PRODUCT_SHADES) {
    const row = await prisma.productShade.upsert({
      where: { organizationId_name: { organizationId, name: shade.name } },
      update: {},
      create: { organizationId, name: shade.name },
    });
    shadeIdByName.set(shade.name, row.id);
  }

  for (const entry of PRODUCT_CATALOG) {
    const shadeDesign = PRODUCT_SHADES.find((s) => s.name === entry.shade)!.design;
    const sku = `${entry.code} · ${entry.shade}`;
    await prisma.product.upsert({
      where: { organizationId_sku: { organizationId, sku } },
      update: {},
      create: {
        organizationId,
        sku,
        name: `${entry.shade} — ${entry.category}`,
        categoryId: categoryIdByName.get(entry.category)!,
        shadeId: shadeIdByName.get(entry.shade)!,
        design: shadeDesign,
        unitPrice: entry.unitPrice,
      },
    });
  }

  console.log(
    `Seeded ${PRODUCT_CATEGORIES.length} product categories, ${PRODUCT_SHADES.length} shades, ${PRODUCT_CATALOG.length} SKUs`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// M4 — Sales executives, Dealers, Customers, Orders, Sales Targets
// ─────────────────────────────────────────────────────────────────────────

const STATE_CITIES: Record<string, string[]> = {
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur'],
  Rajasthan: ['Jaipur', 'Udaipur', 'Jodhpur'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Hubli'],
  Telangana: ['Hyderabad', 'Warangal'],
  Delhi: ['New Delhi', 'Gurugram', 'Noida'],
};
const STATES = Object.keys(STATE_CITIES);
function randomLocation() {
  const state = randChoice(STATES);
  const city = randChoice(STATE_CITIES[state]);
  return { state, city };
}

const CONTACT_FIRST_NAMES = [
  'Imran', 'Vikram', 'Sanjay', 'Ramesh', 'Suresh', 'Deepak', 'Anil', 'Manoj', 'Rajiv', 'Ashok',
  'Nitin', 'Alok', 'Pankaj', 'Rakesh', 'Vivek', 'Amit', 'Sunil', 'Girish', 'Naresh', 'Yogesh',
  'Kavita', 'Sunita', 'Rekha', 'Pooja', 'Neha', 'Divya', 'Shweta',
];
const CONTACT_LAST_NAMES = [
  'Qureshi', 'Sanghvi', 'Deshmukh', 'Patil', 'Sharma', 'Verma', 'Gupta', 'Agarwal', 'Mehta', 'Shah',
  'Joshi', 'Kulkarni', 'Rao', 'Reddy', 'Nair', 'Iyer', 'Chauhan', 'Bhatt', 'Trivedi', 'Kapoor',
];
function randomContactName(): string {
  return `${randChoice(CONTACT_FIRST_NAMES)} ${randChoice(CONTACT_LAST_NAMES)}`;
}

const DEALER_PREFIXES = ['Shree Balaji', 'New Ganesh', 'Royal', 'Deluxe', 'Prime', 'National', 'City', 'Metro', 'United', 'Om Sai', 'Laxmi', 'Vishal', 'Sunrise', 'Malwa', 'Golden'];
const DEALER_SUFFIXES = ['Plywood & Laminates', 'Laminate House', 'Interiors & Décor', 'Building Materials', 'Timber & Laminates', 'Home Solutions', 'Plywood Traders', 'Laminate Gallery', 'Interior Hub', 'Trading Co.'];

async function seedSalesExecutives(organizationId: string): Promise<string[]> {
  const roster: { employeeCode: string; name: string; designation: string; state: string }[] = [
    { employeeCode: 'EMP-002', name: 'Rohit Verma', designation: 'Sales Executive', state: 'Maharashtra' },
    { employeeCode: 'EMP-003', name: 'Priya Nair', designation: 'Sales Executive', state: 'Karnataka' },
    { employeeCode: 'EMP-004', name: 'Saurabh Joshi', designation: 'Sales Executive', state: 'Madhya Pradesh' },
    { employeeCode: 'EMP-005', name: 'Vikram Chauhan', designation: 'Sales Executive', state: 'Rajasthan' },
  ];

  const ids: string[] = [];
  const existing = await prisma.salesExecutive.findUnique({
    where: { organizationId_employeeCode: { organizationId, employeeCode: 'EMP-001' } },
  });
  if (existing) ids.push(existing.id);

  for (const exec of roster) {
    const row = await prisma.salesExecutive.upsert({
      where: { organizationId_employeeCode: { organizationId, employeeCode: exec.employeeCode } },
      update: {},
      create: {
        organizationId,
        employeeCode: exec.employeeCode,
        name: exec.name,
        designation: exec.designation,
        state: exec.state,
        hireDate: daysAgo(randInt(200, 1200)),
      },
    });
    ids.push(row.id);
  }

  console.log(`Seeded ${roster.length} additional sales executives (${ids.length} total)`);
  return ids;
}

async function seedDealers(organizationId: string, execIds: string[]): Promise<string[]> {
  const statusPool: [DealerStatus, number][] = [
    [DealerStatus.ACTIVE, 60],
    [DealerStatus.NEW, 15],
    [DealerStatus.AT_RISK, 15],
    [DealerStatus.INACTIVE, 10],
  ];

  const ids: string[] = [];
  for (let i = 0; i < 30; i++) {
    const { state, city } = randomLocation();
    const name = `${randChoice(DEALER_PREFIXES)} ${randChoice(DEALER_SUFFIXES)}`;
    const dealerCode = `DL-${101 + i}`;
    const status = randWeighted(statusPool);

    const dealer = await prisma.dealer.upsert({
      where: { organizationId_dealerCode: { organizationId, dealerCode } },
      update: {},
      create: {
        organizationId,
        dealerCode,
        name: `${name} — ${city}`,
        contactName: randomContactName(),
        phone: `+91 ${randInt(70000, 99999)}${randInt(10000, 99999)}`,
        email: null,
        city,
        state,
        status,
        assignedManagerId: randChoice(execIds),
        joinedAt: daysAgo(randInt(60, 1100)),
      },
    });
    ids.push(dealer.id);
  }

  console.log(`Seeded ${ids.length} dealers`);
  return ids;
}

const CUSTOMER_COMPANY_SUFFIXES = ['Interiors Pvt Ltd', 'Modular Homes', 'Design Studio', 'Constructions', 'Realty Group', 'Developers', 'Interiors & Modular', 'Buildcon'];

async function seedCustomers(organizationId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < 40; i++) {
    const { state, city } = randomLocation();
    const type = randWeighted<CustomerType>([
      [CustomerType.INDIVIDUAL, 55],
      [CustomerType.BUSINESS, 40],
      [CustomerType.DEALER_SELF, 5],
    ]);
    const name = randomContactName();
    const customerCode = `CUS-${1001 + i}`;

    const customer = await prisma.customer.upsert({
      where: { organizationId_customerCode: { organizationId, customerCode } },
      update: {},
      create: {
        organizationId,
        customerCode,
        name,
        companyName: type === 'INDIVIDUAL' ? null : `${name.split(' ')[1]} ${randChoice(CUSTOMER_COMPANY_SUFFIXES)}`,
        phone: `+91 ${randInt(70000, 99999)}${randInt(10000, 99999)}`,
        email: null,
        type,
        city,
        state,
      },
    });
    ids.push(customer.id);
  }

  console.log(`Seeded ${ids.length} customers`);
  return ids;
}

async function seedOrders(organizationId: string, execIds: string[], dealerIds: string[], customerIds: string[]) {
  const products = await prisma.product.findMany({ where: { organizationId } });
  if (products.length === 0) throw new Error('Product catalog must be seeded before orders');

  const existingOrders = await prisma.order.count({ where: { organizationId } });
  if (existingOrders > 0) {
    console.log(`Orders already seeded (${existingOrders} rows) — skipping`);
    return;
  }

  const ORDER_COUNT = 500;
  let created = 0;

  for (let i = 0; i < ORDER_COUNT; i++) {
    const orderDate = daysAgo(randInt(0, 330));
    const viaDealer = rng() < 0.65; // 65% of orders flow through a dealer, 35% direct-to-customer
    const dealerId = viaDealer ? randChoice(dealerIds) : null;
    const customerId = !viaDealer || rng() < 0.3 ? randChoice(customerIds) : null;
    const salesExecId = randChoice(execIds);
    const { state, city } = randomLocation();

    const itemCount = randInt(1, 3);
    const chosenProducts = new Set<string>();
    while (chosenProducts.size < itemCount) chosenProducts.add(randChoice(products).id);

    const items = Array.from(chosenProducts).map((productId) => {
      const product = products.find((p) => p.id === productId)!;
      const quantity = randInt(20, 180);
      const unitPrice = Number(product.unitPrice);
      const lineTotal = quantity * unitPrice;
      return { organizationId, productId, quantity, unitPrice, lineTotal };
    });

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const discountAmount = rng() < 0.2 ? Math.round(subtotal * 0.05) : 0;
    const totalAmount = subtotal - discountAmount;

    await prisma.order.create({
      data: {
        organizationId,
        orderCode: `ORD-${10000 + i}`,
        customerId,
        dealerId,
        salesExecId,
        status: randWeighted<OrderStatus>([
          [OrderStatus.DELIVERED, 70],
          [OrderStatus.DISPATCHED, 15],
          [OrderStatus.CONFIRMED, 10],
          [OrderStatus.PENDING, 3],
          [OrderStatus.CANCELLED, 2],
        ]),
        orderDate,
        dispatchedAt: rng() < 0.9 ? new Date(orderDate.getTime() + randInt(1, 5) * 86400000) : null,
        deliveredAt: rng() < 0.75 ? new Date(orderDate.getTime() + randInt(3, 10) * 86400000) : null,
        subtotal,
        discountAmount,
        totalAmount,
        state,
        city,
        items: { create: items },
      },
    });
    created++;
  }

  console.log(`Seeded ${created} orders with line items`);
}

async function seedSalesTargets(organizationId: string, execIds: string[]) {
  const existing = await prisma.salesTarget.count({ where: { organizationId } });
  if (existing > 0) {
    console.log(`Sales targets already seeded (${existing} rows) — skipping`);
    return;
  }

  const now = new Date();
  let created = 0;

  // Company-wide monthly targets: trailing 6 months + current month.
  // Calibrated against actual seeded order volume (~500 orders / ~11 months, ~1.5-2.4Cr/month)
  // so achievement% lands in a realistic ~80-120% band rather than wildly over/under target.
  for (let m = 6; m >= 0; m--) {
    const periodStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59);
    await prisma.salesTarget.create({
      data: {
        organizationId,
        scope: SalesTargetScope.COMPANY,
        periodType: TargetPeriodType.MONTHLY,
        periodStart,
        periodEnd,
        targetRevenue: randInt(17000000, 21000000),
        targetOrders: randInt(40, 55),
      },
    });
    created++;
  }

  // Per-executive monthly targets: trailing 3 months for each of the 5 execs.
  for (const execId of execIds) {
    for (let m = 3; m >= 0; m--) {
      const periodStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59);
      await prisma.salesTarget.create({
        data: {
          organizationId,
          scope: SalesTargetScope.SALES_EXECUTIVE,
          salesExecutiveId: execId,
          periodType: TargetPeriodType.MONTHLY,
          periodStart,
          periodEnd,
          targetRevenue: randInt(3200000, 4200000),
          targetOrders: randInt(8, 12),
        },
      });
      created++;
    }
  }

  console.log(`Seeded ${created} sales targets`);
}

// ─────────────────────────────────────────────────────────────────────────
// M5b — Marketing campaigns (placeholder channels only — META_ADS is populated exclusively by
// the real meta-ads-sync service, never seeded, so there's no collision between fabricated and
// live rows).
// ─────────────────────────────────────────────────────────────────────────

const MARKETING_CAMPAIGNS: {
  name: string;
  platform: CampaignPlatform;
  status: CampaignStatus;
  spend: number;
  leadsCount: number;
  revenue: number;
  daysAgoStart: number;
  daysAgoEnd: number | null; // null = still running
  notes?: string;
}[] = [
  // revenue is tuned to keep ROAS in a believable ~2-6x band for spend > 0 rows — early drafts
  // implied 50-60x on some WhatsApp rows, which would undermine the whole demo's credibility.
  { name: 'Google Search — HPL Cladding', platform: CampaignPlatform.GOOGLE_ADS, status: CampaignStatus.ACTIVE, spend: 42500, leadsCount: 118, revenue: 263500, daysAgoStart: 60, daysAgoEnd: null },
  { name: 'Google Search — Interior Laminates', platform: CampaignPlatform.GOOGLE_ADS, status: CampaignStatus.ACTIVE, spend: 28900, leadsCount: 76, revenue: 167600, daysAgoStart: 45, daysAgoEnd: null },
  { name: 'Google Display — Retargeting', platform: CampaignPlatform.GOOGLE_ADS, status: CampaignStatus.PAUSED, spend: 15200, leadsCount: 31, revenue: 65000, daysAgoStart: 90, daysAgoEnd: 20 },
  { name: 'Website Direct Inquiries', platform: CampaignPlatform.WEBSITE, status: CampaignStatus.ACTIVE, spend: 0, leadsCount: 94, revenue: 587000, daysAgoStart: 180, daysAgoEnd: null, notes: 'Organic website contact-form submissions, no ad spend.' },
  { name: 'Landing Page — Compact Laminate', platform: CampaignPlatform.WEBSITE, status: CampaignStatus.ACTIVE, spend: 0, leadsCount: 37, revenue: 214000, daysAgoStart: 75, daysAgoEnd: null },
  { name: 'WhatsApp Broadcast — Festive Offer', platform: CampaignPlatform.WHATSAPP, status: CampaignStatus.ENDED, spend: 3200, leadsCount: 52, revenue: 14500, daysAgoStart: 40, daysAgoEnd: 25 },
  { name: 'WhatsApp Catalog Outreach', platform: CampaignPlatform.WHATSAPP, status: CampaignStatus.ACTIVE, spend: 1800, leadsCount: 29, revenue: 7400, daysAgoStart: 30, daysAgoEnd: null },
  { name: 'Organic — Instagram', platform: CampaignPlatform.ORGANIC, status: CampaignStatus.ACTIVE, spend: 0, leadsCount: 64, revenue: 267000, daysAgoStart: 200, daysAgoEnd: null },
  { name: 'Organic — Facebook Page', platform: CampaignPlatform.ORGANIC, status: CampaignStatus.ACTIVE, spend: 0, leadsCount: 41, revenue: 158000, daysAgoStart: 200, daysAgoEnd: null },
  { name: 'Organic — YouTube', platform: CampaignPlatform.ORGANIC, status: CampaignStatus.ACTIVE, spend: 0, leadsCount: 18, revenue: 72000, daysAgoStart: 150, daysAgoEnd: null },
  { name: 'Trade Show — Mumbai Expo', platform: CampaignPlatform.OTHER, status: CampaignStatus.ENDED, spend: 185000, leadsCount: 63, revenue: 535000, daysAgoStart: 70, daysAgoEnd: 65 },
  { name: 'Referral Program', platform: CampaignPlatform.OTHER, status: CampaignStatus.ACTIVE, spend: 25000, leadsCount: 22, revenue: 130000, daysAgoStart: 250, daysAgoEnd: null, notes: 'Cash incentive paid to dealers/customers for successful referrals.' },
  { name: 'Print Ads — Local Newspaper', platform: CampaignPlatform.OTHER, status: CampaignStatus.PAUSED, spend: 38000, leadsCount: 14, revenue: 87000, daysAgoStart: 100, daysAgoEnd: 55 },
];

async function seedMarketingCampaigns(organizationId: string) {
  const existing = await prisma.marketingCampaign.count({ where: { organizationId, metaCampaignId: null } });
  if (existing > 0) {
    console.log(`Marketing campaigns already seeded (${existing} placeholder rows) — skipping`);
    return;
  }

  for (const entry of MARKETING_CAMPAIGNS) {
    await prisma.marketingCampaign.create({
      data: {
        organizationId,
        name: entry.name,
        platform: entry.platform,
        status: entry.status,
        spend: entry.spend,
        leadsCount: entry.leadsCount,
        revenue: entry.revenue,
        startDate: daysAgo(entry.daysAgoStart),
        endDate: entry.daysAgoEnd !== null ? daysAgo(entry.daysAgoEnd) : null,
        notes: entry.notes ?? null,
      },
    });
  }

  console.log(`Seeded ${MARKETING_CAMPAIGNS.length} placeholder marketing campaigns (Google Ads/Website/WhatsApp/Organic/Other — Meta Ads comes from the real sync)`);
}

const TRAFFIC_INTEL_DAYS = 60;
// Days-ago markers for the two deliberate, demoable stories: a Meta pause causing a traffic dip,
// and a Google Ads budget increase causing a traffic spike — see Traffic Intelligence plan §6.
const DIP_EVENT_DAYS_AGO = 14; // campaign paused
const DIP_VISIBLE_DAYS_AGO = 13; // traffic drop shows up the next day, once the pause has propagated
const SPIKE_EVENT_DAYS_AGO = 5; // budget increased
const SPIKE_VISIBLE_DAYS_AGO = 4;

async function seedTrafficIntelligence(organizationId: string) {
  const existingDays = await prisma.websiteAnalyticsDaily.count({ where: { organizationId } });
  if (existingDays > 0) {
    console.log('Website analytics already has data (real GA4 sync or prior seed) — skipping Traffic Intelligence demo seed');
    return;
  }

  const pausedCampaign = await prisma.marketingCampaign.create({
    data: {
      organizationId,
      name: 'Meta Campaign — Monsoon Push',
      platform: CampaignPlatform.META_ADS,
      status: CampaignStatus.PAUSED,
      spend: 62000,
      leadsCount: 145,
      revenue: 0, // real-spend Meta rows never carry fabricated revenue, see marketing.service.ts
      impressions: 410000,
      clicks: 9800,
      ctr: 2.39,
      avgCpc: 6.3,
      startDate: daysAgo(45),
      endDate: null,
      notes: 'Paused mid-campaign — see CampaignEvent history for the Traffic Intelligence demo.',
    },
  });
  const budgetIncreasedCampaign = await prisma.marketingCampaign.create({
    data: {
      organizationId,
      name: 'Google Ads — Diwali Surge',
      platform: CampaignPlatform.GOOGLE_ADS,
      status: CampaignStatus.ACTIVE,
      spend: 71000,
      leadsCount: 203,
      revenue: 0,
      impressions: 520000,
      clicks: 14200,
      ctr: 2.73,
      avgCpc: 5.0,
      dailyBudget: 4000,
      startDate: daysAgo(40),
      endDate: null,
      notes: 'Budget increased mid-campaign — see CampaignEvent history for the Traffic Intelligence demo.',
    },
  });

  await prisma.campaignEvent.create({
    data: {
      organizationId,
      campaignId: pausedCampaign.id,
      field: 'status',
      oldValue: 'ACTIVE',
      newValue: 'PAUSED',
      detectedAt: daysAgo(DIP_EVENT_DAYS_AGO),
    },
  });
  await prisma.campaignEvent.create({
    data: {
      organizationId,
      campaignId: budgetIncreasedCampaign.id,
      field: 'dailyBudget',
      oldValue: '1500',
      newValue: '4000',
      detectedAt: daysAgo(SPIKE_EVENT_DAYS_AGO),
    },
  });

  const websiteDaily: Prisma.WebsiteAnalyticsDailyCreateManyInput[] = [];
  const channelDaily: Prisma.WebsiteChannelDailyCreateManyInput[] = [];
  const searchDaily: Prisma.SearchConsoleDailyCreateManyInput[] = [];
  const landingPageDaily: Prisma.WebsiteLandingPageDailyCreateManyInput[] = [];
  const metaDaily: Prisma.AdPlatformDailyMetricCreateManyInput[] = [];
  const googleDaily: Prisma.AdPlatformDailyMetricCreateManyInput[] = [];

  for (let d = TRAFFIC_INTEL_DAYS - 1; d >= 0; d--) {
    const date = daysAgo(d);
    const weekday = date.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;

    const pausedNow = d <= DIP_VISIBLE_DAYS_AGO; // Meta campaign stays paused from that point on
    const budgetBoostedNow = d <= SPIKE_VISIBLE_DAYS_AGO; // Google budget stays up from that point on

    const baseSessions = (isWeekend ? 620 : 820) + randInt(-40, 40);
    const paidSocialSessions = pausedNow ? randInt(15, 40) : randInt(180, 240);
    const paidSearchSessions = budgetBoostedNow ? randInt(320, 400) : randInt(130, 180);
    const organicSessions = (isWeekend ? 260 : 340) + randInt(-25, 25);
    const directSessions = 120 + randInt(-15, 15);
    const referralSessions = 60 + randInt(-10, 10);

    const totalSessions = organicSessions + paidSocialSessions + paidSearchSessions + directSessions + referralSessions;
    const activeUsers = Math.round(totalSessions * 0.82);
    const newUsers = Math.round(activeUsers * 0.58);
    const pageViews = Math.round(totalSessions * randWeighted<number>([[2.4, 5], [2.8, 3], [3.2, 2]]));
    const conversions = Math.round(totalSessions * (0.018 + rng() * 0.01));

    websiteDaily.push({
      organizationId,
      date,
      sessions: totalSessions,
      activeUsers,
      newUsers,
      pageViews,
      conversions,
      engagementRate: 0.55 + rng() * 0.1,
      avgSessionSeconds: 90 + randInt(-15, 30),
    });

    channelDaily.push(
      { organizationId, date, channel: 'Organic Search', sessions: organicSessions, conversions: Math.round(organicSessions * 0.015) },
      { organizationId, date, channel: 'Paid Social', sessions: paidSocialSessions, conversions: Math.round(paidSocialSessions * 0.025) },
      { organizationId, date, channel: 'Paid Search', sessions: paidSearchSessions, conversions: Math.round(paidSearchSessions * 0.025) },
      { organizationId, date, channel: 'Direct', sessions: directSessions, conversions: Math.round(directSessions * 0.012) },
      { organizationId, date, channel: 'Referral', sessions: referralSessions, conversions: Math.round(referralSessions * 0.01) },
    );

    // Search Console stays flat throughout — the demo's "what did not cause it" evidence.
    const searchClicks = 210 + randInt(-20, 20);
    const searchImpressions = searchClicks * randInt(14, 18);
    searchDaily.push({
      organizationId,
      date,
      clicks: searchClicks,
      impressions: searchImpressions,
      ctr: searchClicks / searchImpressions,
      position: 8.5 + rng() * 1.5,
    });

    landingPageDaily.push(
      { organizationId, date, landingPage: '/products/hpl-kitchen-panels', sessions: budgetBoostedNow ? randInt(180, 230) : randInt(60, 90) },
      { organizationId, date, landingPage: '/products/exterior-cladding', sessions: randInt(90, 130) },
      { organizationId, date, landingPage: '/', sessions: randInt(140, 190) },
    );

    const metaSpend = pausedNow ? 0 : 900 + randInt(-100, 150);
    metaDaily.push({
      organizationId,
      campaignId: pausedCampaign.id,
      platform: CampaignPlatform.META_ADS,
      date,
      spend: metaSpend,
      impressions: pausedNow ? 0 : 6000 + randInt(-500, 800),
      clicks: pausedNow ? 0 : 140 + randInt(-20, 30),
      conversions: pausedNow ? 0 : randInt(2, 6),
      ctr: pausedNow ? 0 : 2.3 + rng() * 0.4,
      avgCpc: pausedNow ? 0 : 6 + rng(),
    });

    const googleSpend = budgetBoostedNow ? 3600 + randInt(-200, 300) : 1400 + randInt(-100, 150);
    googleDaily.push({
      organizationId,
      campaignId: budgetIncreasedCampaign.id,
      platform: CampaignPlatform.GOOGLE_ADS,
      date,
      spend: googleSpend,
      impressions: budgetBoostedNow ? 15000 + randInt(-1000, 1500) : 6500 + randInt(-500, 700),
      clicks: budgetBoostedNow ? 420 + randInt(-30, 40) : 175 + randInt(-20, 25),
      conversions: budgetBoostedNow ? randInt(8, 14) : randInt(3, 7),
      ctr: 2.5 + rng() * 0.4,
      avgCpc: 5 + rng() * 0.8,
    });
  }

  await prisma.websiteAnalyticsDaily.createMany({ data: websiteDaily });
  await prisma.websiteChannelDaily.createMany({ data: channelDaily });
  await prisma.searchConsoleDaily.createMany({ data: searchDaily });
  await prisma.websiteLandingPageDaily.createMany({ data: landingPageDaily });
  await prisma.adPlatformDailyMetric.createMany({ data: [...metaDaily, ...googleDaily] });

  console.log(
    `Seeded ${TRAFFIC_INTEL_DAYS} days of Traffic Intelligence demo data — Meta pause dip on ${daysAgo(DIP_EVENT_DAYS_AGO).toISOString().slice(0, 10)}, Google budget spike on ${daysAgo(SPIKE_EVENT_DAYS_AGO).toISOString().slice(0, 10)}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// M6 — Leads
// ─────────────────────────────────────────────────────────────────────────

const LEAD_FIRST_NAMES = [
  'Vikram', 'Rohan', 'Aditya', 'Karan', 'Siddharth', 'Arjun', 'Nikhil', 'Varun', 'Rahul', 'Aakash',
  'Ritu', 'Anjali', 'Priyanka', 'Meera', 'Kajal', 'Swati', 'Ishita', 'Tanvi', 'Radhika', 'Simran',
];
const LEAD_LAST_NAMES = ['Sanghvi', 'Malhotra', 'Bhatia', 'Chopra', 'Khanna', 'Saxena', 'Bajaj', 'Oberoi', 'Chawla', 'Dutta', 'Menon', 'Pillai'];
const LEAD_COMPANY_SUFFIXES = ['Interiors', 'Modular Kitchens', 'Design Studio', 'Constructions', 'Developers', 'Interiors & Modular', 'Buildtech', 'Realty'];
const LEAD_NOTES = [
  'Interested in exterior cladding samples for a villa project.',
  'Wants a quote for modular kitchen laminates.',
  'Following up after a site visit — comparing with another vendor.',
  'Referred by an existing dealer, high intent.',
  'Requested catalogue for compact laminate range.',
  'Budget-conscious, evaluating interior HPL options.',
  'Large commercial project — needs bulk pricing.',
  'Asked about fire-rated and anti-bacterial variants.',
  'Repeat enquiry after seeing showroom display.',
  'Wants samples couriered before finalizing.',
];

// LeadStatus/LeadSource/LeadType are CRM-mirrored, per-tenant lookup tables, not enums (see
// schema.prisma — the real HPL CRM has 40/17/15 staff-editable values). For local/demo seeding
// we still want a small, deterministic set to generate synthetic leads against; the real HPL
// taxonomy is loaded separately by the CRM backfill script, not by this seed.
async function seedLeadTaxonomy(organizationId: string) {
  const existingStatuses = await prisma.leadStatus.count({ where: { organizationId } });
  if (existingStatuses === 0) {
    await prisma.leadStatus.createMany({
      data: [
        { organizationId, name: 'New', stage: 'OPEN', score: 5, sortOrder: 10 },
        { organizationId, name: 'Contacted', stage: 'OPEN', score: 10, sortOrder: 20 },
        { organizationId, name: 'Qualified', stage: 'OPEN', score: 18, sortOrder: 30 },
        { organizationId, name: 'Meeting', stage: 'OPEN', score: 22, sortOrder: 40 },
        { organizationId, name: 'Proposal', stage: 'OPEN', score: 26, sortOrder: 50 },
        { organizationId, name: 'Negotiation', stage: 'OPEN', score: 30, sortOrder: 60 },
        { organizationId, name: 'Won', stage: 'WON', score: 30, sortOrder: 70 },
        { organizationId, name: 'Lost', stage: 'LOST', score: 0, sortOrder: 0 },
      ],
    });
  }
  const existingSources = await prisma.leadSource.count({ where: { organizationId } });
  if (existingSources === 0) {
    await prisma.leadSource.createMany({
      data: [
        { organizationId, name: 'Google Ads', score: 18 },
        { organizationId, name: 'Meta Ads', score: 18 },
        { organizationId, name: 'Website', score: 18 },
        { organizationId, name: 'WhatsApp', score: 15 },
        { organizationId, name: 'Organic', score: 15 },
        { organizationId, name: 'Referral', score: 25 },
        { organizationId, name: 'Architect', score: 25 },
        { organizationId, name: 'Builder', score: 25 },
        { organizationId, name: 'Dealer', score: 25 },
        { organizationId, name: 'Walk-in', score: 8 },
      ],
    });
  }
  const existingTypes = await prisma.leadType.count({ where: { organizationId } });
  if (existingTypes === 0) {
    await prisma.leadType.createMany({
      data: [
        { organizationId, name: 'Retail' },
        { organizationId, name: 'Dealer' },
        { organizationId, name: 'Project' },
        { organizationId, name: 'Architect Referral' },
        { organizationId, name: 'Builder Referral' },
      ],
    });
  }

  return {
    statuses: await prisma.leadStatus.findMany({ where: { organizationId } }),
    sources: await prisma.leadSource.findMany({ where: { organizationId } }),
    types: await prisma.leadType.findMany({ where: { organizationId } }),
  };
}

async function seedLeads(organizationId: string, execIds: string[], architectIds: string[] = [], builderIds: string[] = []) {
  const existing = await prisma.lead.count({ where: { organizationId } });
  if (existing > 0) {
    console.log(`Leads already seeded (${existing} rows) — skipping`);
    return;
  }

  const { statuses, sources, types } = await seedLeadTaxonomy(organizationId);
  const byName = <T extends { name: string }>(rows: T[], name: string) => rows.find((r) => r.name === name)!;

  const statusPool: [(typeof statuses)[number], number][] = [
    [byName(statuses, 'New'), 20],
    [byName(statuses, 'Contacted'), 15],
    [byName(statuses, 'Qualified'), 15],
    [byName(statuses, 'Meeting'), 10],
    [byName(statuses, 'Proposal'), 8],
    [byName(statuses, 'Negotiation'), 7],
    [byName(statuses, 'Won'), 15],
    [byName(statuses, 'Lost'), 10],
  ];
  const sourcePool: [(typeof sources)[number], number][] = [
    [byName(sources, 'Google Ads'), 18],
    [byName(sources, 'Meta Ads'), 15],
    [byName(sources, 'Website'), 15],
    [byName(sources, 'WhatsApp'), 12],
    [byName(sources, 'Organic'), 10],
    [byName(sources, 'Referral'), 12],
    [byName(sources, 'Architect'), 6],
    [byName(sources, 'Builder'), 5],
    [byName(sources, 'Dealer'), 5],
    [byName(sources, 'Walk-in'), 2],
  ];
  const typePool: [(typeof types)[number], number][] = [
    [byName(types, 'Retail'), 40],
    [byName(types, 'Dealer'), 15],
    [byName(types, 'Project'), 20],
    [byName(types, 'Architect Referral'), 15],
    [byName(types, 'Builder Referral'), 10],
  ];
  const activityTypePool: ActivityType[] = [
    ActivityType.CALL,
    ActivityType.EMAIL,
    ActivityType.WHATSAPP,
    ActivityType.MEETING,
    ActivityType.SITE_VISIT,
    ActivityType.NOTE,
    ActivityType.SAMPLE_SENT,
  ];

  const LEAD_COUNT = 180;
  let created = 0;

  for (let i = 0; i < LEAD_COUNT; i++) {
    const { state, city } = randomLocation();
    const status = randWeighted(statusPool);
    const source = randWeighted(sourcePool);
    const leadType = randWeighted(typePool);
    const createdAt = daysAgo(randInt(0, 180));
    const name = `${randChoice(LEAD_FIRST_NAMES)} ${randChoice(LEAD_LAST_NAMES)}`;
    const isDecided = status.stage === 'WON' || status.stage === 'LOST';

    // Activity history: 1-4 entries, all after createdAt, most recent defines lastActivityAt.
    const activityCount = randInt(1, 4);
    const activityDates: Date[] = [];
    for (let a = 0; a < activityCount; a++) {
      const daysAfterCreation = randInt(0, Math.min(120, randInt(1, 150)));
      const activityDate = new Date(createdAt.getTime() + daysAfterCreation * 86400000);
      activityDates.push(activityDate > new Date() ? new Date() : activityDate);
    }
    activityDates.sort((a, b) => a.getTime() - b.getTime());
    const lastActivityAt = activityDates[activityDates.length - 1];

    const nextFollowUpAt = isDecided ? null : new Date(Date.now() + randInt(-10, 20) * 86400000);
    const estimatedValue = randInt(50000, 4000000);

    const lead = await prisma.lead.create({
      data: {
        organizationId,
        leadCode: `LD-${2000 + i}`,
        name,
        company: leadType.name === 'Retail' ? null : `${randChoice(LEAD_LAST_NAMES)} ${randChoice(LEAD_COMPANY_SUFFIXES)}`,
        phone: `+91 ${randInt(70000, 99999)}${randInt(10000, 99999)}`,
        email: null,
        sources: { create: [{ organizationId, leadSourceId: source.id }] },
        referredByArchitectId: source.name === 'Architect' && architectIds.length > 0 ? randChoice(architectIds) : null,
        referredByBuilderId: source.name === 'Builder' && builderIds.length > 0 ? randChoice(builderIds) : null,
        state,
        city,
        leadTypeId: leadType.id,
        assignedExecId: randChoice(execIds),
        statusId: status.id,
        score: 0, // set below via computeLeadScore
        estimatedValue,
        nextFollowUpAt,
        lastActivityAt,
        wonAt: status.stage === 'WON' ? lastActivityAt : null,
        lostAt: status.stage === 'LOST' ? lastActivityAt : null,
        lostReason: status.stage === 'LOST' ? randChoice(['Chose competitor', 'Budget mismatch', 'Project cancelled', 'No response']) : null,
        notes: randChoice(LEAD_NOTES),
        createdAt,
        activities: {
          create: activityDates.map((occurredAt) => ({
            organizationId,
            type: randChoice(activityTypePool),
            performedById: randChoice(execIds),
            occurredAt,
          })),
        },
      },
    });

    const daysSinceActivity = Math.round((Date.now() - lastActivityAt.getTime()) / 86400000);
    const score = computeLeadScore({
      sourceScores: [source.score],
      statusScore: status.score,
      isLost: status.stage === 'LOST',
      estimatedValue,
      daysSinceActivity,
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { score } });

    created++;
  }

  console.log(`Seeded ${created} leads with activity history`);
}

// ─────────────────────────────────────────────────────────────────────────
// M7 — Architects, Builders, Projects
// ─────────────────────────────────────────────────────────────────────────

const FIRM_NAMES = [
  'Nirmaan Design Co.', 'Studio Arcline', 'Vertex Architects', 'Bluewave Design Studio', 'Kunal Mehta & Associates',
  'Sapphire Design Group', 'Urban Canvas Studio', 'Elevate Architecture', 'Greyscale Designs', 'Meridian Architects',
  'Zenith Design House', 'Foundation Studio',
];
const BUILDER_FIRM_NAMES = [
  'Phoenix Realty Group', 'Grand Vista Developers', 'Lakeview Developers Pvt Ltd', 'Metro Buildcon', 'Sunrise Buildhome',
  'Skyline Constructions', 'Horizon Infra Developers', 'Crestline Builders', 'Silverstone Developers', 'Anchor Realty',
  'Bluepeak Constructions', 'Novus Buildtech',
];

async function seedArchitects(organizationId: string): Promise<string[]> {
  const existing = await prisma.architect.count({ where: { organizationId } });
  if (existing > 0) {
    console.log(`Architects already seeded (${existing} rows) — skipping`);
    return (await prisma.architect.findMany({ where: { organizationId }, select: { id: true } })).map((a) => a.id);
  }

  const ids: string[] = [];
  for (const company of FIRM_NAMES) {
    const { state, city } = randomLocation();
    const architect = await prisma.architect.create({
      data: {
        organizationId,
        name: randomContactName(),
        company,
        city,
        state,
        phone: `+91 ${randInt(70000, 99999)}${randInt(10000, 99999)}`,
        joinedAt: daysAgo(randInt(100, 900)),
        lastActivityAt: daysAgo(randInt(0, 60)),
      },
    });
    ids.push(architect.id);
  }
  console.log(`Seeded ${ids.length} architects`);
  return ids;
}

async function seedBuilders(organizationId: string): Promise<string[]> {
  const existing = await prisma.builder.count({ where: { organizationId } });
  if (existing > 0) {
    console.log(`Builders already seeded (${existing} rows) — skipping`);
    return (await prisma.builder.findMany({ where: { organizationId }, select: { id: true } })).map((b) => b.id);
  }

  const ids: string[] = [];
  for (const company of BUILDER_FIRM_NAMES) {
    const { state, city } = randomLocation();
    const builder = await prisma.builder.create({
      data: {
        organizationId,
        name: randomContactName(),
        company,
        city,
        state,
        phone: `+91 ${randInt(70000, 99999)}${randInt(10000, 99999)}`,
        joinedAt: daysAgo(randInt(100, 900)),
        lastActivityAt: daysAgo(randInt(0, 60)),
      },
    });
    ids.push(builder.id);
  }
  console.log(`Seeded ${ids.length} builders`);
  return ids;
}

const PROJECT_TYPE_LABELS: Record<string, string[]> = {
  COMMERCIAL: ['Office Park', 'Mall Interiors', 'Business Tower', 'Corporate Office'],
  RESIDENTIAL: ['Villas', 'Apartments', 'Row Houses', 'Township'],
  INDUSTRIAL: ['Warehouse', 'Factory Fit-out'],
  INSTITUTIONAL: ['School Campus', 'Hospital Interiors'],
  HOSPITALITY: ['Hotel Interiors', 'Resort Fit-out'],
  RETAIL: ['Showroom', 'Retail Fit-out'],
  DEALER_FACILITY: ['Dealer Showroom Upgrade'],
};
const PROJECT_CATEGORY_WEIGHTS: [ProjectCategory, number][] = [
  [ProjectCategory.COMMERCIAL, 25],
  [ProjectCategory.RESIDENTIAL, 25],
  [ProjectCategory.INDUSTRIAL, 10],
  [ProjectCategory.INSTITUTIONAL, 8],
  [ProjectCategory.HOSPITALITY, 10],
  [ProjectCategory.RETAIL, 15],
  [ProjectCategory.DEALER_FACILITY, 7],
];
const STAGE_WEIGHTS: [ProjectStage, number][] = [
  [ProjectStage.LEAD, 15],
  [ProjectStage.DISCOVERY, 12],
  [ProjectStage.SAMPLE, 10],
  [ProjectStage.DESIGN_APPROVAL, 10],
  [ProjectStage.QUOTATION, 12],
  [ProjectStage.NEGOTIATION, 10],
  [ProjectStage.ORDER, 10],
  [ProjectStage.COMPLETED, 15],
  [ProjectStage.LOST, 6],
];
const STAGE_PROBABILITY_ANCHOR: Record<ProjectStage, number> = {
  LEAD: 10,
  DISCOVERY: 20,
  SAMPLE: 30,
  DESIGN_APPROVAL: 45,
  QUOTATION: 55,
  NEGOTIATION: 70,
  ORDER: 95,
  COMPLETED: 100,
  LOST: 0,
};
const PROJECT_NOTES = [
  'Finalising quantity split between exterior cladding and interior partitions.',
  'Client comparing samples with a competitor brand.',
  'Awaiting architect sign-off on shade selection.',
  'Budget approved, moving to formal quotation.',
  'Site visit scheduled to confirm final measurements.',
  'Price negotiation in progress — dealer requesting bulk discount.',
  'On hold pending client’s internal approval.',
  'Strong intent, expected to close this quarter.',
];

async function seedProjects(
  organizationId: string,
  execIds: string[],
  dealerIds: string[],
  customerIds: string[],
  architectIds: string[],
  builderIds: string[],
) {
  const existing = await prisma.project.count({ where: { organizationId } });
  if (existing > 0) {
    console.log(`Projects already seeded (${existing} rows) — skipping`);
    return;
  }

  const PROJECT_COUNT = 38;
  let created = 0;

  for (let i = 0; i < PROJECT_COUNT; i++) {
    const { state, city } = randomLocation();
    const category = randWeighted(PROJECT_CATEGORY_WEIGHTS);
    const typeLabel = randChoice(PROJECT_TYPE_LABELS[category]);
    const stage = randWeighted(STAGE_WEIGHTS);
    const isOpen = stage !== ProjectStage.COMPLETED && stage !== ProjectStage.LOST;

    const estimatedValue = randInt(300000, 9000000);
    const probabilityAnchor = STAGE_PROBABILITY_ANCHOR[stage];
    const probability = Math.max(0, Math.min(100, probabilityAnchor + randInt(-8, 8)));

    // stageSince spread 1-60 days back so some naturally cross the 20-day "stuck" threshold.
    const stageSince = daysAgo(randInt(1, 60));
    // expectedCloseAt spans -10 (overdue) to +60 days out for open projects.
    const expectedCloseAt = isOpen ? new Date(Date.now() + randInt(-10, 60) * 86400000) : null;
    const lastActivityAt = daysAgo(randInt(0, Math.min(30, 60)));

    const name = `${randChoice(LEAD_LAST_NAMES)} ${typeLabel} — ${city}`;

    await prisma.project.create({
      data: {
        organizationId,
        projectCode: `PRJ-${String(i + 1).padStart(2, '0')}`,
        name,
        customerId: rng() < 0.6 ? randChoice(customerIds) : null,
        architectId: rng() < 0.5 ? randChoice(architectIds) : null,
        builderId: rng() < 0.4 ? randChoice(builderIds) : null,
        dealerId: rng() < 0.5 ? randChoice(dealerIds) : null,
        salesExecId: randChoice(execIds),
        city,
        state,
        category,
        typeLabel,
        estimatedValue,
        expectedHplQty: randInt(500, 6000),
        stage,
        probability,
        stageSince,
        expectedCloseAt,
        nextFollowUpAt: isOpen ? new Date(Date.now() + randInt(-5, 20) * 86400000) : null,
        lastActivityAt,
        notes: randChoice(PROJECT_NOTES),
        activities: {
          create: [
            {
              organizationId,
              type: ActivityType.STATUS_CHANGE,
              toStage: stage,
              note: 'Project created',
              occurredAt: stageSince,
            },
          ],
        },
      },
    });
    created++;
  }

  console.log(`Seeded ${created} projects with stage history`);
}

// Placeholder letterhead for the Quotations feature — the operator edits this (or adds more
// Company Profile templates) via Settings once real GSTIN/bank details are available.
async function seedCompanyProfile(organizationId: string) {
  const existing = await prisma.companyProfile.findFirst({ where: { organizationId, isDefault: true } });
  if (existing) return;

  await prisma.companyProfile.create({
    data: {
      organizationId,
      label: 'Default',
      isDefault: true,
      isActive: true,
      name: 'Shreenath Global Private Limited',
      addressLine1: 'Plot 14, Industrial Estate',
      addressLine2: 'MIDC Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      phone: '+91 98765 43210',
      email: 'sales@hplmaker.example',
      gstin: '27AAAAA0000A1Z5',
      logoDataUrl: null,
      bankName: 'HDFC Bank',
      bankAccountNumber: '50200012345678',
      bankIfsc: 'HDFC0000123',
      bankSwift: 'HDFCINBB',
      defaultTermsAndConditions: [
        'Prices are exclusive of transportation unless stated otherwise.',
        'Delivery timeline begins after advance payment is received.',
        'Goods once dispatched will not be taken back.',
        'Any disputes are subject to Mumbai jurisdiction only.',
      ].join('\n'),
      defaultAdvancePercent: 50,
      defaultBeforeDispatchPercent: 50,
      validityDays: 30,
    },
  });
}

async function main() {
  console.log('Seeding HPL Maker Command Center — Foundation (organization, roles, permissions, users)...\n');

  const organizationId = await seedOrganization();
  const roleIdByName = await seedRolesAndPermissions();
  await seedUsers(organizationId, roleIdByName);
  await seedProductCatalog(organizationId);
  await seedCompanyProfile(organizationId);

  const execIds = await seedSalesExecutives(organizationId);
  const dealerIds = await seedDealers(organizationId, execIds);
  const customerIds = await seedCustomers(organizationId);
  await seedOrders(organizationId, execIds, dealerIds, customerIds);
  await seedSalesTargets(organizationId, execIds);
  await seedMarketingCampaigns(organizationId);
  await seedTrafficIntelligence(organizationId);

  const architectIds = await seedArchitects(organizationId);
  const builderIds = await seedBuilders(organizationId);
  await seedLeads(organizationId, execIds, architectIds, builderIds);
  await seedProjects(organizationId, execIds, dealerIds, customerIds, architectIds, builderIds);

  console.log('\nDemo login credentials (all users share this password):');
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
  for (const user of DEMO_USERS) {
    console.log(`  ${user.email.padEnd(32)} ${user.role}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
