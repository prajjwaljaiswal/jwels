import { PrismaClient, AttributeInputType } from '@prisma/client';

const prisma = new PrismaClient();

type AttrSpec = {
  name: string;
  inputType: AttributeInputType;
  isRequired?: boolean;
  options?: string[]; // only used when inputType === SELECT
};

// Attributes shared by every jewellery category. Vendors can leave them blank;
// they exist so the storefront can filter consistently across categories.
const SHARED: AttrSpec[] = [
  {
    name: 'Style',
    inputType: AttributeInputType.SELECT,
    options: [
      'Traditional', 'Contemporary', 'Antique', 'Minimalist',
      'Kundan', 'Polki', 'Meenakari', 'Temple', 'Jadau', 'Oxidised',
    ],
  },
  {
    name: 'Occasion',
    inputType: AttributeInputType.SELECT,
    options: ['Daily wear', 'Office', 'Party', 'Festive', 'Bridal', 'Gifting'],
  },
  {
    name: 'Finish',
    inputType: AttributeInputType.SELECT,
    options: ['Polished', 'Matte', 'Hammered', 'Brushed', 'Antique'],
  },
];

const RING_SIZES = ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '11', '12', '13', '14'];

const CATEGORY_ATTRIBUTES: Record<string, AttrSpec[]> = {
  rings: [
    ...SHARED,
    {
      name: 'Ring size (US)',
      inputType: AttributeInputType.SELECT,
      options: RING_SIZES,
    },
    {
      name: 'Diamond shape',
      inputType: AttributeInputType.SELECT,
      options: ['Round', 'Princess', 'Oval', 'Marquise', 'Pear', 'Cushion', 'Emerald', 'Asscher', 'Radiant', 'Heart'],
    },
    {
      name: 'Diamond clarity',
      inputType: AttributeInputType.SELECT,
      options: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2'],
    },
    {
      name: 'Diamond colour',
      inputType: AttributeInputType.SELECT,
      options: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'],
    },
    { name: 'Diamond carat (ct)', inputType: AttributeInputType.TEXT },
    { name: 'Diamond count',      inputType: AttributeInputType.NUMBER },
    {
      name: 'Setting type',
      inputType: AttributeInputType.SELECT,
      options: ['Prong', 'Bezel', 'Pavé', 'Channel', 'Halo', 'Cluster', 'Tension', 'Bar'],
    },
    { name: 'Band width (mm)', inputType: AttributeInputType.NUMBER },
  ],
  necklaces: [
    ...SHARED,
    {
      name: 'Chain length',
      inputType: AttributeInputType.SELECT,
      options: ['14"', '16"', '18"', '20"', '22"', '24"', '28"', '30"', 'Custom'],
    },
    {
      name: 'Chain type',
      inputType: AttributeInputType.SELECT,
      options: ['Rope', 'Box', 'Curb', 'Snake', 'Cuban', 'Singapore', 'Figaro', 'Bead'],
    },
    {
      name: 'Closure',
      inputType: AttributeInputType.SELECT,
      options: ['Lobster', 'Spring ring', 'Hook', 'Box', 'Toggle', 'S-hook'],
    },
    {
      name: 'Stone',
      inputType: AttributeInputType.SELECT,
      options: ['Diamond', 'Lab-grown diamond', 'Moissanite', 'CZ / American Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'Kundan', 'Polki', 'Glass', 'Bead', 'None'],
    },
  ],
  earrings: [
    ...SHARED,
    {
      name: 'Earring style',
      inputType: AttributeInputType.SELECT,
      options: ['Stud', 'Drop', 'Dangler', 'Hoop', 'Jhumka', 'Chandbali', 'Ear cuff', 'Threader', 'Huggie'],
    },
    {
      name: 'Back type',
      inputType: AttributeInputType.SELECT,
      options: ['Push back', 'Screw back', 'Clip-on', 'French hook', 'Lever back'],
    },
    { name: 'Hoop diameter (mm)', inputType: AttributeInputType.NUMBER },
    {
      name: 'Stone',
      inputType: AttributeInputType.SELECT,
      options: ['Diamond', 'Lab-grown diamond', 'Moissanite', 'CZ / American Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'Kundan', 'Polki', 'Glass', 'Bead', 'None'],
    },
  ],
  bangles: [
    ...SHARED,
    {
      name: 'Indian size',
      inputType: AttributeInputType.SELECT,
      options: ['2.2', '2.4', '2.6', '2.8', '2.10', '2.12'],
    },
    {
      name: 'Bangle type',
      inputType: AttributeInputType.SELECT,
      options: ['Kada', 'Bangle', 'Cuff', 'Openable', 'Hinged'],
    },
    { name: 'Inner diameter (mm)', inputType: AttributeInputType.NUMBER },
  ],
  bracelets: [
    ...SHARED,
    {
      name: 'Bracelet length',
      inputType: AttributeInputType.SELECT,
      options: ['6"', '6.5"', '7"', '7.5"', '8"', '8.5"', 'Adjustable'],
    },
    {
      name: 'Closure',
      inputType: AttributeInputType.SELECT,
      options: ['Lobster', 'Spring ring', 'Hook', 'Box', 'Toggle', 'Magnetic'],
    },
    {
      name: 'Stone',
      inputType: AttributeInputType.SELECT,
      options: ['Diamond', 'Lab-grown diamond', 'Moissanite', 'CZ / American Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'Kundan', 'Glass', 'Bead', 'None'],
    },
  ],
  pendants: [
    ...SHARED,
    {
      name: 'Includes chain',
      inputType: AttributeInputType.SELECT,
      options: ['Yes', 'No'],
    },
    { name: 'Pendant length (mm)', inputType: AttributeInputType.NUMBER },
    { name: 'Pendant width (mm)',  inputType: AttributeInputType.NUMBER },
    {
      name: 'Stone',
      inputType: AttributeInputType.SELECT,
      options: ['Diamond', 'Lab-grown diamond', 'Moissanite', 'CZ / American Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'Kundan', 'Polki', 'Glass', 'Bead', 'None'],
    },
  ],

  // Lab-grown diamond pendants — diamond-grade filter attributes.
  'pendants-lab-grown-diamond': [
    ...SHARED,
    {
      name: 'Diamond Cut',
      inputType: AttributeInputType.SELECT,
      options: ['Round', 'Princess', 'Cushion', 'Emerald', 'Asscher', 'Oval', 'Radiant', 'Pear', 'Heart', 'Marquise', 'Baguette'],
    },
    {
      name: 'Diamond Color',
      inputType: AttributeInputType.SELECT,
      options: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'],
    },
    {
      name: 'Diamond Clarity',
      inputType: AttributeInputType.SELECT,
      options: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1'],
    },
    {
      name: 'Setting Type',
      inputType: AttributeInputType.SELECT,
      options: ['Prong', 'Bezel', 'Halo', 'Tension', 'Channel', 'Pave', 'Flush', 'Bar'],
    },
    {
      name: 'Pendant Style',
      inputType: AttributeInputType.SELECT,
      options: ['Solitaire', 'Halo', 'East-West', 'Three Stone', 'Cluster', 'Drop', 'Bar', 'Cross', 'Initial'],
    },
    {
      name: 'Chain Type',
      inputType: AttributeInputType.SELECT,
      options: ['Cable', 'Box', 'Rope', 'Wheat', 'Snake', 'Singapore', 'Curb', 'Figaro'],
    },
    {
      name: 'Chain Length',
      inputType: AttributeInputType.SELECT,
      options: ['14"', '16"', '18"', '20"', '22"', '24"', '30"'],
    },
    {
      name: 'Carat Weight',
      inputType: AttributeInputType.SELECT,
      options: ['Under 0.50 ct', '0.50–0.99 ct', '1.00–1.49 ct', '1.50–1.99 ct', '2.00–2.99 ct', '3.00–4.99 ct', '5.00 ct & above'],
    },
    {
      name: 'Diamond Count',
      inputType: AttributeInputType.NUMBER,
    },
    {
      name: 'Certification',
      inputType: AttributeInputType.SELECT,
      options: ['IGI', 'GIA', 'SGL', 'HRD', 'BIS Hallmark', 'None'],
    },
  ],
};

async function main() {
  for (const [slug, attrs] of Object.entries(CATEGORY_ATTRIBUTES)) {
    const category = await prisma.category.findUnique({ where: { slug } });
    if (!category) {
      console.warn(`[skip] no category for slug "${slug}"`);
      continue;
    }

    for (let i = 0; i < attrs.length; i++) {
      const spec = attrs[i];
      const attribute = await prisma.categoryAttribute.upsert({
        where: { categoryId_name: { categoryId: category.id, name: spec.name } },
        update: { inputType: spec.inputType, isRequired: spec.isRequired ?? false, sortOrder: i },
        create: {
          categoryId: category.id,
          name: spec.name,
          inputType: spec.inputType,
          isRequired: spec.isRequired ?? false,
          sortOrder: i,
        },
      });

      if (spec.inputType === AttributeInputType.SELECT && spec.options) {
        // Wipe and re-create options so renames stay consistent. Safe because
        // ProductAttributeValue stores the value as a string, not by option id.
        await prisma.categoryAttributeOption.deleteMany({ where: { attributeId: attribute.id } });
        await prisma.categoryAttributeOption.createMany({
          data: spec.options.map((value, sortOrder) => ({
            attributeId: attribute.id,
            value,
            sortOrder,
          })),
        });
      }
    }
    console.log(`[ok] seeded ${attrs.length} attributes for "${slug}"`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
