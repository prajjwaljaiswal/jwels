import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
async function main() {
  const v = await prisma.vendor.findFirst({ where: { slug: 'jhumkaya' }, select: { id: true } });
  const page = await prisma.vendorPage.findFirst({ where: { vendorId: v!.id, pageKind: 'HOMEPAGE' as any } });
  const ver = await prisma.vendorPageVersion.findFirst({ where: { pageId: page!.id }, orderBy: { versionNum: 'desc' } });
  console.log(`published v${ver?.versionNum}`);
  ((ver?.blocks as any[]) ?? []).forEach((b, i) => {
    if (b.type === 'imageWithText') {
      const s = b.settings;
      console.log(`  [${i}] width=${s.width} mediaKind=${s.mediaKind} videoUrl=${s.videoUrl ? 'SET' : 'empty'} imageUrl=${s.imageUrl ? 'SET' : 'empty'} heading="${s.heading}"`);
    }
  });
  console.log('--- DRAFT ---');
  ((page!.draftBlocks as any[]) ?? []).forEach((b, i) => {
    if (b.type === 'imageWithText') {
      const s = b.settings;
      console.log(`  [${i}] width=${s.width} mediaKind=${s.mediaKind} videoUrl=${s.videoUrl ? 'SET' : 'empty'} imageUrl=${s.imageUrl ? 'SET' : 'empty'} heading="${s.heading}"`);
    }
  });
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
