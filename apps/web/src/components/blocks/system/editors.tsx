'use client';

// Hand-built editors for every PDP / cart / checkout block.
//
// Each editor is a small function component composed from primitives in
// formPrimitives.tsx. Replaces the GenericKeyValueEditor, which couldn't
// handle arrays (trust-strip items, checkout custom fields) and presented
// raw setting keys to vendors.

import {
  TextField, TextareaField, NumberField, BooleanField, SelectField,
  ItemArrayField, VendorSectionsSelect, FieldLabel, ImageField,
} from './formPrimitives';

type EditorProps = { settings: any; onChange: (next: any) => void; ctx: any };

// ─────────────────────────────────────────────────────────────────────────────
// PDP block editors
// ─────────────────────────────────────────────────────────────────────────────

export function PdpGalleryEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <SelectField
        label="Gallery position"
        value={settings.position ?? 'left'}
        onChange={(v) => onChange({ ...settings, position: v })}
        options={[
          { value: 'left', label: 'Left of product info' },
          { value: 'right', label: 'Right of product info' },
          { value: 'below', label: 'Below product info' },
        ]}
      />
      <BooleanField
        label="Zoom on hover"
        value={!!settings.zoom}
        onChange={(v) => onChange({ ...settings, zoom: v })}
      />
    </div>
  );
}

export function PdpSummaryEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <BooleanField label="Show vendor / shop name" value={settings.showVendor !== false}
        onChange={(v) => onChange({ ...settings, showVendor: v })} />
      <BooleanField label="Show star rating" value={settings.showRating !== false}
        onChange={(v) => onChange({ ...settings, showRating: v })} />
      <BooleanField label="Stick to top on scroll" value={!!settings.sticky}
        onChange={(v) => onChange({ ...settings, sticky: v })}
        hint="Keeps title + price visible as the page scrolls." />
    </div>
  );
}

export function PdpVariantsEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <BooleanField label="Show size guide link" value={!!settings.showSizeGuide}
        onChange={(v) => onChange({ ...settings, showSizeGuide: v })} />
      {settings.showSizeGuide && (
        <TextField label="Size guide URL" placeholder="https://…/size-guide"
          value={settings.sizeGuideUrl ?? ''}
          onChange={(v) => onChange({ ...settings, sizeGuideUrl: v })} />
      )}
    </div>
  );
}

export function PdpQuantityCartEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Primary CTA label" placeholder="Add to bag" maxLength={40}
        value={settings.ctaLabel ?? ''}
        onChange={(v) => onChange({ ...settings, ctaLabel: v })} />
      <BooleanField label="Show 'Buy it now'" value={settings.showBuyNow !== false}
        onChange={(v) => onChange({ ...settings, showBuyNow: v })} />
      <BooleanField label="Show wishlist button" value={settings.showWishlist !== false}
        onChange={(v) => onChange({ ...settings, showWishlist: v })} />
    </div>
  );
}

export function PdpAttributesEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="Details" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
      <p className="text-[11px] text-ink-500">
        Attributes are sourced automatically from each product's attribute values.
      </p>
    </div>
  );
}

export function PdpDescriptionEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="About this piece" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
      <BooleanField label="Collapsible accordion" value={!!settings.collapsible}
        onChange={(v) => onChange({ ...settings, collapsible: v })}
        hint="Vendors with long copy may prefer collapsing it." />
    </div>
  );
}

export function PdpPersonalizationEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="Make it yours" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
      <p className="text-[11px] text-ink-500">
        Visible only on products that have personalisation enabled.
      </p>
    </div>
  );
}

export function PdpReviewsEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="Customer reviews" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
      <BooleanField label="Show 'Write a review' button" value={settings.showWriteReview !== false}
        onChange={(v) => onChange({ ...settings, showWriteReview: v })} />
    </div>
  );
}

export function PdpRelatedProductsEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="You may also love" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
      <SelectField
        label="Source"
        value={settings.source ?? 'section'}
        onChange={(v) => onChange({ ...settings, source: v })}
        options={[
          { value: 'section',  label: 'Same shop section' },
          { value: 'category', label: 'Same category' },
          { value: 'vendor',   label: 'Anything from this vendor' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Columns"
          value={String(settings.columns ?? 4) as '2'|'3'|'4'}
          onChange={(v) => onChange({ ...settings, columns: Number(v) })}
          options={[
            { value: '2', label: '2 columns' },
            { value: '3', label: '3 columns' },
            { value: '4', label: '4 columns' },
          ]}
        />
        <NumberField label="Max products" min={2} max={24}
          value={Number(settings.limit ?? 8)}
          onChange={(v) => onChange({ ...settings, limit: v })} />
      </div>
    </div>
  );
}

function TrustItemsEditor({ settings, onChange, max = 6 }: EditorProps & { max?: number }) {
  return (
    <ItemArrayField<{ iconUrl?: string; label: string; sublabel?: string }>
      label="Trust badges"
      items={(settings.items ?? []) as any[]}
      onChange={(items) => onChange({ ...settings, items })}
      newItem={() => ({ iconUrl: '', label: 'New badge', sublabel: '' })}
      max={max}
      emptyHint="No badges yet. Add up to 6 — hallmark, returns, secure payment, etc."
      addLabel="Add badge"
      renderItem={(it, update) => (
        <>
          <TextField label="Label" placeholder="BIS-hallmarked" maxLength={60}
            value={it.label ?? ''} onChange={(v) => update({ label: v })} />
          <TextField label="Sublabel (optional)" placeholder="Assay-certified gold" maxLength={80}
            value={it.sublabel ?? ''} onChange={(v) => update({ sublabel: v })} />
          <ImageField label="Icon (optional)"
            value={it.iconUrl ?? ''} onChange={(v) => update({ iconUrl: v })} />
        </>
      )}
    />
  );
}

export function PdpTrustStripEditor({ settings, onChange, ctx }: EditorProps) {
  return (
    <div className="p-3">
      <TrustItemsEditor settings={settings} onChange={onChange} ctx={ctx} max={6} />
    </div>
  );
}

export function PdpShippingEstimatorEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="Check delivery" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart block editors
// ─────────────────────────────────────────────────────────────────────────────

export function CartLineItemsEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <BooleanField label="Show product thumbnails" value={settings.showThumbnail !== false}
        onChange={(v) => onChange({ ...settings, showThumbnail: v })} />
      <BooleanField label="Show remove button" value={settings.showRemove !== false}
        onChange={(v) => onChange({ ...settings, showRemove: v })} />
    </div>
  );
}

export function CartSummaryEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <BooleanField label="Allow coupon entry" value={!!settings.showCoupon}
        onChange={(v) => onChange({ ...settings, showCoupon: v })} />
      <TextField label="Checkout button label" placeholder="Proceed to checkout" maxLength={40}
        value={settings.ctaLabel ?? ''}
        onChange={(v) => onChange({ ...settings, ctaLabel: v })} />
    </div>
  );
}

export function CartUpsellEditor({ settings, onChange }: EditorProps) {
  const source = settings.source ?? 'related';
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="Pairs beautifully with" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
      <SelectField
        label="Source"
        value={source}
        onChange={(v) => onChange({ ...settings, source: v })}
        options={[
          { value: 'related', label: 'Related to cart items' },
          { value: 'section', label: 'A specific shop section' },
          { value: 'vendor',  label: 'Anything from this vendor' },
        ]}
      />
      {source === 'section' && (
        <VendorSectionsSelect label="Section" value={settings.sectionId ?? ''}
          onChange={(id) => onChange({ ...settings, sectionId: id })} />
      )}
      <NumberField label="Max products" min={2} max={12}
        value={Number(settings.limit ?? 6)}
        onChange={(v) => onChange({ ...settings, limit: v })} />
    </div>
  );
}

export function CartTrustStripEditor({ settings, onChange, ctx }: EditorProps) {
  return (
    <div className="p-3">
      <ItemArrayField<{ iconUrl?: string; label: string }>
        label="Trust badges"
        items={(settings.items ?? []) as any[]}
        onChange={(items) => onChange({ ...settings, items })}
        newItem={() => ({ iconUrl: '', label: 'Secure checkout' })}
        max={6}
        emptyHint="Add 3-5 short reassurance items (Secure checkout, COD, EMI…)."
        addLabel="Add badge"
        renderItem={(it, update) => (
          <>
            <TextField label="Label" maxLength={60}
              value={it.label ?? ''} onChange={(v) => update({ label: v })} />
            <ImageField label="Icon (optional)"
              value={it.iconUrl ?? ''} onChange={(v) => update({ iconUrl: v })} />
          </>
        )}
      />
    </div>
  );
}

export function CartAnnouncementEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Bar copy" placeholder="Free insured shipping on orders over ₹2,000"
        maxLength={200}
        value={settings.text ?? ''}
        onChange={(v) => onChange({ ...settings, text: v })} />
      <SelectField
        label="Background"
        value={settings.background ?? 'canvas'}
        onChange={(v) => onChange({ ...settings, background: v })}
        options={[
          { value: 'none',   label: 'None (transparent)' },
          { value: 'canvas', label: 'Canvas (subtle)' },
          { value: 'brand',  label: 'Brand colour (bold)' },
        ]}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout block editors
// ─────────────────────────────────────────────────────────────────────────────

export function CheckoutStepsEditor() {
  return (
    <div className="p-3 text-[11px] text-ink-500">
      Step indicator. No configuration — the address → shipping → payment order is fixed.
    </div>
  );
}

export function CheckoutAddressFormEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="Delivery address" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
    </div>
  );
}

export function CheckoutShippingEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="Shipping method" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
    </div>
  );
}

export function CheckoutPaymentEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="Payment" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
      <p className="text-[11px] text-ink-500">
        Payment methods are managed under <a className="underline" href="/vendor/payments" target="_blank" rel="noreferrer">Payment methods</a>.
      </p>
    </div>
  );
}

export function CheckoutOrderSummaryEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <SelectField
        label="Position"
        value={settings.position ?? 'sidebar'}
        onChange={(v) => onChange({ ...settings, position: v })}
        options={[
          { value: 'sidebar', label: 'Right sidebar (sticky)' },
          { value: 'inline',  label: 'Inline (above payment)' },
        ]}
      />
    </div>
  );
}

export function CheckoutGiftWrapEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="Wrap as a gift" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
      <NumberField label="Add-on price" min={0} max={100000} step={1} suffix="₹"
        value={Number(settings.price ?? 0)}
        onChange={(v) => onChange({ ...settings, price: v })}
        hint="0 = free / complimentary" />
    </div>
  );
}

export function CheckoutCustomFieldsEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Heading" placeholder="Order details" maxLength={200}
        value={settings.heading ?? ''} onChange={(v) => onChange({ ...settings, heading: v })} />
      <ItemArrayField<{ key: string; label: string; type: 'text'|'textarea'|'select'; required?: boolean; options?: string[] }>
        label="Custom fields"
        items={(settings.fields ?? []) as any[]}
        onChange={(fields) => onChange({ ...settings, fields })}
        newItem={() => ({ key: `field_${Date.now().toString(36).slice(-4)}`, label: 'New field', type: 'text', required: false, options: [] })}
        max={8}
        emptyHint="No custom fields. Add inputs like 'Gift note' or 'Preferred delivery window'."
        addLabel="Add field"
        renderItem={(it, update) => (
          <>
            <TextField label="Label" placeholder="Gift note" maxLength={80}
              value={it.label ?? ''} onChange={(v) => update({ label: v })} />
            <TextField label="Key (internal)" placeholder="gift_note" maxLength={40}
              value={it.key ?? ''}
              onChange={(v) => update({ key: v.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40) })}
              hint="Stored alongside the order. Lowercase, no spaces." />
            <SelectField
              label="Type"
              value={it.type ?? 'text'}
              onChange={(v) => update({ type: v })}
              options={[
                { value: 'text',     label: 'Short text' },
                { value: 'textarea', label: 'Long text' },
                { value: 'select',   label: 'Dropdown' },
              ]}
            />
            <BooleanField label="Required" value={!!it.required}
              onChange={(v) => update({ required: v })} />
            {it.type === 'select' && (
              <div>
                <FieldLabel hint="One option per line">Options</FieldLabel>
                <textarea
                  className="input-field w-full py-2"
                  rows={3}
                  value={(it.options ?? []).join('\n')}
                  onChange={(e) =>
                    update({ options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20) })
                  }
                  placeholder={'Anytime\nMorning (9–12)\nAfternoon (12–5)'}
                />
              </div>
            )}
          </>
        )}
      />
    </div>
  );
}

export function CheckoutTrustStripEditor({ settings, onChange, ctx }: EditorProps) {
  return (
    <div className="p-3">
      <ItemArrayField<{ iconUrl?: string; label: string }>
        label="Security badges"
        items={(settings.items ?? []) as any[]}
        onChange={(items) => onChange({ ...settings, items })}
        newItem={() => ({ iconUrl: '', label: 'Secure 256-bit checkout' })}
        max={6}
        emptyHint="Add reassurance items shoppers see before paying."
        addLabel="Add badge"
        renderItem={(it, update) => (
          <>
            <TextField label="Label" maxLength={60}
              value={it.label ?? ''} onChange={(v) => update({ label: v })} />
            <ImageField label="Icon (optional)"
              value={it.iconUrl ?? ''} onChange={(v) => update({ iconUrl: v })} />
          </>
        )}
      />
    </div>
  );
}

export function CheckoutAnnouncementEditor({ settings, onChange }: EditorProps) {
  return (
    <div className="space-y-3 p-3">
      <TextField label="Bar copy" placeholder="Order ships insured within 2 business days"
        maxLength={200}
        value={settings.text ?? ''}
        onChange={(v) => onChange({ ...settings, text: v })} />
      <SelectField
        label="Background"
        value={settings.background ?? 'canvas'}
        onChange={(v) => onChange({ ...settings, background: v })}
        options={[
          { value: 'none',   label: 'None (transparent)' },
          { value: 'canvas', label: 'Canvas (subtle)' },
          { value: 'brand',  label: 'Brand colour (bold)' },
        ]}
      />
    </div>
  );
}
