// Seed a curated "best" animations config onto a vendor's theme (no page changes).
// Usage: tsx scripts/seed-demo-animations.ts <slug>   (default: jewel-demo-store)
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const BEST = { enabled: true, style: 'fade-up', speed: 'normal', stagger: true, hover: true };

async function main() {
  const slug = process.argv[2] || 'jewel-demo-store';
  const v = await prisma.vendor.findFirst({ where: { slug }, select: { id: true, shopName: true, theme: true } });
  if (!v) throw new Error(`vendor ${slug} not found`);
  const theme = { ...((v.theme as any) ?? {}), animations: BEST };
  await prisma.vendor.update({ where: { id: v.id }, data: { theme } });
  console.log(`seeded best animations on ${v.shopName}: ${JSON.stringify(BEST)}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
