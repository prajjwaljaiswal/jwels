// Demo: put an imageSlider (multi-image banner carousel) at the top of the Jewel
// Demo Store homepage, replacing the single hero, then publish. Uses the verified
// in-browser image pool so slides actually render.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const VENDOR_ID = '5d871f62-581b-40a7-a5df-186e183a7c9b';
const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=2000&q=80`;

const sliderBlock = {
  id: 'slider_demo_1',
  type: 'imageSlider',
  settings: {
    height: 'lg',
    autoplay: true,
    interval: 5,
    slides: [
      { imageUrl: img('1605100804763-247f67b3557e'), alt: 'Diamond ring', heading: 'Heirlooms, in the making', subheading: 'Hand-finished gold and gemstones, made to be passed on.', ctaLabel: 'Shop the collection', ctaHref: '/products' },
      { imageUrl: img('1599643478518-a784e5dc4c8f'), alt: 'Gold necklace', heading: 'The necklace edit', subheading: 'Layer, stack, repeat — pieces for every neckline.', ctaLabel: 'Shop necklaces', ctaHref: '/products?category=necklaces' },
      { imageUrl: img('1535632066927-ab7c9ab60908'), alt: 'Earrings', heading: 'Everyday gold', subheading: 'Lightweight earrings you never take off.', ctaLabel: 'Shop earrings', ctaHref: '/products?category=earrings' },
    ],
  },
};

async function main() {
  const page = await prisma.vendorPage.findFirst({ where: { vendorId: VENDOR_ID, pageKind: 'HOMEPAGE' as any } });
  if (!page) throw new Error('homepage not found — apply the heirloom preset first');

  const blocks = ((page.draftBlocks as any[]) ?? []).slice();
  // Replace a leading hero with the slider, else prepend the slider.
  if (blocks[0]?.type === 'hero') blocks[0] = sliderBlock;
  else blocks.unshift(sliderBlock);

  await prisma.vendorPage.update({ where: { id: page.id }, data: { draftBlocks: blocks as any } });

  const last = await prisma.vendorPageVersion.findFirst({
    where: { pageId: page.id }, orderBy: { versionNum: 'desc' }, select: { versionNum: true },
  });
  const versionNum = (last?.versionNum ?? 0) + 1;
  await prisma.$transaction([
    prisma.vendorPageVersion.create({ data: { pageId: page.id, versionNum, blocks: blocks as any, publishedBy: (await prisma.vendor.findUnique({ where: { id: VENDOR_ID }, select: { userId: true } }))!.userId } }),
    prisma.vendorPage.update({ where: { id: page.id }, data: { isPublished: true, publishedAt: new Date() } }),
  ]);

  console.log(`published homepage v${versionNum} with imageSlider (${sliderBlock.settings.slides.length} slides), ${blocks.length} blocks total`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
