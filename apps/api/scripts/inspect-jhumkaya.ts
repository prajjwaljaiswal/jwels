import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const vendor = await prisma.vendor.findFirst({ where: { slug: 'jhumkaya' }, select: { id: true } });
  if (!vendor) throw new Error('jhumkaya not found');
  const page = await prisma.vendorPage.findFirst({ where: { vendorId: vendor.id, pageKind: 'HOMEPAGE' as any } });
  if (!page) throw new Error('homepage not found');

  const draft = (page.draftBlocks as any[]) ?? [];
  console.log(`isPublished=${page.isPublished}  draft blocks=${draft.length}`);
  draft.forEach((b, i) => {
    if (b.type === 'imageWithText' || b.type === 'imageSlider') {
      console.log(`  [${i}] ${b.type}: ${JSON.stringify(b.settings).slice(0, 240)}`);
    }
  });

  const ver = await prisma.vendorPageVersion.findFirst({ where: { pageId: page.id }, orderBy: { versionNum: 'desc' } });
  const pub = (ver?.blocks as any[]) ?? [];
  console.log(`\nlatest published version v${ver?.versionNum}  blocks=${pub.length}`);
  pub.forEach((b, i) => {
    if (b.type === 'imageWithText' || b.type === 'imageSlider') {
      console.log(`  [${i}] ${b.type}: ${JSON.stringify(b.settings).slice(0, 240)}`);
    }
  });
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
