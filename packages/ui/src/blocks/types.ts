export type PageKind = 'HOMEPAGE' | 'CUSTOM' | 'PDP' | 'CART' | 'CHECKOUT';

export type BlockType =
  | 'hero'
  | 'productGrid'
  | 'featuredSection'
  | 'richText'
  | 'imageWithText'
  | 'testimonials'
  | 'faq'
  | 'videoEmbed'
  | 'featureStrip'
  | 'categoryTiles'
  | 'editorialCards'
  | 'iconGrid'
  | 'imageStrip'
  | 'imageSlider'
  | 'emailCapture'
  // PDP-specific blocks
  | 'pdpGallery'
  | 'pdpSummary'
  | 'pdpVariants'
  | 'pdpQuantityCart'
  | 'pdpAttributes'
  | 'pdpDescription'
  | 'pdpPersonalization'
  | 'pdpReviews'
  | 'pdpRelatedProducts'
  | 'pdpTrustStrip'
  | 'pdpShippingEstimator'
  // Cart-specific blocks
  | 'cartLineItems'
  | 'cartSummary'
  | 'cartUpsell'
  | 'cartTrustStrip'
  | 'cartAnnouncement'
  // Checkout-specific blocks
  | 'checkoutSteps'
  | 'checkoutAddressForm'
  | 'checkoutShipping'
  | 'checkoutPayment'
  | 'checkoutOrderSummary'
  | 'checkoutGiftWrap'
  | 'checkoutCustomFields'
  | 'checkoutTrustStrip'
  | 'checkoutAnnouncement';

export interface Block<TSettings = any> {
  id: string;
  type: BlockType;
  settings: TSettings;
  // When true, the block is skipped by public renderers but still visible in
  // the editor (with a "Hidden" overlay) so vendors can toggle without losing
  // configuration. Defaults to false / undefined.
  hidden?: boolean;
}

// Pages are owned by a specific vendor — scope is retained as a discriminator
// in case more contexts are added later. PDP/cart/checkout blocks receive
// product/cart context populated by the storefront route renderer.
export interface RenderContext {
  scope: 'vendor';
  vendorId: string;
  pageKind?: PageKind;
  product?: any;   // product object on PDP routes
  cart?: any;      // cart state on cart/checkout routes
  checkout?: any;  // checkout machine state on checkout route
}

export interface EditorContext {
  scope: 'vendor';
  vendorId: string;
  pageId: string;
  pageKind?: PageKind;
}

export interface BlockDefinition<TSettings = any> {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultSettings: () => TSettings;
  Renderer: React.ComponentType<{ settings: TSettings; ctx: RenderContext }>;
  Editor: React.ComponentType<{
    settings: TSettings;
    onChange: (next: TSettings) => void;
    ctx: EditorContext;
  }>;
  // Which page kinds may include this block. Defaults to homepage + custom only.
  allowedKinds?: PageKind[];
  // Blocks marked required cannot be removed from a page of that kind.
  requiredOn?: PageKind[];
}
