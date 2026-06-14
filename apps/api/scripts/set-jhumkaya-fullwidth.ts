import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
async function main() {
  const v = await prisma.vendor.findFirst({ where: { slug: 'jhumkaya' }, select: { id: true, userId: true } });
  if (!v) throw new Error('jhumkaya not found');
  const page = await prisma.vendorPage.findFirst({ where: { vendorId: v.id, pageKind: 'HOMEPAGE' as any } });
  if (!page) throw new Error('homepage not found');
  const blocks = ((page.draftBlocks as any[]) ?? []).slice();
  const idx = blocks.findIndex((b) => b.type === 'imageWithText' && b.settings?.mediaKind === 'video');
  if (idx === -1) throw new Error('video imageWithText not found');
  blocks[idx] = { ...blocks[idx], settings: { ...blocks[idx].settings, width: 'full' } };
  await prisma.vendorPage.update({ where: { id: page.id }, data: { draftBlocks: blocks as any } });
  const last = await prisma.vendorPageVersion.findFirst({ where: { pageId: page.id }, orderBy: { versionNum: 'desc' }, select: { versionNum: true } });
  const versionNum = (last?.versionNum ?? 0) + 1;
  await prisma.$transaction([
    prisma.vendorPageVersion.create({ data: { pageId: page.id, versionNum, blocks: blocks as any, publishedBy: v.userId } }),
    prisma.vendorPage.update({ where: { id: page.id }, data: { isPublished: true, publishedAt: new Date() } }),
  ]);
  console.log(`set block #${idx} width=full, published v${versionNum}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
