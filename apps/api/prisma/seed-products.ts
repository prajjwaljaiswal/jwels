import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VENDOR_ID = '3cfc0782-1adc-451a-85ff-a42d349b8480'; // Vrinda Jwels

// Category IDs
const CAT = {
  rings:     '5d987f02-9999-447f-bada-c3c301875810',
  necklaces: '62fe0a8b-1dec-496f-ac9b-d081535f3376',
  earrings:  '8d1f60de-276a-41a6-b587-9b9f18101541',
  bangles:   'd41f4daa-3214-44f6-8dd8-c515abf00d8a',
  bracelets: '3e77555b-b8d8-413a-af38-a2da43c1beff',
  pendants:  '5c017049-a34f-45a9-b607-433d6c17f98b',
};

// Attribute IDs per category: [metalTypeAttr, stoneTypeAttr]
const ATTR = {
  rings:     { metal: '7dc1b145-43fb-4116-a09c-f7ba2285fe13', stone: '6a769aec-ccee-48b0-b01e-2b7443ba9244', size: '7398117f-ca06-401b-aaa2-dec9915088be' },
  necklaces: { metal: '68d8dda6-9e08-4bd3-be17-3b75c471dcda', stone: '3682f5b7-03ec-44e2-a519-4e31155a884a' },
  earrings:  { metal: '2a37e70b-c612-459d-8757-a0ad14d68046', stone: 'dabbee59-ca34-448b-913e-5e7dda9ce3ab' },
  bangles:   { metal: '141116d4-7bf1-45e6-9dc4-3b427edd21d8', stone: '93e27be0-6831-4281-b462-b37e9be600ee' },
  bracelets: { metal: '1c82b160-c1ef-49c4-a36f-5def0f884671', stone: '8615306b-20fe-4850-a009-aeb1b46d2d7b' },
  pendants:  { metal: 'cb2adf1b-9d51-4c77-8205-7dcd381dffd1', stone: '4b7cabda-7be9-4e0f-bc87-de73d7a90e2c' },
};

// Option IDs: metal
const METAL = {
  rings:     { gold: '2107918a-13c7-4110-adb6-15e5fc2a9dda', silver: 'accb8fd3-c962-4d06-8b2f-00966742ce94', platinum: '4ee0c9ad-2354-4aa9-89da-5432e5702132', roseGold: '980a5233-370e-4456-94ef-6c5b03cc0362' },
  necklaces: { gold: 'ce5b2b31-e5f4-4952-9f6b-420196da948c', silver: '8ae9b6b3-9e9d-4868-ab08-5d71b2d093b0', roseGold: 'af14129b-64fb-49b7-bb28-cfc465115969' },
  earrings:  { gold: 'e7c7d784-3b8e-45f6-9b7b-0ec34d55fe71', silver: 'd420775c-b264-4384-9c24-a49e03cc91e2', roseGold: '3207068f-f442-4332-8604-7be71c7d0749' },
  bangles:   { gold: '1b3a8fcb-0c49-4679-8a8e-c396f30836df', silver: '91b878d2-d364-40b1-af63-2bc9f2bc540f', roseGold: '06ba2a87-9e1a-4a37-befb-4041957fe3c7' },
  bracelets: { gold: 'aec38eac-d17c-4ed8-9652-74b320f31980', silver: '8f50a4e8-e799-4289-a5c3-e44f0cd7d511', roseGold: '52607889-ddec-472a-8dd2-7028b692c040' },
  pendants:  { gold: '99a3c0c8-69c5-41a0-8191-a901a86363b5', silver: '37aa24cd-2135-4382-8116-c51bba62708b', roseGold: '9795583e-fa48-4e41-a5b1-e4a24c9b1e4f' },
};

// Option IDs: stone
const STONE = {
  rings:     { diamond: '039a48c0-c79b-4ac5-89c4-44f2917bb651', ruby: '4e97eff1-283b-4a16-85f5-8caa4f9c5db3', emerald: '1e417bb5-9ed8-4d86-8efe-ae1dbeda8d8c', sapphire: '4aec7cd4-d728-44bc-8601-b5503d81f499', pearl: 'd0741f35-2c7b-4bfd-b5ee-e3caa81795a9', none: 'a9f141ef-9574-4912-b19f-7ceaa1460409' },
  necklaces: { diamond: 'e2d77999-d846-4946-9d4e-1690eee58b69', pearl: '17b368db-ad28-4e1b-8f07-34d588a47950', none: '0b40813f-557f-4ada-a30a-99488763a7bd' },
  earrings:  { diamond: '9901ddcb-d0ee-44f5-86ca-f0f8c7378122', ruby: '0c64d89b-c61d-45d5-9fef-5b225afb831f', emerald: 'cb18f46d-f1a1-417e-a55e-ede1a62c3d39', pearl: 'eda2f754-ddb6-425a-a6df-a78a5512b9bc', none: '75698971-d409-48d7-801a-77ea254c3e4b' },
  bangles:   { diamond: '53eacc3e-f7b9-4395-a0d2-0020c67aecdc', none: '6d8a3d79-c419-4951-8a07-f3f9b51e6866' },
  bracelets: { diamond: '55eab861-794b-46aa-ae92-7a70b6f6a301', pearl: 'c37071da-d6f1-4ee3-8da1-e822b72687dd', none: '70d81772-3533-4f6f-ac76-37a2b394a604' },
  pendants:  { diamond: 'd083f359-e49c-4ff0-a463-34ea16181ab3', emerald: '850f4661-e9d5-4644-af24-63f2a6ae22b2', pearl: '3e8e0116-f356-4d15-a078-3a62acb7d7af', none: '5c94ae69-42d5-4bc6-b2fd-0a4790902aaf' },
};

// Ring size options
const RING_SIZE = {
  s7: '3d9ede98-3c04-4c81-8d5b-50be891bdccc',
  s8: 'd3348cf7-a184-4689-8e3f-2dd7d785dce0',
  s9: '5031cce7-b878-4cde-be42-4dcaacf52495',
};

function img(id: string, params = 'w=800&fit=crop&q=80') {
  return `https://images.unsplash.com/photo-${id}?${params}`;
}

// Curated jewelry Unsplash photo IDs
const PHOTOS = {
  // Rings
  ringGold1:    ['1515562141207-7a88fb7ce338', '1573408301185-9519f94815b3', '1611591437281-460bfbe1220a'],
  ringDiamond:  ['1605100804763-247f67b3557e', '1569582825425-59a9d1b35b05', '1583370573396-cb27bd2f5a1a'],
  ringRoseGold: ['1598836985580-abb05b3c28a2', '1515562141207-7a88fb7ce338', '1490312278390-ab24aa6b2a67'],
  ringRuby:     ['1573408301185-9519f94815b3', '1515562141207-7a88fb7ce338', '1611591437281-460bfbe1220a'],
  ringEmerald:  ['1490312278390-ab24aa6b2a67', '1573408301185-9519f94815b3', '1605100804763-247f67b3557e'],
  ringPlatinum: ['1569582825425-59a9d1b35b05', '1490312278390-ab24aa6b2a67', '1611591437281-460bfbe1220a'],

  // Necklaces
  neckGold:     ['1599643478518-a784e5dc4c8f', '1601121781101-dbaeae7e3e06', '1548048026-5a1a941d93d3'],
  neckDiamond:  ['1526434426615-1abe81efcb0b', '1599643478518-a784e5dc4c8f', '1600493033274-0efbb832b3c5'],
  neckPearl:    ['1506630448388-4e683c67ddb0', '1526434426615-1abe81efcb0b', '1548048026-5a1a941d93d3'],
  neckRoseGold: ['1601121781101-dbaeae7e3e06', '1599643478518-a784e5dc4c8f', '1607703703520-27c6a8a9cd26'],
  neckSilver:   ['1548048026-5a1a941d93d3', '1601121781101-dbaeae7e3e06', '1599643478518-a784e5dc4c8f'],

  // Earrings
  earGold:      ['1543294001-f1cd7ea036f3', '1617038220319-276d3cfab638', '1598560917374-edd4b78a2f12'],
  earDiamond:   ['1617038220319-276d3cfab638', '1543294001-f1cd7ea036f3', '1635767798638-3665a0a107fc'],
  earRoseGold:  ['1598560917374-edd4b78a2f12', '1543294001-f1cd7ea036f3', '1617038220319-276d3cfab638'],
  earPearl:     ['1635767798638-3665a0a107fc', '1617038220319-276d3cfab638', '1543294001-f1cd7ea036f3'],
  earRuby:      ['1543294001-f1cd7ea036f3', '1598560917374-edd4b78a2f12', '1635767798638-3665a0a107fc'],

  // Bangles
  bangleGold:   ['1535632066927-ab7c9ab60908', '1573408301185-9519f94815b3', '1532667449560-72a95c8d8456'],
  bangleDiamond:['1532667449560-72a95c8d8456', '1535632066927-ab7c9ab60908', '1573408301185-9519f94815b3'],
  bangleRoseGold:['1573408301185-9519f94815b3', '1535632066927-ab7c9ab60908', '1532667449560-72a95c8d8456'],

  // Bracelets
  braceletGold:  ['1554412933-514eb6faf9b3', '1617038220319-276d3cfab638', '1532667449560-72a95c8d8456'],
  braceletPearl: ['1532667449560-72a95c8d8456', '1506630448388-4e683c67ddb0', '1554412933-514eb6faf9b3'],
  braceletRose:  ['1617038220319-276d3cfab638', '1554412933-514eb6faf9b3', '1532667449560-72a95c8d8456'],

  // Pendants
  pendantGold:   ['1571027832879-05780c13e6b2', '1607703703520-27c6a8a9cd26', '1599643478518-a784e5dc4c8f'],
  pendantDiamond:['1607703703520-27c6a8a9cd26', '1571027832879-05780c13e6b2', '1526434426615-1abe81efcb0b'],
  pendantEmerald:['1526434426615-1abe81efcb0b', '1571027832879-05780c13e6b2', '1607703703520-27c6a8a9cd26'],
};

interface ProductDef {
  name: string;
  description: string;
  categoryId: string;
  price: number;
  stockQuantity: number;
  metalType: string;
  photos: string[];
  attrs: { attributeId: string; value: string }[];
}

const PRODUCTS: ProductDef[] = [
  // ── RINGS ──────────────────────────────────────────────────────────
  {
    name: 'Classic Gold Solitaire Ring',
    description: 'A timeless 22KT gold solitaire ring with a prong-set diamond. Perfect for engagements and special occasions. Hallmarked and BIS certified.',
    categoryId: CAT.rings,
    price: 42000,
    stockQuantity: 8,
    metalType: 'Gold',
    photos: PHOTOS.ringGold1,
    attrs: [
      { attributeId: ATTR.rings.metal, value: 'Gold' },
      { attributeId: ATTR.rings.stone, value: 'Diamond' },
      { attributeId: ATTR.rings.size,  value: '7' },
    ],
  },
  {
    name: 'Rose Gold Ruby Cocktail Ring',
    description: 'Statement cocktail ring in 18KT rose gold featuring a deep red Burmese ruby surrounded by diamond accents. Perfect for festive occasions.',
    categoryId: CAT.rings,
    price: 38500,
    stockQuantity: 5,
    metalType: 'Rose Gold',
    photos: PHOTOS.ringRoseGold,
    attrs: [
      { attributeId: ATTR.rings.metal, value: 'Rose Gold' },
      { attributeId: ATTR.rings.stone, value: 'Ruby' },
      { attributeId: ATTR.rings.size,  value: '8' },
    ],
  },
  {
    name: 'Diamond Eternity Platinum Band',
    description: 'Elegant platinum eternity band channel-set with 18 round brilliant diamonds totalling 0.90 carats. Ideal as a wedding or anniversary band.',
    categoryId: CAT.rings,
    price: 89000,
    stockQuantity: 4,
    metalType: 'Platinum',
    photos: PHOTOS.ringPlatinum,
    attrs: [
      { attributeId: ATTR.rings.metal, value: 'Platinum' },
      { attributeId: ATTR.rings.stone, value: 'Diamond' },
      { attributeId: ATTR.rings.size,  value: '7' },
    ],
  },
  {
    name: 'Silver Emerald Statement Ring',
    description: 'Handcrafted 92.5 sterling silver ring featuring a vivid green emerald with a vintage-inspired floral setting. Light on the pocket, heavy on style.',
    categoryId: CAT.rings,
    price: 4200,
    stockQuantity: 15,
    metalType: 'Silver',
    photos: PHOTOS.ringEmerald,
    attrs: [
      { attributeId: ATTR.rings.metal, value: 'Silver' },
      { attributeId: ATTR.rings.stone, value: 'Emerald' },
      { attributeId: ATTR.rings.size,  value: '8' },
    ],
  },
  {
    name: 'Gold Wedding Band – Plain',
    description: 'Minimalist 22KT yellow gold plain wedding band with a polished finish. Available in sizes 5–13. A classic that never goes out of style.',
    categoryId: CAT.rings,
    price: 18000,
    stockQuantity: 20,
    metalType: 'Gold',
    photos: PHOTOS.ringGold1,
    attrs: [
      { attributeId: ATTR.rings.metal, value: 'Gold' },
      { attributeId: ATTR.rings.stone, value: 'None' },
      { attributeId: ATTR.rings.size,  value: '9' },
    ],
  },
  {
    name: 'Sapphire & Diamond Rose Gold Ring',
    description: 'Luxurious 18KT rose gold ring with a cushion-cut blue sapphire flanked by two round diamonds. A modern take on the classic three-stone design.',
    categoryId: CAT.rings,
    price: 56000,
    stockQuantity: 3,
    metalType: 'Rose Gold',
    photos: PHOTOS.ringDiamond,
    attrs: [
      { attributeId: ATTR.rings.metal, value: 'Rose Gold' },
      { attributeId: ATTR.rings.stone, value: 'Sapphire' },
      { attributeId: ATTR.rings.size,  value: '7' },
    ],
  },

  // ── NECKLACES ──────────────────────────────────────────────────────
  {
    name: 'Gold Figaro Chain Necklace – 18"',
    description: 'Classic 22KT yellow gold Figaro link chain, 18 inches long, lobster clasp. Versatile enough to wear alone or layered with pendants.',
    categoryId: CAT.necklaces,
    price: 24500,
    stockQuantity: 12,
    metalType: 'Gold',
    photos: PHOTOS.neckGold,
    attrs: [
      { attributeId: ATTR.necklaces.metal, value: 'Gold' },
      { attributeId: ATTR.necklaces.stone, value: 'None' },
    ],
  },
  {
    name: 'Diamond Solitaire Pendant Necklace',
    description: 'Stunning 18KT gold pendant necklace with a 0.50-carat round brilliant diamond in a four-prong setting. Comes with an 18-inch cable chain.',
    categoryId: CAT.necklaces,
    price: 65000,
    stockQuantity: 6,
    metalType: 'Gold',
    photos: PHOTOS.neckDiamond,
    attrs: [
      { attributeId: ATTR.necklaces.metal, value: 'Gold' },
      { attributeId: ATTR.necklaces.stone, value: 'Diamond' },
    ],
  },
  {
    name: 'South Sea Pearl Strand Necklace',
    description: 'Exquisite 20-inch strand of hand-knotted South Sea cultured pearls (9–10mm) with a gold clasp. Each pearl selected for matching lustre and nacre.',
    categoryId: CAT.necklaces,
    price: 32000,
    stockQuantity: 7,
    metalType: 'Gold',
    photos: PHOTOS.neckPearl,
    attrs: [
      { attributeId: ATTR.necklaces.metal, value: 'Gold' },
      { attributeId: ATTR.necklaces.stone, value: 'Pearl' },
    ],
  },
  {
    name: 'Rose Gold Heart Necklace',
    description: 'Dainty 18KT rose gold heart pendant on a delicate 16-inch chain. A thoughtful gift for birthdays, anniversaries, or just because.',
    categoryId: CAT.necklaces,
    price: 14800,
    stockQuantity: 18,
    metalType: 'Rose Gold',
    photos: PHOTOS.neckRoseGold,
    attrs: [
      { attributeId: ATTR.necklaces.metal, value: 'Rose Gold' },
      { attributeId: ATTR.necklaces.stone, value: 'None' },
    ],
  },
  {
    name: 'Silver Layered Boho Chain Set',
    description: 'Set of three sterling silver layered chains (14", 16", 18") with delicate satellite and rolo links. Stack them or wear individually.',
    categoryId: CAT.necklaces,
    price: 3500,
    stockQuantity: 25,
    metalType: 'Silver',
    photos: PHOTOS.neckSilver,
    attrs: [
      { attributeId: ATTR.necklaces.metal, value: 'Silver' },
      { attributeId: ATTR.necklaces.stone, value: 'None' },
    ],
  },

  // ── EARRINGS ───────────────────────────────────────────────────────
  {
    name: 'Gold Diamond Stud Earrings',
    description: 'Pair of 18KT gold stud earrings each set with a 0.25-carat round brilliant diamond (total 0.50 ct). Screw-back for secure everyday wear.',
    categoryId: CAT.earrings,
    price: 48000,
    stockQuantity: 10,
    metalType: 'Gold',
    photos: PHOTOS.earDiamond,
    attrs: [
      { attributeId: ATTR.earrings.metal, value: 'Gold' },
      { attributeId: ATTR.earrings.stone, value: 'Diamond' },
    ],
  },
  {
    name: 'Rose Gold Hoop Earrings – 30mm',
    description: 'Sleek 18KT rose gold hoops, 30mm diameter, with a smooth polished finish and snap closure. The perfect everyday earring.',
    categoryId: CAT.earrings,
    price: 9800,
    stockQuantity: 20,
    metalType: 'Rose Gold',
    photos: PHOTOS.earRoseGold,
    attrs: [
      { attributeId: ATTR.earrings.metal, value: 'Rose Gold' },
      { attributeId: ATTR.earrings.stone, value: 'None' },
    ],
  },
  {
    name: 'Pearl Drop Earrings – Gold',
    description: 'Elegant drop earrings with 8mm Freshwater cultured pearls dangling from a 22KT gold wire hook. Sophisticated yet lightweight.',
    categoryId: CAT.earrings,
    price: 7200,
    stockQuantity: 14,
    metalType: 'Gold',
    photos: PHOTOS.earPearl,
    attrs: [
      { attributeId: ATTR.earrings.metal, value: 'Gold' },
      { attributeId: ATTR.earrings.stone, value: 'Pearl' },
    ],
  },
  {
    name: 'Silver Ruby Jhumka Earrings',
    description: 'Traditional Indian jhumka design in oxidised 92.5 sterling silver, embellished with red ruby stones and intricate filigree work.',
    categoryId: CAT.earrings,
    price: 2800,
    stockQuantity: 30,
    metalType: 'Silver',
    photos: PHOTOS.earRuby,
    attrs: [
      { attributeId: ATTR.earrings.metal, value: 'Silver' },
      { attributeId: ATTR.earrings.stone, value: 'Ruby' },
    ],
  },
  {
    name: 'Gold Chandelier Emerald Earrings',
    description: 'Show-stopping chandelier earrings in 22KT gold featuring cascading emerald drops and diamond-cut accents. Perfect for weddings and grand events.',
    categoryId: CAT.earrings,
    price: 28000,
    stockQuantity: 6,
    metalType: 'Gold',
    photos: PHOTOS.earGold,
    attrs: [
      { attributeId: ATTR.earrings.metal, value: 'Gold' },
      { attributeId: ATTR.earrings.stone, value: 'Emerald' },
    ],
  },

  // ── BANGLES ────────────────────────────────────────────────────────
  {
    name: 'Gold Kangan Bangle Set (Set of 4)',
    description: 'Set of four 22KT gold plain bangles with a bright polished finish, 2.4mm width, 2.6 diameter. A bridal staple passed down through generations.',
    categoryId: CAT.bangles,
    price: 56000,
    stockQuantity: 8,
    metalType: 'Gold',
    photos: PHOTOS.bangleGold,
    attrs: [
      { attributeId: ATTR.bangles.metal, value: 'Gold' },
      { attributeId: ATTR.bangles.stone, value: 'None' },
    ],
  },
  {
    name: 'Diamond Studded Gold Kada',
    description: 'Broad 22KT gold kada (bangle) encrusted with 36 round brilliant diamonds totalling 1.20 carats. A luxurious festive piece.',
    categoryId: CAT.bangles,
    price: 112000,
    stockQuantity: 3,
    metalType: 'Gold',
    photos: PHOTOS.bangleDiamond,
    attrs: [
      { attributeId: ATTR.bangles.metal, value: 'Gold' },
      { attributeId: ATTR.bangles.stone, value: 'Diamond' },
    ],
  },
  {
    name: 'Rose Gold Slim Bangle',
    description: 'Minimalist 18KT rose gold slim bangle with a high-polish finish, 1.5mm wide. Designed for everyday stacking — wear one or many.',
    categoryId: CAT.bangles,
    price: 11500,
    stockQuantity: 22,
    metalType: 'Rose Gold',
    photos: PHOTOS.bangleRoseGold,
    attrs: [
      { attributeId: ATTR.bangles.metal, value: 'Rose Gold' },
      { attributeId: ATTR.bangles.stone, value: 'None' },
    ],
  },

  // ── BRACELETS ──────────────────────────────────────────────────────
  {
    name: 'Gold Tennis Bracelet – 1ct Diamond',
    description: 'Classic 18KT gold tennis bracelet set with 25 round brilliant diamonds totalling 1.0 carat. Box clasp with safety catch. 7 inches length.',
    categoryId: CAT.bracelets,
    price: 95000,
    stockQuantity: 4,
    metalType: 'Gold',
    photos: PHOTOS.braceletGold,
    attrs: [
      { attributeId: ATTR.bracelets.metal, value: 'Gold' },
      { attributeId: ATTR.bracelets.stone, value: 'Diamond' },
    ],
  },
  {
    name: 'Silver Freshwater Pearl Bracelet',
    description: '7-inch sterling silver bracelet strung with 6mm Freshwater pearls and alternating silver beads. Magnetic clasp for easy wear.',
    categoryId: CAT.bracelets,
    price: 4500,
    stockQuantity: 18,
    metalType: 'Silver',
    photos: PHOTOS.braceletPearl,
    attrs: [
      { attributeId: ATTR.bracelets.metal, value: 'Silver' },
      { attributeId: ATTR.bracelets.stone, value: 'Pearl' },
    ],
  },
  {
    name: 'Rose Gold Charm Bracelet',
    description: '18KT rose gold link bracelet with five pre-set charms: star, heart, clover, moon, and infinity. Extendable from 6.5" to 7.5".',
    categoryId: CAT.bracelets,
    price: 22000,
    stockQuantity: 11,
    metalType: 'Rose Gold',
    photos: PHOTOS.braceletRose,
    attrs: [
      { attributeId: ATTR.bracelets.metal, value: 'Rose Gold' },
      { attributeId: ATTR.bracelets.stone, value: 'None' },
    ],
  },

  // ── PENDANTS ───────────────────────────────────────────────────────
  {
    name: 'Gold Om Pendant with Chain',
    description: 'Devotional 22KT gold Om pendant with intricate engraving, 1.5cm height. Includes an 18-inch box chain. BIS hallmarked.',
    categoryId: CAT.pendants,
    price: 8900,
    stockQuantity: 25,
    metalType: 'Gold',
    photos: PHOTOS.pendantGold,
    attrs: [
      { attributeId: ATTR.pendants.metal, value: 'Gold' },
      { attributeId: ATTR.pendants.stone, value: 'None' },
    ],
  },
  {
    name: 'Diamond Solitaire Pendant – 0.25ct',
    description: 'Elegant 18KT gold pendant featuring a 0.25-carat round brilliant diamond in a four-prong bezel setting. Comes with an 18" cable chain.',
    categoryId: CAT.pendants,
    price: 36000,
    stockQuantity: 9,
    metalType: 'Gold',
    photos: PHOTOS.pendantDiamond,
    attrs: [
      { attributeId: ATTR.pendants.metal, value: 'Gold' },
      { attributeId: ATTR.pendants.stone, value: 'Diamond' },
    ],
  },
  {
    name: 'Rose Gold Emerald Floral Pendant',
    description: 'Romantic 18KT rose gold floral pendant centred with a vivid green emerald surrounded by diamond petals. Includes 16" rose gold chain.',
    categoryId: CAT.pendants,
    price: 29500,
    stockQuantity: 7,
    metalType: 'Rose Gold',
    photos: PHOTOS.pendantEmerald,
    attrs: [
      { attributeId: ATTR.pendants.metal, value: 'Rose Gold' },
      { attributeId: ATTR.pendants.stone, value: 'Emerald' },
    ],
  },
  {
    name: 'Silver Pearl Teardrop Pendant',
    description: 'Sterling silver teardrop pendant with a 9mm Freshwater pearl drop and a diamond-cut silver surround. Hypoallergenic, perfect for sensitive skin.',
    categoryId: CAT.pendants,
    price: 3200,
    stockQuantity: 28,
    metalType: 'Silver',
    photos: PHOTOS.pendantGold,
    attrs: [
      { attributeId: ATTR.pendants.metal, value: 'Silver' },
      { attributeId: ATTR.pendants.stone, value: 'Pearl' },
    ],
  },
];

async function main() {
  const vendor = await prisma.vendor.findUnique({ where: { id: VENDOR_ID } });
  if (!vendor) {
    console.error('Vendor not found:', VENDOR_ID);
    process.exit(1);
  }
  console.log(`Seeding products for vendor: ${vendor.shopName}`);

  let created = 0;
  let skipped = 0;

  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { vendorId: VENDOR_ID, name: p.name },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.product.create({
      data: {
        vendorId: VENDOR_ID,
        name: p.name,
        description: p.description,
        categoryId: p.categoryId,
        metalType: p.metalType,
        price: p.price,
        stockQuantity: p.stockQuantity,
        isActive: true,
        images: p.photos.map((id) => img(id)),
        attributeValues: {
          create: p.attrs.map((a) => ({
            attributeId: a.attributeId,
            value: a.value,
          })),
        },
      },
    });
    created++;
    process.stdout.write(`  ✓ ${p.name}\n`);
  }

  console.log(`\nDone — ${created} products created, ${skipped} already existed.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
