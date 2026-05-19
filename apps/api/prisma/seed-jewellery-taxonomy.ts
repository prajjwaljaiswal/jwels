import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Top-level categories with their subcategories. Slugs are kebab-case; sibling
// subcategory slugs are scoped by the parent prefix to avoid global slug collisions.
type Sub = { name: string; slug: string };
type Top = { name: string; slug: string; description?: string; subs: Sub[] };

const TAXONOMY: Top[] = [
  {
    name: 'Rings', slug: 'rings',
    description: 'Rings for every occasion — solitaires, bands, and statement pieces.',
    subs: [
      { name: 'Engagement Rings', slug: 'rings-engagement' },
      { name: 'Wedding Rings / Bands', slug: 'rings-wedding' },
      { name: 'Solitaire Rings', slug: 'rings-solitaire' },
      { name: 'Cocktail Rings', slug: 'rings-cocktail' },
      { name: 'Couple Rings', slug: 'rings-couple' },
      { name: 'Adjustable Rings', slug: 'rings-adjustable' },
      { name: 'Daily-wear Rings', slug: 'rings-daily' },
      { name: 'Statement Rings', slug: 'rings-statement' },
      { name: 'Stackable Rings', slug: 'rings-stackable' },
      { name: 'Promise Rings', slug: 'rings-promise' },
      { name: 'Eternity Rings', slug: 'rings-eternity' },
      { name: 'Signet Rings', slug: 'rings-signet' },
    ],
  },
  {
    name: 'Earrings', slug: 'earrings',
    description: 'Studs, hoops, jhumkas, chandbalis and more.',
    subs: [
      { name: 'Studs', slug: 'earrings-studs' },
      { name: 'Hoops', slug: 'earrings-hoops' },
      { name: 'Jhumkas', slug: 'earrings-jhumkas' },
      { name: 'Chandbalis', slug: 'earrings-chandbalis' },
      { name: 'Drops', slug: 'earrings-drops' },
      { name: 'Danglers', slug: 'earrings-danglers' },
      { name: 'Sui-Dhaga', slug: 'earrings-sui-dhaga' },
      { name: 'Ear Cuffs', slug: 'earrings-ear-cuffs' },
      { name: 'Threaders', slug: 'earrings-threaders' },
      { name: 'Huggies', slug: 'earrings-huggies' },
      { name: 'Climbers', slug: 'earrings-climbers' },
      { name: 'Ear Jackets', slug: 'earrings-ear-jackets' },
    ],
  },
  {
    name: 'Necklaces', slug: 'necklaces',
    description: 'Chokers, statement collars, layered necklaces and more.',
    subs: [
      { name: 'Choker', slug: 'necklaces-choker' },
      { name: 'Collar', slug: 'necklaces-collar' },
      { name: 'Princess', slug: 'necklaces-princess' },
      { name: 'Matinee', slug: 'necklaces-matinee' },
      { name: 'Opera', slug: 'necklaces-opera' },
      { name: 'Lariat', slug: 'necklaces-lariat' },
      { name: 'Layered', slug: 'necklaces-layered' },
      { name: 'Statement', slug: 'necklaces-statement' },
      { name: 'Bib', slug: 'necklaces-bib' },
      { name: 'Beaded', slug: 'necklaces-beaded' },
    ],
  },
  {
    name: 'Pendants', slug: 'pendants',
    description: 'Solitaire, religious, and initial pendants.',
    subs: [
      { name: 'Solitaire Pendants', slug: 'pendants-solitaire' },
      { name: 'Religious Pendants', slug: 'pendants-religious' },
      { name: 'Initial Pendants', slug: 'pendants-initial' },
      { name: 'Heart Pendants', slug: 'pendants-heart' },
      { name: 'Cluster Pendants', slug: 'pendants-cluster' },
      { name: 'Halo Pendants', slug: 'pendants-halo' },
      { name: 'Lab-Grown Diamond Pendants', slug: 'pendants-lab-grown-diamond' },
    ],
  },
  {
    name: 'Mangalsutra', slug: 'mangalsutra',
    description: 'Long, short, bracelet-style, tanmaniya.',
    subs: [
      { name: 'Long Mangalsutra', slug: 'mangalsutra-long' },
      { name: 'Short Mangalsutra', slug: 'mangalsutra-short' },
      { name: 'Bracelet Mangalsutra', slug: 'mangalsutra-bracelet' },
      { name: 'Tanmaniya', slug: 'mangalsutra-tanmaniya' },
      { name: 'Diamond Mangalsutra', slug: 'mangalsutra-diamond' },
      { name: 'Gold Mangalsutra', slug: 'mangalsutra-gold' },
    ],
  },
  {
    name: 'Bangles', slug: 'bangles',
    description: 'Bridal sets, daily-wear bangles, kadas and cuffs.',
    subs: [
      { name: 'Kada-style', slug: 'bangles-kada' },
      { name: 'Openable', slug: 'bangles-openable' },
      { name: 'Cuff', slug: 'bangles-cuff' },
      { name: 'Bridal', slug: 'bangles-bridal' },
      { name: 'Daily', slug: 'bangles-daily' },
      { name: 'Hinged', slug: 'bangles-hinged' },
    ],
  },
  {
    name: 'Bracelets', slug: 'bracelets',
    description: 'Tennis bracelets, charm bracelets, chains and cuffs.',
    subs: [
      { name: 'Tennis', slug: 'bracelets-tennis' },
      { name: 'Charm', slug: 'bracelets-charm' },
      { name: 'Bangle-style', slug: 'bracelets-bangle' },
      { name: 'Chain', slug: 'bracelets-chain' },
      { name: 'Cuff', slug: 'bracelets-cuff' },
      { name: 'Beaded', slug: 'bracelets-beaded' },
      { name: 'Adjustable', slug: 'bracelets-adjustable' },
    ],
  },
  {
    name: 'Chains', slug: 'chains',
    description: 'Rope, box, curb, Cuban and more.',
    subs: [
      { name: 'Rope', slug: 'chains-rope' },
      { name: 'Box', slug: 'chains-box' },
      { name: 'Curb', slug: 'chains-curb' },
      { name: 'Cuban', slug: 'chains-cuban' },
      { name: 'Singapore', slug: 'chains-singapore' },
      { name: 'Figaro', slug: 'chains-figaro' },
      { name: 'Snake', slug: 'chains-snake' },
      { name: 'Bead', slug: 'chains-bead' },
    ],
  },
  {
    name: 'Anklets', slug: 'anklets',
    description: 'Single, pair, charm and chain anklets.',
    subs: [
      { name: 'Single', slug: 'anklets-single' },
      { name: 'Pair', slug: 'anklets-pair' },
      { name: 'Charm', slug: 'anklets-charm' },
      { name: 'Chain', slug: 'anklets-chain' },
      { name: 'Beaded', slug: 'anklets-beaded' },
    ],
  },
  {
    name: 'Nose Pins', slug: 'nose-pins',
    description: 'Studs, nath, hoops and screws.',
    subs: [
      { name: 'Studs', slug: 'nose-pins-studs' },
      { name: 'Nath', slug: 'nose-pins-nath' },
      { name: 'Hoop', slug: 'nose-pins-hoop' },
      { name: 'Septum', slug: 'nose-pins-septum' },
      { name: 'Screw', slug: 'nose-pins-screw' },
    ],
  },
  {
    name: 'Toe Rings', slug: 'toe-rings',
    description: 'Bichiya and modern toe rings.',
    subs: [
      { name: 'Bichiya', slug: 'toe-rings-bichiya' },
      { name: 'Adjustable', slug: 'toe-rings-adjustable' },
      { name: 'Pair', slug: 'toe-rings-pair' },
    ],
  },
  {
    name: 'Kadas', slug: 'kadas',
    description: 'Heavier than bangles — men and women.',
    subs: [
      { name: "Men's Kadas", slug: 'kadas-mens' },
      { name: "Women's Kadas", slug: 'kadas-womens' },
      { name: 'Religious Kadas', slug: 'kadas-religious' },
    ],
  },
  {
    name: 'Jewellery Sets', slug: 'jewellery-sets',
    description: 'Bridal and party sets — necklace + earring combos and more.',
    subs: [
      { name: 'Bridal Sets', slug: 'sets-bridal' },
      { name: 'Necklace + Earring', slug: 'sets-necklace-earring' },
      { name: 'Haar Sets', slug: 'sets-haar' },
      { name: 'Choker Sets', slug: 'sets-choker' },
      { name: 'Polki Sets', slug: 'sets-polki' },
      { name: 'Kundan Sets', slug: 'sets-kundan' },
      { name: 'Temple Sets', slug: 'sets-temple' },
    ],
  },
  {
    name: 'Hair Accessories', slug: 'hair-accessories',
    description: 'Maang tikka, matha patti, juda pin and more.',
    subs: [
      { name: 'Maang Tikka', slug: 'hair-maang-tikka' },
      { name: 'Matha Patti', slug: 'hair-matha-patti' },
      { name: 'Juda Pin', slug: 'hair-juda-pin' },
      { name: 'Hair Clip', slug: 'hair-clip' },
      { name: 'Passa', slug: 'hair-passa' },
    ],
  },
  {
    name: 'Coins & Bars', slug: 'coins-bars',
    description: 'Gold coins, silver coins, bullion bars.',
    subs: [
      { name: 'Gold Coins', slug: 'coins-gold' },
      { name: 'Silver Coins', slug: 'coins-silver' },
      { name: 'Gold Bars', slug: 'bars-gold' },
    ],
  },
  {
    name: 'Religious Jewellery', slug: 'religious-jewellery',
    description: 'Rudraksh, mala, symbol pendants and idols.',
    subs: [
      { name: 'Rudraksh', slug: 'religious-rudraksh' },
      { name: 'Mala', slug: 'religious-mala' },
      { name: 'Idols', slug: 'religious-idols' },
      { name: 'Symbol Pendants', slug: 'religious-symbol-pendants' },
    ],
  },
  {
    name: 'Brooches', slug: 'brooches',
    description: 'Lapel pins and statement brooches.',
    subs: [
      { name: 'Lapel Pins', slug: 'brooches-lapel' },
      { name: 'Statement Brooches', slug: 'brooches-statement' },
    ],
  },
  {
    name: 'Cufflinks', slug: 'cufflinks',
    description: "Men's formal cufflinks.",
    subs: [
      { name: 'Round Cufflinks', slug: 'cufflinks-round' },
      { name: 'Square Cufflinks', slug: 'cufflinks-square' },
      { name: 'Religious Cufflinks', slug: 'cufflinks-religious' },
    ],
  },
  {
    name: 'Tie Pins', slug: 'tie-pins',
    description: 'Tie clips and tie bars.',
    subs: [
      { name: 'Classic Tie Pins', slug: 'tie-pins-classic' },
      { name: 'Tie Bars', slug: 'tie-pins-bars' },
    ],
  },
  {
    name: 'Kids Jewellery', slug: 'kids-jewellery',
    description: 'Earrings, bracelets and nazariya for children.',
    subs: [
      { name: 'Kids Earrings', slug: 'kids-earrings' },
      { name: 'Kids Bracelets', slug: 'kids-bracelets' },
      { name: 'Kids Pendants', slug: 'kids-pendants' },
      { name: 'Nazariya', slug: 'kids-nazariya' },
    ],
  },
];

const NON_JEWELLERY_SLUGS = ['watches', 'shoes', 'clothing', 'bags', 'accessories'];

async function main() {
  let topOrder = 0;
  for (const top of TAXONOMY) {
    const root = await prisma.category.upsert({
      where: { slug: top.slug },
      update: {
        name: top.name,
        description: top.description,
        sortOrder: topOrder,
        parentId: null,
        isActive: true,
      },
      create: {
        name: top.name,
        slug: top.slug,
        description: top.description,
        sortOrder: topOrder,
        isActive: true,
      },
    });
    topOrder += 10;

    let subOrder = 0;
    for (const sub of top.subs) {
      await prisma.category.upsert({
        where: { slug: sub.slug },
        update: {
          name: sub.name,
          parentId: root.id,
          sortOrder: subOrder,
          isActive: true,
        },
        create: {
          name: sub.name,
          slug: sub.slug,
          parentId: root.id,
          sortOrder: subOrder,
          isActive: true,
        },
      });
      subOrder += 10;
    }
    console.log(`[ok] ${top.name} + ${top.subs.length} subcategories`);
  }

  // Deactivate non-jewellery seeds — keep the rows for any test data attached.
  const deactivated = await prisma.category.updateMany({
    where: { slug: { in: NON_JEWELLERY_SLUGS } },
    data: { isActive: false },
  });
  console.log(`[ok] deactivated ${deactivated.count} non-jewellery categor${deactivated.count === 1 ? 'y' : 'ies'}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
