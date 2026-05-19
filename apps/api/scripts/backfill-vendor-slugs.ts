import { prisma } from '../src/lib/prisma';
import { slugifyVendor, RESERVED_VENDOR_SLUGS } from '../src/lib/vendor-slug';

async function main() {
  const vendors = await prisma.vendor.findMany({
    where: { slug: null },
    select: { id: true, shopName: true },
  });
  console.log(`Backfilling slugs for ${vendors.length} vendors…`);

  const taken = new Set(
    (await prisma.vendor.findMany({ where: { slug: { not: null } }, select: { slug: true } }))
      .map((v) => v.slug!)
  );

  for (const v of vendors) {
    let base = slugifyVendor(v.shopName);
    if (RESERVED_VENDOR_SLUGS.has(base)) base = `${base}-shop`;
    let slug = base;
    let n = 1;
    while (taken.has(slug)) {
      n += 1;
      slug = `${base}-${n}`;
    }
    taken.add(slug);
    await prisma.vendor.update({ where: { id: v.id }, data: { slug } });
    console.log(`  ${v.shopName} → ${slug}`);
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
