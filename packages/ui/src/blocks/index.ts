import type { BlockDefinition, BlockType } from './types';
import { HeroRenderer, defaultHero } from './hero/Hero';
import { HeroEditor } from './hero/HeroEditor';
import { ProductGridRenderer, defaultProductGrid } from './productGrid/ProductGrid';
import { ProductGridEditor } from './productGrid/ProductGridEditor';
import { RichTextRenderer, defaultRichText } from './richText/RichText';
import { RichTextEditor } from './richText/RichTextEditor';
import { FeaturedSectionRenderer, defaultFeaturedSection } from './featuredSection/FeaturedSection';
import { FeaturedSectionEditor } from './featuredSection/FeaturedSectionEditor';
import { ImageWithTextRenderer, defaultImageWithText } from './imageWithText/ImageWithText';
import { ImageWithTextEditor } from './imageWithText/ImageWithTextEditor';
import { TestimonialsRenderer, defaultTestimonials } from './testimonials/Testimonials';
import { TestimonialsEditor } from './testimonials/TestimonialsEditor';
import { FaqRenderer, defaultFaq } from './faq/Faq';
import { FaqEditor } from './faq/FaqEditor';
import { VideoEmbedRenderer, defaultVideoEmbed } from './videoEmbed/VideoEmbed';
import { VideoEmbedEditor } from './videoEmbed/VideoEmbedEditor';
import { FeatureStripRenderer, defaultFeatureStrip } from './featureStrip/FeatureStrip';
import { FeatureStripEditor } from './featureStrip/FeatureStripEditor';
import { CategoryTilesRenderer, defaultCategoryTiles } from './categoryTiles/CategoryTiles';
import { CategoryTilesEditor } from './categoryTiles/CategoryTilesEditor';
import { EditorialCardsRenderer, defaultEditorialCards } from './editorialCards/EditorialCards';
import { EditorialCardsEditor } from './editorialCards/EditorialCardsEditor';
import { IconGridRenderer, defaultIconGrid } from './iconGrid/IconGrid';
import { IconGridEditor } from './iconGrid/IconGridEditor';
import { ImageStripRenderer, defaultImageStrip } from './imageStrip/ImageStrip';
import { ImageStripEditor } from './imageStrip/ImageStripEditor';
import { ImageSliderRenderer, defaultImageSlider } from './imageSlider/ImageSlider';
import { ImageSliderEditor } from './imageSlider/ImageSliderEditor';
import { EmailCaptureRenderer, defaultEmailCapture } from './emailCapture/EmailCapture';
import { EmailCaptureEditor } from './emailCapture/EmailCaptureEditor';
import { SYSTEM_BLOCK_DEFINITIONS } from './system/factory';

const HOMEPAGE_ONLY: ('HOMEPAGE'|'CUSTOM')[] = ['HOMEPAGE','CUSTOM'];

const LEGACY_BLOCK_REGISTRY: Partial<Record<BlockType, BlockDefinition>> = {
  hero: {
    type: 'hero',
    label: 'Hero banner',
    description: 'Big headline + image + call-to-action',
    icon: '🖼️',
    defaultSettings: defaultHero,
    Renderer: HeroRenderer as any,
    Editor: HeroEditor as any,
  },
  productGrid: {
    type: 'productGrid',
    label: 'Product grid',
    description: 'Show a grid of your products',
    icon: '🛍️',
    defaultSettings: defaultProductGrid,
    Renderer: ProductGridRenderer as any,
    Editor: ProductGridEditor as any,
  },
  featuredSection: {
    type: 'featuredSection',
    label: 'Featured section',
    description: 'Showcase one shop section as grid or carousel',
    icon: '⭐',
    defaultSettings: defaultFeaturedSection,
    Renderer: FeaturedSectionRenderer as any,
    Editor: FeaturedSectionEditor as any,
  },
  richText: {
    type: 'richText',
    label: 'Rich text',
    description: 'Headings, paragraphs, lists, links',
    icon: '📝',
    defaultSettings: defaultRichText,
    Renderer: RichTextRenderer as any,
    Editor: RichTextEditor as any,
  },
  imageWithText: {
    type: 'imageWithText',
    label: 'Image + text',
    description: 'Image on one side, copy on the other',
    icon: '🖼️',
    defaultSettings: defaultImageWithText,
    Renderer: ImageWithTextRenderer as any,
    Editor: ImageWithTextEditor as any,
  },
  testimonials: {
    type: 'testimonials',
    label: 'Testimonials',
    description: 'Customer quotes with author and rating',
    icon: '💬',
    defaultSettings: defaultTestimonials,
    Renderer: TestimonialsRenderer as any,
    Editor: TestimonialsEditor as any,
  },
  faq: {
    type: 'faq',
    label: 'FAQ',
    description: 'Expandable questions and answers',
    icon: '❓',
    defaultSettings: defaultFaq,
    Renderer: FaqRenderer as any,
    Editor: FaqEditor as any,
  },
  videoEmbed: {
    type: 'videoEmbed',
    label: 'Video embed',
    description: 'YouTube, Vimeo, or MP4 player',
    icon: '🎬',
    defaultSettings: defaultVideoEmbed,
    Renderer: VideoEmbedRenderer as any,
    Editor: VideoEmbedEditor as any,
  },
  featureStrip: {
    type: 'featureStrip',
    label: 'Feature / trust strip',
    description: 'Row of icon + label items (hallmark, returns, certification)',
    icon: '✓',
    defaultSettings: defaultFeatureStrip,
    Renderer: FeatureStripRenderer as any,
    Editor: FeatureStripEditor as any,
  },
  categoryTiles: {
    type: 'categoryTiles',
    label: 'Category tiles',
    description: 'Image tiles with overlay title, linking to categories or collections',
    icon: '🟦',
    defaultSettings: defaultCategoryTiles,
    Renderer: CategoryTilesRenderer as any,
    Editor: CategoryTilesEditor as any,
  },
  editorialCards: {
    type: 'editorialCards',
    label: 'Editorial cards',
    description: '3-up blog-style cards with image + heading + CTA',
    icon: '📰',
    defaultSettings: defaultEditorialCards,
    Renderer: EditorialCardsRenderer as any,
    Editor: EditorialCardsEditor as any,
  },
  iconGrid: {
    type: 'iconGrid',
    label: 'Icon grid',
    description: 'Grid of icon + heading + caption (promises, birthstones)',
    icon: '✦',
    defaultSettings: defaultIconGrid,
    Renderer: IconGridRenderer as any,
    Editor: IconGridEditor as any,
  },
  imageStrip: {
    type: 'imageStrip',
    label: 'Image strip',
    description: '2–4 lifestyle photos in a row, edge-to-edge',
    icon: '🖼',
    defaultSettings: defaultImageStrip,
    Renderer: ImageStripRenderer as any,
    Editor: ImageStripEditor as any,
  },
  imageSlider: {
    type: 'imageSlider',
    label: 'Image slider',
    description: 'Full-width auto-rotating banner carousel — upload multiple images',
    icon: '🎠',
    defaultSettings: defaultImageSlider,
    Renderer: ImageSliderRenderer as any,
    Editor: ImageSliderEditor as any,
  },
  emailCapture: {
    type: 'emailCapture',
    label: 'Email capture',
    description: 'Newsletter signup with optional incentive code',
    icon: '✉',
    defaultSettings: defaultEmailCapture,
    Renderer: EmailCaptureRenderer as any,
    Editor: EmailCaptureEditor as any,
  },
};

// Mark every legacy block as available on homepage + custom pages by default.
// PDP/cart/checkout-allowed legacy blocks (richText/faq/featureStrip…) extend
// their allowedKinds here.
for (const def of Object.values(LEGACY_BLOCK_REGISTRY)) {
  if (def && !def.allowedKinds) def.allowedKinds = HOMEPAGE_ONLY as any;
}
const extendKinds = (type: BlockType, kinds: BlockDefinition['allowedKinds']) => {
  const d = LEGACY_BLOCK_REGISTRY[type];
  if (d) d.allowedKinds = kinds;
};
extendKinds('richText',     ['HOMEPAGE','CUSTOM','PDP','CART','CHECKOUT']);
extendKinds('faq',          ['HOMEPAGE','CUSTOM','PDP','CART','CHECKOUT']);
extendKinds('featureStrip', ['HOMEPAGE','CUSTOM','PDP','CART','CHECKOUT']);
extendKinds('testimonials', ['HOMEPAGE','CUSTOM','PDP']);
extendKinds('videoEmbed',   ['HOMEPAGE','CUSTOM','PDP']);
extendKinds('emailCapture', ['HOMEPAGE','CUSTOM','CART']);

export const BLOCK_REGISTRY: Record<BlockType, BlockDefinition | undefined> = {
  ...LEGACY_BLOCK_REGISTRY,
  ...SYSTEM_BLOCK_DEFINITIONS,
} as Record<BlockType, BlockDefinition | undefined>;

export const AVAILABLE_BLOCKS = Object.values(BLOCK_REGISTRY).filter(
  (b): b is BlockDefinition => b !== undefined
);

export function blocksForPageKind(kind: BlockDefinition['allowedKinds'] extends infer K ? string : string): BlockDefinition[] {
  return AVAILABLE_BLOCKS.filter((b) => !b.allowedKinds || b.allowedKinds.includes(kind as any));
}

export type { BlockType, BlockDefinition } from './types';
