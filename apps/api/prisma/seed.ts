import 'dotenv/config';
import { PrismaClient, Role, AttributeInputType, Permission, CarrierMode, RateMode, ShippingServiceType, VendorStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptJson } from '../src/lib/crypto';

const prisma = new PrismaClient();

async function seedAdmin() {
  const adminEmail = 'admin@vrindaonline.local';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log('Admin already exists, skipping.');
    return;
  }
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: { name: 'Platform Admin', email: adminEmail, passwordHash, role: Role.ADMIN },
  });
  console.log('✓ Admin created:', admin.email, '(password: admin123)');
}

const SYSTEM_ADMIN_ROLES: Array<{
  name: string;
  description: string;
  permissions: Permission[];
}> = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full access to every admin capability. Locked from edits.',
    permissions: Object.values(Permission),
  },
  {
    name: 'VENDOR_MODERATOR',
    description: 'Review, approve, reject, and suspend vendor accounts.',
    permissions: [
      Permission.VENDOR_VIEW,
      Permission.VENDOR_APPROVE,
      Permission.VENDOR_SUSPEND,
      Permission.USER_VIEW,
    ],
  },
  {
    name: 'FINANCE',
    description: 'View payouts, process vendor disbursements, refund orders, audit vendor payment methods.',
    permissions: [
      Permission.PAYOUT_VIEW,
      Permission.PAYOUT_PROCESS,
      Permission.ORDER_VIEW,
      Permission.ORDER_REFUND,
      Permission.VENDOR_VIEW,
      Permission.PAYMENT_METHOD_VIEW,
      Permission.PAYMENT_METHOD_MANAGE,
    ],
  },
  {
    name: 'CATALOG_MANAGER',
    description: 'Manage categories, attributes, and platform settings.',
    permissions: [Permission.CATEGORY_MANAGE, Permission.SETTINGS_MANAGE],
  },
];

async function seedAdminRoles() {
  for (const r of SYSTEM_ADMIN_ROLES) {
    await prisma.adminRole.upsert({
      where: { name: r.name },
      update: {
        description: r.description,
        isSystem: true,
        permissions: { set: r.permissions },
      },
      create: {
        name: r.name,
        description: r.description,
        isSystem: true,
        permissions: r.permissions,
      },
    });
  }
  console.log(`✓ ${SYSTEM_ADMIN_ROLES.length} system admin roles seeded`);

  const superAdmin = await prisma.adminRole.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  const admins = await prisma.user.findMany({ where: { role: Role.ADMIN } });
  for (const u of admins) {
    await prisma.userAdminRole.upsert({
      where: { userId_roleId: { userId: u.id, roleId: superAdmin.id } },
      update: {},
      create: { userId: u.id, roleId: superAdmin.id },
    });
  }
  console.log(`✓ Backfilled ${admins.length} ADMIN user(s) → SUPER_ADMIN`);
}

async function seedCategories() {
  const categories = [
    { name: 'Rings',            slug: 'rings',     sortOrder: 1 },
    { name: 'Necklaces',        slug: 'necklaces', sortOrder: 2 },
    { name: 'Earrings',         slug: 'earrings',  sortOrder: 3 },
    { name: 'Bangles',          slug: 'bangles',   sortOrder: 4 },
    { name: 'Bracelets',        slug: 'bracelets', sortOrder: 5 },
    { name: 'Pendants',         slug: 'pendants',  sortOrder: 6 },
    { name: 'Jewelry (General)',slug: 'jewelry',   sortOrder: 7 },
    { name: 'Watches',          slug: 'watches',   sortOrder: 8 },
    { name: 'Shoes',            slug: 'shoes',     sortOrder: 9 },
    { name: 'Clothing',         slug: 'clothing',  sortOrder: 10 },
    { name: 'Bags',             slug: 'bags',      sortOrder: 11 },
    { name: 'Accessories',      slug: 'accessories', sortOrder: 12 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`✓ ${categories.length} categories seeded`);
  return await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
}

type CategoryMap = Record<string, string>;

async function seedAttributes(categoryMap: CategoryMap) {
  const jewelryCategories = ['rings', 'necklaces', 'earrings', 'bangles', 'bracelets', 'pendants', 'jewelry'];

  // Shared jewelry attributes
  for (const slug of jewelryCategories) {
    const categoryId = categoryMap[slug];
    if (!categoryId) continue;

    const metalAttr = await upsertAttribute(categoryId, 'Metal Type', AttributeInputType.SELECT, true, 1);
    await upsertOptions(metalAttr.id, ['Gold', 'Silver', 'Platinum', 'Rose Gold', 'Other']);

    const stoneAttr = await upsertAttribute(categoryId, 'Stone Type', AttributeInputType.SELECT, false, 2);
    await upsertOptions(stoneAttr.id, ['Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'None']);
  }

  // Ring size (rings only)
  const ringsId = categoryMap['rings'];
  if (ringsId) {
    const sizeAttr = await upsertAttribute(ringsId, 'Ring Size', AttributeInputType.SELECT, true, 3);
    await upsertOptions(sizeAttr.id, ['5', '6', '7', '8', '9', '10', '11', '12', '13']);
  }

  // Watches
  const watchesId = categoryMap['watches'];
  if (watchesId) {
    const bandAttr = await upsertAttribute(watchesId, 'Band Material', AttributeInputType.SELECT, false, 1);
    await upsertOptions(bandAttr.id, ['Leather', 'Metal', 'Rubber', 'Nylon', 'Silicone']);

    const caseAttr = await upsertAttribute(watchesId, 'Case Size', AttributeInputType.SELECT, false, 2);
    await upsertOptions(caseAttr.id, ['36mm', '38mm', '40mm', '42mm', '44mm', '46mm']);

    const movAttr = await upsertAttribute(watchesId, 'Movement', AttributeInputType.SELECT, false, 3);
    await upsertOptions(movAttr.id, ['Quartz', 'Automatic', 'Manual']);
  }

  // Shoes
  const shoesId = categoryMap['shoes'];
  if (shoesId) {
    const sizeAttr = await upsertAttribute(shoesId, 'Shoe Size', AttributeInputType.SELECT, true, 1);
    await upsertOptions(sizeAttr.id, ['UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11']);

    const colorAttr = await upsertAttribute(shoesId, 'Color', AttributeInputType.SELECT, false, 2);
    await upsertOptions(colorAttr.id, ['Black', 'White', 'Brown', 'Tan', 'Red', 'Blue', 'Grey']);

    const matAttr = await upsertAttribute(shoesId, 'Material', AttributeInputType.SELECT, false, 3);
    await upsertOptions(matAttr.id, ['Leather', 'Suede', 'Canvas', 'Synthetic', 'Rubber']);
  }

  // Clothing
  const clothingId = categoryMap['clothing'];
  if (clothingId) {
    const sizeAttr = await upsertAttribute(clothingId, 'Size', AttributeInputType.SELECT, true, 1);
    await upsertOptions(sizeAttr.id, ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']);

    const colorAttr = await upsertAttribute(clothingId, 'Color', AttributeInputType.SELECT, false, 2);
    await upsertOptions(colorAttr.id, ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Grey']);

    const fabricAttr = await upsertAttribute(clothingId, 'Fabric', AttributeInputType.SELECT, false, 3);
    await upsertOptions(fabricAttr.id, ['Cotton', 'Polyester', 'Silk', 'Wool', 'Linen', 'Denim']);
  }

  console.log('✓ Category attributes and options seeded');
}

async function upsertAttribute(
  categoryId: string,
  name: string,
  inputType: AttributeInputType,
  isRequired: boolean,
  sortOrder: number
) {
  const existing = await prisma.categoryAttribute.findFirst({
    where: { categoryId, name },
  });
  if (existing) return existing;
  return prisma.categoryAttribute.create({
    data: { categoryId, name, inputType, isRequired, sortOrder },
  });
}

async function upsertOptions(attributeId: string, values: string[]) {
  for (let i = 0; i < values.length; i++) {
    const existing = await prisma.categoryAttributeOption.findFirst({
      where: { attributeId, value: values[i] },
    });
    if (!existing) {
      await prisma.categoryAttributeOption.create({
        data: { attributeId, value: values[i], sortOrder: i },
      });
    }
  }
}

// ─── Review seed data ────────────────────────────────────────────────────────

const REVIEWER_NAMES = [
  'Priya Sharma', 'Ankit Mehta', 'Neha Gupta', 'Rahul Verma', 'Sunita Patel',
  'Deepak Joshi', 'Kavita Singh', 'Amit Kumar', 'Pooja Nair', 'Vikram Rao',
  'Sneha Iyer', 'Rajesh Khanna', 'Meena Pillai', 'Suresh Bhat', 'Asha Reddy',
];

const REVIEW_TITLES = [
  'Absolutely love it!', 'Exceeded my expectations', 'Great quality', 'Perfect gift',
  'Beautiful craftsmanship', 'Highly recommend', 'Worth every rupee', 'Stunning piece',
  'My new favourite', 'Just as described', 'Good value', 'Looks even better in person',
  'Superb quality', 'Fast delivery, great product', 'Very happy with purchase',
];

const REVIEW_BODIES = [
  'The quality is outstanding. I have received so many compliments since wearing this. Will definitely buy again.',
  'Bought this as a gift and the recipient was thrilled. The packaging was beautiful and the piece itself is stunning.',
  'Exactly as shown in the pictures. The craftsmanship is excellent and it looks very premium in person.',
  'Delivery was quick and the product was well-packed. Very happy with the overall experience.',
  'The finish is flawless. Looks much more expensive than the price. Highly recommended!',
  'I was a bit hesitant ordering online but this exceeded my expectations. Will order more from this vendor.',
  'Perfect fit and very comfortable to wear. The design is elegant and subtle — exactly what I wanted.',
  'Great product at a fair price. The material feels premium and there are no sharp edges or rough finishes.',
  'Ordered for a wedding and got many compliments. The stone catches the light beautifully.',
  'Good quality but slightly smaller than I expected. Still looks nice though and the return process was easy.',
  null, // some reviews have no body (just a rating)
  null,
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Weighted random rating — skewed toward 4-5 stars like real reviews
function randomRating(): number {
  const weights = [1, 3, 8, 25, 63]; // 1★ to 5★ probabilities (%)
  const r = Math.random() * 100;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) return i + 1;
  }
  return 5;
}

async function seedReviews() {
  const products = await prisma.product.findMany({ select: { id: true } });
  if (products.length === 0) {
    console.log('✗ No products found — skipping review seed. Add products first.');
    return;
  }

  const hash = await bcrypt.hash('reviewer123', 10);
  let created = 0;
  let skipped = 0;

  for (const reviewer of REVIEWER_NAMES) {
    const email = `${reviewer.toLowerCase().replace(/\s+/g, '.')}@example.com`;

    // Upsert reviewer user
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name: reviewer, email, passwordHash: hash, role: Role.CUSTOMER },
    });

    // Each reviewer reviews 1–4 random products
    const count = 1 + Math.floor(Math.random() * 4);
    const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, count);

    for (const product of shuffled) {
      const existing = await prisma.review.findUnique({
        where: { productId_customerId: { productId: product.id, customerId: user.id } },
      });
      if (existing) { skipped++; continue; }

      await prisma.review.create({
        data: {
          productId: product.id,
          customerId: user.id,
          rating: randomRating(),
          title: Math.random() > 0.2 ? pick(REVIEW_TITLES) : null,
          body: pick(REVIEW_BODIES),
          mediaUrls: [],
          mediaTypes: [],
        },
      });
      created++;
    }
  }

  console.log(`✓ Reviews seeded — ${created} created, ${skipped} already existed`);
}

// ─── Demo vendor with Delhivery setup ────────────────────────────────────────

async function findOrCreateShippingMethod(data: Parameters<typeof prisma.shippingMethod.create>[0]['data']) {
  const existing = await prisma.shippingMethod.findFirst({
    where: { vendorId: data.vendorId as string, name: data.name as string, carrier: data.carrier as string },
  });
  if (!existing) {
    await prisma.shippingMethod.create({ data });
    return true;
  }
  return false;
}

async function seedDemoVendor() {
  const vendorEmail = 'vendor@vrindaonline.local';
  const passwordHash = await bcrypt.hash('vendor123', 10);

  // 1. Upsert vendor user
  const user = await prisma.user.upsert({
    where: { email: vendorEmail },
    update: {},
    create: { name: 'Demo Vendor', email: vendorEmail, passwordHash, role: Role.VENDOR },
  });
  console.log('✓ Demo vendor user:', user.email, '(password: vendor123)');

  // 2. Upsert Vendor record
  const vendor = await prisma.vendor.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      shopName: 'Vrindaonline Demo Store',
      slug: 'vrindaonline-demo-store',
      status: VendorStatus.APPROVED,
      address: 'Mumbai, Maharashtra',
      description: 'Demo vendor store for testing Delhivery shipping integration.',
    },
  });
  console.log('✓ Demo vendor record:', vendor.shopName);

  // 3. Upsert VendorAddress
  await prisma.vendorAddress.upsert({
    where: { vendorId: vendor.id },
    update: {},
    create: {
      vendorId: vendor.id,
      contactName: 'Demo Vendor',
      phone: '9999999999',
      line1: '123 Demo Street, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'IN',
    },
  });
  console.log('✓ Demo vendor pickup address: Mumbai 400001');

  // 4. Upsert Delhivery carrier account (TEST mode)
  // Replace the placeholder token with your real Delhivery TEST API token,
  // then run "Verify" from the vendor portal to confirm the connection.
  const encryptedCreds = encryptJson({ apiToken: 'PASTE_YOUR_DELHIVERY_TEST_TOKEN_HERE' });
  const carrierAccount = await prisma.vendorCarrierAccount.upsert({
    where: {
      vendorId_carrier_accountLabel: {
        vendorId: vendor.id,
        carrier: 'DELHIVERY',
        accountLabel: 'Delhivery (Test)',
      },
    },
    update: {},
    create: {
      vendorId: vendor.id,
      carrier: 'DELHIVERY',
      accountLabel: 'Delhivery (Test)',
      mode: CarrierMode.TEST,
      credentials: encryptedCreds,
      defaultsJson: { pickupPincode: '400001' },
      isActive: true,
    },
  });
  console.log('✓ Delhivery TEST carrier account created (id:', carrierAccount.id + ')');
  console.log('  → Edit from vendor UI (Shipping → Carrier Accounts) to paste your real token, then click Verify');

  // 5. Flat Standard shipping method
  const std = await findOrCreateShippingMethod({
    vendorId: vendor.id,
    name: 'Standard Shipping',
    carrier: 'CUSTOM',
    serviceType: ShippingServiceType.STANDARD,
    rateMode: RateMode.FLAT,
    baseRate: 50,
    etaMinDays: 4,
    etaMaxDays: 7,
    zones: ['*'],
    isActive: true,
  });
  if (std) console.log('✓ Flat Standard method: ₹50, 4–7 days');

  // 6. Flat Express shipping method
  const exp = await findOrCreateShippingMethod({
    vendorId: vendor.id,
    name: 'Express Shipping',
    carrier: 'CUSTOM',
    serviceType: ShippingServiceType.EXPRESS,
    rateMode: RateMode.FLAT,
    baseRate: 150,
    etaMinDays: 1,
    etaMaxDays: 3,
    zones: ['*'],
    isActive: true,
  });
  if (exp) console.log('✓ Flat Express method: ₹150, 1–3 days');

  // 7. LIVE Delhivery method — inactive until the carrier account is verified
  const live = await findOrCreateShippingMethod({
    vendorId: vendor.id,
    carrierAccountId: carrierAccount.id,
    name: 'Delhivery Standard',
    carrier: 'DELHIVERY',
    serviceType: ShippingServiceType.STANDARD,
    rateMode: RateMode.LIVE,
    baseRate: 0,
    etaMinDays: 3,
    etaMaxDays: 6,
    zones: ['*'],
    isActive: false,
  });
  if (live) console.log('✓ LIVE Delhivery method created (inactive — enable after verifying account)');
}

async function main() {
  await seedAdmin();
  await seedAdminRoles();

  const categoryRows = await seedCategories();
  const categoryMap: CategoryMap = {};
  for (const cat of categoryRows) {
    categoryMap[cat.slug] = cat.id;
  }

  await seedAttributes(categoryMap);
  await seedDemoVendor();
  await seedReviews();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
