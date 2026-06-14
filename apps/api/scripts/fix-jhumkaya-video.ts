// Set the empty Image+text section on the jhumkaya homepage to a VIDEO section
// (using the JCO CDN clip the user provided) and publish, so it renders.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const VIDEO = 'https://www.jcojewellery.com/cdn/shop/videos/c/vp/b24f0d85bfd44d6690fd986be4853579/b24f0d85bfd44d6690fd986be4853579.HD-720p-1.6Mbps-50799654.mp4?v=0';

async function main() {
  const vendor = await prisma.vendor.findFirst({ where: { slug: 'jhumkaya' }, select: { id: true, userId: true } });
  if (!vendor) throw new Error('jhumkaya not found');
  const page = await prisma.vendorPage.findFirst({ where: { vendorId: vendor.id, pageKind: 'HOMEPAGE' as any } });
  if (!page) throw new Error('homepage not found');

  const blocks = ((page.draftBlocks as any[]) ?? []).slice();
  // Target the empty Image+text block (no body, no image, no video).
  const idx = blocks.findIndex((b) => b.type === 'imageWithText' && !b.settings?.body && !b.settings?.imageUrl && !b.settings?.videoUrl);
  if (idx === -1) throw new Error('no empty imageWithText block found');

  blocks[idx] = {
    ...blocks[idx],
    settings: {
      ...blocks[idx].settings,
      mediaKind: 'video',
      videoUrl: VIDEO,
      heading: blocks[idx].settings.heading || 'Crafted to move',
      body: blocks[idx].settings.body || 'See our pieces in motion — every facet, every finish.',
    },
  };

  await prisma.vendorPage.update({ where: { id: page.id }, data: { draftBlocks: blocks as any } });
  const last = await prisma.vendorPageVersion.findFirst({ where: { pageId: page.id }, orderBy: { versionNum: 'desc' }, select: { versionNum: true } });
  const versionNum = (last?.versionNum ?? 0) + 1;
  await prisma.$transaction([
    prisma.vendorPageVersion.create({ data: { pageId: page.id, versionNum, blocks: blocks as any, publishedBy: vendor.userId } }),
    prisma.vendorPage.update({ where: { id: page.id }, data: { isPublished: true, publishedAt: new Date() } }),
  ]);
  console.log(`set block #${idx} to video and published homepage v${versionNum}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
