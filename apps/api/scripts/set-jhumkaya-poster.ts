// Add a poster image to the jhumkaya homepage video section so it always shows a
// frame before the video plays. Uses the vendor's own slider image as the poster.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const vendor = await prisma.vendor.findFirst({ where: { slug: 'jhumkaya' }, select: { id: true, userId: true } });
  if (!vendor) throw new Error('jhumkaya not found');
  const page = await prisma.vendorPage.findFirst({ where: { vendorId: vendor.id, pageKind: 'HOMEPAGE' as any } });
  if (!page) throw new Error('homepage not found');

  const blocks = ((page.draftBlocks as any[]) ?? []).slice();

  // Prefer the vendor's first slider image as the poster; fall back to nothing.
  const slider = blocks.find((b) => b.type === 'imageSlider');
  const poster: string = slider?.settings?.slides?.find((s: any) => s.imageUrl)?.imageUrl ?? '';
  if (!poster) throw new Error('no slider image available to use as poster');

  const idx = blocks.findIndex((b) => b.type === 'imageWithText' && b.settings?.mediaKind === 'video');
  if (idx === -1) throw new Error('no video imageWithText block found');

  blocks[idx] = { ...blocks[idx], settings: { ...blocks[idx].settings, imageUrl: poster } };

  await prisma.vendorPage.update({ where: { id: page.id }, data: { draftBlocks: blocks as any } });
  const last = await prisma.vendorPageVersion.findFirst({ where: { pageId: page.id }, orderBy: { versionNum: 'desc' }, select: { versionNum: true } });
  const versionNum = (last?.versionNum ?? 0) + 1;
  await prisma.$transaction([
    prisma.vendorPageVersion.create({ data: { pageId: page.id, versionNum, blocks: blocks as any, publishedBy: vendor.userId } }),
    prisma.vendorPage.update({ where: { id: page.id }, data: { isPublished: true, publishedAt: new Date() } }),
  ]);
  console.log(`set poster on block #${idx} and published v${versionNum}\n  poster=${poster}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
