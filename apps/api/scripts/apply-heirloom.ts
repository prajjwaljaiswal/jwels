// One-off: apply the "heirloom" preset to a vendor and publish all system pages,
// replicating routes/vendors.ts (apply) + routes/vendorPages.ts (publish) directly.
// Usage:  tsx scripts/apply-heirloom.ts            -> list vendors
//         tsx scripts/apply-heirloom.ts <vendorId> -> apply + publish to that vendor
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { getPreset, SYSTEM_SLUGS, SYSTEM_TITLES, type SystemPageKind } from '../src/lib/themePresets';

async function main() {
  const target = process.argv[2];

  if (!target) {
    const vendors = await prisma.vendor.findMany({
      select: { id: true, shopName: true, slug: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log('VENDORS:');
    for (const v of vendors) {
      console.log(`  ${v.id}  | ${v.status.padEnd(8)} | slug=${v.slug ?? '-'} | ${v.shopName}`);
    }
    if (!vendors.length) console.log('  (none)');
    return;
  }

  const preset = getPreset('heirloom');
  if (!preset) throw new Error('heirloom preset not found');

  const vendor = await prisma.vendor.findUnique({ where: { id: target } });
  if (!vendor) throw new Error(`vendor ${target} not found`);

  // 1) Apply theme on the vendor record
  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { themeColor: preset.themeColor, theme: preset.theme as any, themePresetKey: 'heirloom' },
  });

  const kinds: SystemPageKind[] = ['HOMEPAGE', 'PDP', 'CART', 'CHECKOUT'];
  for (const kind of kinds) {
    const blocks = preset.pages[kind] as any;

    // 2) Upsert the system page with preset draft blocks (force-overwrite)
    const existing = await prisma.vendorPage.findFirst({ where: { vendorId: vendor.id, pageKind: kind as any } });
    const page = existing
      ? await prisma.vendorPage.update({ where: { id: existing.id }, data: { draftBlocks: blocks } })
      : await prisma.vendorPage.create({
          data: {
            vendorId: vendor.id,
            slug: SYSTEM_SLUGS[kind],
            pageKind: kind as any,
            title: SYSTEM_TITLES[kind],
            isHomepage: kind === 'HOMEPAGE',
            draftBlocks: blocks,
          },
        });

    // 3) Publish: new version snapshot + mark published
    const last = await prisma.vendorPageVersion.findFirst({
      where: { pageId: page.id }, orderBy: { versionNum: 'desc' }, select: { versionNum: true },
    });
    const versionNum = (last?.versionNum ?? 0) + 1;
    await prisma.$transaction([
      prisma.vendorPageVersion.create({
        data: { pageId: page.id, versionNum, blocks, publishedBy: vendor.userId },
      }),
      prisma.vendorPage.update({
        where: { id: page.id },
        data: { isPublished: true, publishedAt: new Date() },
      }),
    ]);
    console.log(`  published ${kind} (v${versionNum}, ${blocks.length} blocks)`);
  }

  console.log(`\nDONE. Vendor ${vendor.shopName} (${vendor.id}) status=${vendor.status} slug=${vendor.slug ?? '-'}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
