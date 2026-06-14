// Demo: turn the "Image + text" brand-story section on the Jewel Demo Store
// homepage into a VIDEO + text section, then publish.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const VENDOR_ID = '5d871f62-581b-40a7-a5df-186e183a7c9b';
const SAMPLE_VIDEO = 'https://res.cloudinary.com/demo/video/upload/dog.mp4';
const POSTER = 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=1200&q=80';

async function main() {
  const page = await prisma.vendorPage.findFirst({ where: { vendorId: VENDOR_ID, pageKind: 'HOMEPAGE' as any } });
  if (!page) throw new Error('homepage not found');

  const blocks = ((page.draftBlocks as any[]) ?? []).map((b) => {
    if (b.type !== 'imageWithText') return b;
    return { ...b, settings: { ...b.settings, mediaKind: 'video', videoUrl: SAMPLE_VIDEO, imageUrl: POSTER } };
  });

  const changed = blocks.some((b: any) => b.type === 'imageWithText' && b.settings.mediaKind === 'video');
  if (!changed) throw new Error('no imageWithText section found on homepage');

  await prisma.vendorPage.update({ where: { id: page.id }, data: { draftBlocks: blocks as any } });
  const last = await prisma.vendorPageVersion.findFirst({ where: { pageId: page.id }, orderBy: { versionNum: 'desc' }, select: { versionNum: true } });
  const versionNum = (last?.versionNum ?? 0) + 1;
  const v = await prisma.vendor.findUnique({ where: { id: VENDOR_ID }, select: { userId: true } });
  await prisma.$transaction([
    prisma.vendorPageVersion.create({ data: { pageId: page.id, versionNum, blocks: blocks as any, publishedBy: v!.userId } }),
    prisma.vendorPage.update({ where: { id: page.id }, data: { isPublished: true, publishedAt: new Date() } }),
  ]);
  console.log(`published homepage v${versionNum} — brand-story section is now a video section`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
