// Demo: set a bare logo, a favicon, and logo sizing on the Jewel Demo Store so we
// can verify the new header/favicon behaviour end-to-end. Uses self-contained SVG
// data URIs so no upload/hosting is needed.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const VENDOR_ID = '5d871f62-581b-40a7-a5df-186e183a7c9b';

const logoSvg =
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="64" viewBox="0 0 280 64">` +
      `<text x="0" y="44" font-family="Georgia, serif" font-size="34" fill="#A87C3D" font-style="italic">Jewel</text>` +
      `<text x="118" y="44" font-family="Georgia, serif" font-size="34" fill="#211B14"> Demo</text>` +
    `</svg>`
  );

const faviconSvg =
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="12" fill="#211B14"/>` +
      `<text x="32" y="46" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="#A87C3D">J</text>` +
    `</svg>`
  );

async function main() {
  const v = await prisma.vendor.findUnique({ where: { id: VENDOR_ID } });
  if (!v) throw new Error('demo vendor not found');
  const baseTheme = (v.theme as any) ?? {};
  const theme = {
    ...baseTheme,
    faviconUrl: faviconSvg,
    header: { ...(baseTheme.header ?? {}), logoHeight: 52, logoMaxWidth: 240 },
  };
  await prisma.vendor.update({
    where: { id: VENDOR_ID },
    data: { shopLogoUrl: logoSvg, theme },
  });
  console.log('set demo branding: logo + favicon + logoHeight=52, logoMaxWidth=240');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
