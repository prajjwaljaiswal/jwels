import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const cats = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, parentId: true, _count: { select: { children: true } } },
    orderBy: { name: 'asc' },
  });
  for (const c of cats) {
    const leaf = c._count.children === 0 ? 'LEAF' : 'node';
    console.log(`${leaf} | ${c.slug?.padEnd(22) ?? '-'} | ${c.name}  (${c.id})`);
  }
  console.log(`\nTOTAL: ${cats.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
