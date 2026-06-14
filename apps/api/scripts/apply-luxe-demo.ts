// Demo: apply the "luxe" (J&Co-inspired) preset to the Jewel Demo Store, then add
// a VIDEO slide to the hero slider to showcase video support, and publish.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { getPreset, SYSTEM_SLUGS, SYSTEM_TITLES, type SystemPageKind } from '../src/lib/themePresets';

const VENDOR_ID = '5d871f62-581b-40a7-a5df-186e183a7c9b';
const SAMPLE_VIDEO = 'https://res.cloudinary.com/demo/video/upload/dog.mp4'; // public Cloudinary demo asset
const POSTER = 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=2000&q=80';

async function main() {
  const preset = getPreset('luxe');
  if (!preset) throw new Error('luxe preset missing');
  const vendor = await prisma.vendor.findUnique({ where: { id: VENDOR_ID } });
  if (!vendor) throw new Error('demo vendor not found');

  // 1) Apply theme
  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { themeColor: preset.themeColor, theme: preset.theme as any, themePresetKey: 'luxe' },
  });

  // 2) Upsert + publish each system page from the preset
  const kinds: SystemPageKind[] = ['HOMEPAGE', 'PDP', 'CART', 'CHECKOUT'];
  for (const kind of kinds) {
    let blocks = preset.pages[kind] as any[];

    // For the homepage, prepend a video slide to the hero slider to demo video.
    if (kind === 'HOMEPAGE') {
      blocks = blocks.map((b) => {
        if (b.type !== 'imageSlider') return b;
        const videoSlide = { kind: 'video', imageUrl: POSTER, videoUrl: SAMPLE_VIDEO, alt: '', heading: 'Crafted to move', subheading: 'See our pieces in motion.', ctaLabel: 'Shop the film', ctaHref: '/products' };
        return { ...b, settings: { ...b.settings, slides: [videoSlide, ...b.settings.slides] } };
      });
    }

    const existing = await prisma.vendorPage.findFirst({ where: { vendorId: vendor.id, pageKind: kind as any } });
    const page = existing
      ? await prisma.vendorPage.update({ where: { id: existing.id }, data: { draftBlocks: blocks } })
      : await prisma.vendorPage.create({
          data: { vendorId: vendor.id, slug: SYSTEM_SLUGS[kind], pageKind: kind as any, title: SYSTEM_TITLES[kind], isHomepage: kind === 'HOMEPAGE', draftBlocks: blocks },
        });

    const last = await prisma.vendorPageVersion.findFirst({ where: { pageId: page.id }, orderBy: { versionNum: 'desc' }, select: { versionNum: true } });
    const versionNum = (last?.versionNum ?? 0) + 1;
    await prisma.$transaction([
      prisma.vendorPageVersion.create({ data: { pageId: page.id, versionNum, blocks, publishedBy: vendor.userId } }),
      prisma.vendorPage.update({ where: { id: page.id }, data: { isPublished: true, publishedAt: new Date() } }),
    ]);
    console.log(`  published ${kind} (v${versionNum})`);
  }
  console.log('\nApplied luxe preset + video hero slide to Jewel Demo Store');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
