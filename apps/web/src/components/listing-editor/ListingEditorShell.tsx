'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { ListingDraft, EMPTY_DRAFT, STEPS, StepId, stepStatus, canPublish } from './types';
import { MediaStep }     from './steps/MediaStep';
import { CategoryStep }  from './steps/CategoryStep';
import { DetailsStep }   from './steps/DetailsStep';
import { OptionsStep }   from './steps/OptionsStep';
import { PricingStep }   from './steps/PricingStep';
import { HowMadeStep }   from './steps/HowMadeStep';
import { SettingsStep }  from './steps/SettingsStep';
import { PreviewRail }   from './PreviewRail';

const DRAFT_KEY = 'listing-editor:draft';

interface ListingEditorShellProps {
  productId?: string;   // when set, the editor loads & updates this product instead of creating
}

export function ListingEditorShell({ productId }: ListingEditorShellProps = {}) {
  const router = useRouter();
  const isEdit = Boolean(productId);
  const [draft, setDraftState] = useState<ListingDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState<StepId>('media');
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (isEdit) {
      // Edit mode: load product from API; ignore the new-listing localStorage draft.
      (async () => {
        try {
          const p = await api<any>(`/api/products/vendor/${productId}`);
          setDraftState({
            ...EMPTY_DRAFT,
            existingImages: p.images ?? [],
            imageAlts: p.imageAlts ?? [],
            videoUrl: p.videoUrl ?? '',
            jewelleryType: p.jewelleryType ?? '',
            categoryId: p.category?.id ?? '',
            title: p.name ?? '',
            description: p.description ?? '',
            brand: p.brand ?? '',
            highlights: p.highlights ?? [],
            seoTitle: p.seoTitle ?? '',
            seoDescription: p.seoDescription ?? '',
            warranty: p.warranty ?? '',
            existingCertificateUrl: p.certificateImageUrl ?? '',
            metalType: p.metalType ?? 'gold',
            materials: p.materials ?? [],
            attrValues: Object.fromEntries((p.attributeValues ?? []).map((av: any) => [av.attribute.id, av.value])),
            purity: p.purity ?? '',
            gender: p.gender ?? '',
            baseMetal: p.baseMetal ?? '',
            plating: p.plating ?? '',
            hallmarked: p.hallmarked ?? false,
            certifiedBy: p.certifiedBy ?? '',
            certificateNumber: p.certificateNumber ?? '',
            hsnCode: p.hsnCode ?? '',
            gstRatePercent: p.gstRatePercent != null ? String(p.gstRatePercent) : '',
            countryOfOrigin: p.countryOfOrigin ?? 'IN',
            careInstructions: p.careInstructions ?? '',
            antiTarnish: p.antiTarnish ?? false,
            nickelFree: p.nickelFree ?? false,
            hypoallergenic: p.hypoallergenic ?? false,
            leadFree: p.leadFree ?? false,
            grossWeightGrams: p.grossWeightGrams != null ? String(p.grossWeightGrams) : '',
            netWeightGrams:   p.netWeightGrams != null   ? String(p.netWeightGrams)   : '',
            makingChargeType: p.makingChargeType ?? '',
            makingChargeValue: p.makingChargeValue != null ? String(p.makingChargeValue) : '',
            wastagePercent: p.wastagePercent != null ? String(p.wastagePercent) : '',
            lengthMm: p.lengthMm != null ? String(p.lengthMm) : '',
            widthMm:  p.widthMm  != null ? String(p.widthMm)  : '',
            heightMm: p.heightMm != null ? String(p.heightMm) : '',
            processingMin: p.processingMin != null ? String(p.processingMin) : '',
            processingMax: p.processingMax != null ? String(p.processingMax) : '',
            tags: p.tags ?? [],
            personalization: p.personalization ?? EMPTY_DRAFT.personalization,
            variations: (p.variations ?? []).map((v: any) => ({
              tempId: v.id,
              name: v.name,
              options: v.options.map((o: any) => ({ tempId: o.id, value: o.value })),
            })),
            combos: (p.variationCombos ?? []).map((c: any) => ({
              optionTempIds: c.optionIds,
              price: c.price != null ? String(c.price) : '',
              stock: String(c.stock ?? 0),
              sku: c.sku ?? '',
            })),
            price: String(p.price ?? ''),
            stockQuantity: String(p.stockQuantity ?? 0),
            acceptsOffers: p.acceptsOffers ?? false,
            sku: p.sku ?? '',
            shippingMethodId: p.shippingMethodDefaultId ?? '',
            whoMade: p.whoMade ?? '',
            whatIsIt: p.productType ?? '',
            shopSection: p.shopSection?.id ?? '',
            returnPolicyId: p.returnPolicy?.id ?? '',
            featured: p.featured ?? false,
            isActive: p.isActive ?? true,
            renewalMode: p.renewalMode ?? 'AUTOMATIC',
            whenMade: p.whenMade ?? '',
          });
        } catch {
          toast.error('Could not load product');
          router.push('/vendor');
        } finally {
          setHydrated(true);
        }
      })();
      return;
    }

    // New-listing mode: hydrate from localStorage (everything except File objects).
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDraftState({ ...EMPTY_DRAFT, ...parsed, files: [] });
      }
    } catch {}
    setHydrated(true);
  }, [isEdit, productId, router]);

  // Debounced autosave — strip non-serializables. Skip in edit mode.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || isEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const { files: _files, ...persistable } = draft;
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(persistable));
        setSavingDraft(false);
      } catch {}
    }, 500);
    setSavingDraft(true);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draft, hydrated, isEdit]);

  const setDraft = (patch: Partial<ListingDraft> | ((prev: ListingDraft) => ListingDraft)) => {
    setDraftState((prev) => typeof patch === 'function' ? patch(prev) : { ...prev, ...patch });
  };

  const status   = useMemo(() => stepStatus(draft), [draft]);
  const ready    = canPublish(draft);

  function discard() {
    if (isEdit) {
      router.back();
      return;
    }
    if (!confirm('Discard this draft? Your unsaved photos will be lost.')) return;
    window.localStorage.removeItem(DRAFT_KEY);
    setDraftState(EMPTY_DRAFT);
    router.back();
  }

  async function publish() {
    if (!ready) {
      const incomplete = (Object.entries(status).find(([, s]) => !s.complete));
      toast.error(incomplete?.[1]?.reason || 'Fill in all required fields');
      if (incomplete) setStep(incomplete[0] as StepId);
      return;
    }
    setPublishing(true);
    try {
      const fd = new FormData();
      fd.append('name',          draft.title);
      fd.append('description',   draft.description);
      fd.append('categoryId',    draft.categoryId);
      fd.append('metalType',     draft.metalType);
      fd.append('price',         draft.price);
      fd.append('stockQuantity', draft.stockQuantity);

      // Phase-2 taxonomy
      fd.append('itemType',      draft.itemType);
      if (draft.whenMade)    fd.append('whenMade',    draft.whenMade);
      if (draft.whoMade)     fd.append('whoMade',     draft.whoMade);
      if (draft.whatIsIt)    fd.append('productType', draft.whatIsIt);
      fd.append('renewalMode',   draft.renewalMode);
      fd.append('acceptsOffers', String(draft.acceptsOffers));
      fd.append('featured',      String(draft.featured));
      if (isEdit) fd.append('isActive', String(draft.isActive));
      if (draft.sku.trim())          fd.append('sku',       draft.sku.trim());
      if (draft.tags.length > 0)     fd.append('tags',      JSON.stringify(draft.tags));
      // Materials: real multi-chip list, falling back to legacy metalType for back-compat.
      const materials = draft.materials.length > 0
        ? draft.materials
        : (draft.metalType ? [draft.metalType] : []);
      if (materials.length > 0)      fd.append('materials', JSON.stringify(materials));

      // Jewellery identity & compliance
      if (draft.jewelleryType) fd.append('jewelleryType', draft.jewelleryType);
      if (draft.purity)        fd.append('purity',        draft.purity);
      if (draft.gender)        fd.append('gender',        draft.gender);
      if (draft.baseMetal.trim())       fd.append('baseMetal', draft.baseMetal.trim());
      if (draft.plating)                fd.append('plating',   draft.plating);
      fd.append('hallmarked', String(draft.hallmarked));
      if (draft.certifiedBy)            fd.append('certifiedBy',       draft.certifiedBy);
      if (draft.certificateNumber.trim()) fd.append('certificateNumber', draft.certificateNumber.trim());
      if (draft.hsnCode.trim())         fd.append('hsnCode',         draft.hsnCode.trim());
      if (draft.gstRatePercent)         fd.append('gstRatePercent',  draft.gstRatePercent);
      if (draft.countryOfOrigin.trim()) fd.append('countryOfOrigin', draft.countryOfOrigin.trim());
      if (draft.careInstructions.trim()) fd.append('careInstructions', draft.careInstructions.trim());
      fd.append('antiTarnish',    String(draft.antiTarnish));
      fd.append('nickelFree',     String(draft.nickelFree));
      fd.append('hypoallergenic', String(draft.hypoallergenic));
      fd.append('leadFree',       String(draft.leadFree));

      // Weight & making charges
      if (draft.grossWeightGrams) fd.append('grossWeightGrams', draft.grossWeightGrams);
      if (draft.netWeightGrams)   fd.append('netWeightGrams',   draft.netWeightGrams);
      if (draft.makingChargeType) fd.append('makingChargeType', draft.makingChargeType);
      if (draft.makingChargeValue) fd.append('makingChargeValue', draft.makingChargeValue);
      if (draft.wastagePercent)   fd.append('wastagePercent',   draft.wastagePercent);
      if (draft.lengthMm)         fd.append('lengthMm',         draft.lengthMm);
      if (draft.widthMm)          fd.append('widthMm',          draft.widthMm);
      if (draft.heightMm)         fd.append('heightMm',         draft.heightMm);
      if (draft.processingMin)    fd.append('processingMin',    draft.processingMin);
      if (draft.processingMax)    fd.append('processingMax',    draft.processingMax);

      if (draft.videoUrl.trim()) fd.append('videoUrl', draft.videoUrl.trim());
      if (draft.personalization.enabled || draft.personalization.instructions) {
        fd.append('personalization', JSON.stringify(draft.personalization));
      }
      if (draft.shippingMethodId)    fd.append('shippingMethodDefaultId', draft.shippingMethodId);
      if (draft.shopSection)         fd.append('shopSectionId',  draft.shopSection);
      if (draft.returnPolicyId)      fd.append('returnPolicyId', draft.returnPolicyId);

      // Polish fields — brand, SEO, highlights, warranty, image alts, certificate.
      if (draft.brand.trim())          fd.append('brand', draft.brand.trim());
      if (draft.seoTitle.trim())       fd.append('seoTitle', draft.seoTitle.trim());
      if (draft.seoDescription.trim()) fd.append('seoDescription', draft.seoDescription.trim());
      if (draft.warranty.trim())       fd.append('warranty', draft.warranty.trim());
      const cleanHighlights = draft.highlights.map((h) => h.trim()).filter(Boolean);
      if (cleanHighlights.length > 0)  fd.append('highlights', JSON.stringify(cleanHighlights));
      // Alt text: keep parallel to (kept existing) + (newly uploaded) order — for edit mode keepImages defines that order.
      const altImageCount = isEdit ? draft.existingImages.length + draft.files.length : draft.files.length;
      if (altImageCount > 0 && draft.imageAlts.length > 0) {
        fd.append('imageAlts', JSON.stringify(draft.imageAlts.slice(0, altImageCount)));
      }
      if (draft.certificateFile)       fd.append('certificate', draft.certificateFile);

      // Variations
      const incomplete = draft.variations.find(
        (v) => !v.name.trim() || !v.options.some((o) => o.value.trim()),
      );
      if (incomplete) {
        toast.error('Each variation needs a name and at least one option');
        setStep('options');
        setPublishing(false);
        return;
      }
      const cleanVariations = draft.variations
        .filter((v) => v.name.trim() && v.options.some((o) => o.value.trim()))
        .map((v) => ({
          name: v.name.trim(),
          options: v.options
            .filter((o) => o.value.trim())
            .map((o) => ({ tempId: o.tempId, value: o.value.trim() })),
        }));
      const validTempIds = new Set(cleanVariations.flatMap((v) => v.options.map((o) => o.tempId)));
      const cleanCombos = draft.combos
        .filter((c) => c.optionTempIds.every((tid) => validTempIds.has(tid)))
        .map((c) => ({
          optionTempIds: c.optionTempIds,
          price: c.price.trim() ? Number(c.price) : undefined,
          stock: c.stock.trim() ? Number(c.stock) : 0,
          sku:   c.sku.trim() || undefined,
        }));
      // Always send variations + combos in edit mode so the server can wipe
      // them when the vendor has removed everything. In create mode, only send
      // when there's at least one variation (no need to send empty arrays).
      if (cleanVariations.length > 0 || isEdit) {
        fd.append('variations', JSON.stringify(cleanVariations));
        fd.append('combos',     JSON.stringify(cleanCombos));
      }

      const attrPayload = Object.entries(draft.attrValues)
        .filter(([, v]) => v !== '')
        .map(([attributeId, value]) => ({ attributeId, value }));
      if (attrPayload.length > 0) fd.append('attributeValues', JSON.stringify(attrPayload));
      draft.files.forEach((f) => fd.append('images', f));
      if (isEdit) {
        // Tell the server which previously-uploaded image URLs to keep (in order).
        fd.append('keepImages', JSON.stringify(draft.existingImages));
        console.log('[publish] sending variations:', JSON.stringify(cleanVariations));
        console.log('[publish] sending combos:', JSON.stringify(cleanCombos));
        const result = await api<any>(`/api/products/${productId}`, { method: 'PUT', body: fd });
        console.log('[publish] server returned variations:', result?.variations?.length, 'combos:', result?.variationCombos?.length);
        toast.success(`Saved — ${result?.variations?.length ?? 0} variation(s), ${result?.variationCombos?.length ?? 0} combo(s)`);
        router.push('/vendor');
      } else {
        await api('/api/products', { method: 'POST', body: fd });
        window.localStorage.removeItem(DRAFT_KEY);
        toast.success('Listing published');
        router.push('/vendor');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  const currentIdx = STEPS.findIndex((s) => s.id === step);
  const next = STEPS[currentIdx + 1];
  const prev = STEPS[currentIdx - 1];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink-900">{isEdit ? 'Edit listing' : 'Add a listing'}</h1>
          <p className="text-sm text-ink-500 mt-1">
            {isEdit ? 'Update your product details below — changes go live on save.' : 'Walk through each step — your work autosaves as you go.'}
          </p>
        </div>
        {!isEdit && (
          <span className="text-xs text-ink-500 inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${savingDraft ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
            {savingDraft ? 'Saving draft…' : 'Draft saved'}
          </span>
        )}
      </div>

      {/* Tab nav */}
      <div className="sticky top-14 z-20 -mx-4 md:-mx-8 px-4 md:px-8 bg-canvas/85 backdrop-blur border-b border-line mb-6">
        <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto no-scrollbar py-2">
          {STEPS.map((s, i) => {
            const active = step === s.id;
            const done   = status[s.id].complete;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={[
                  'group flex items-center gap-2 px-3.5 h-10 rounded-pill text-sm whitespace-nowrap transition border',
                  active
                    ? 'bg-brand-50 border-brand-200 text-brand-700 font-semibold'
                    : 'bg-surface border-line text-ink-700 hover:border-ink-300 hover:text-ink-900',
                ].join(' ')}
              >
                <span className={[
                  'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                  done   ? 'bg-emerald-500 text-white'
                  : active ? 'bg-brand-600 text-white'
                  : 'bg-canvas border border-line text-ink-500',
                ].join(' ')}>
                  {done ? '✓' : i + 1}
                </span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-surface border border-line rounded-md shadow-card">
            {step === 'media'    && <MediaStep    draft={draft} setDraft={setDraft} />}
            {step === 'category' && <CategoryStep draft={draft} setDraft={setDraft} />}
            {step === 'details'  && <DetailsStep  draft={draft} setDraft={setDraft} />}
            {step === 'options'  && <OptionsStep  draft={draft} setDraft={setDraft} />}
            {step === 'pricing'  && <PricingStep  draft={draft} setDraft={setDraft} />}
            {step === 'made'     && <HowMadeStep  draft={draft} setDraft={setDraft} />}
            {step === 'settings' && <SettingsStep draft={draft} setDraft={setDraft} />}
          </div>

          {/* Per-step prev/next */}
          <div className="flex items-center justify-between mt-4">
            {prev ? (
              <button type="button" onClick={() => setStep(prev.id)}
                className="text-sm font-semibold text-ink-700 hover:text-ink-900 inline-flex items-center gap-1">
                <span>←</span> {prev.label}
              </button>
            ) : <span />}
            {next ? (
              <button type="button" onClick={() => setStep(next.id)}
                className="text-sm font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">
                {next.label} <span>→</span>
              </button>
            ) : <span />}
          </div>
        </div>

        {/* Preview rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-32 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Preview</p>
            <PreviewRail draft={draft} />
            <p className="text-[11px] text-ink-500 leading-relaxed">
              This is how your listing will appear in shop grids. Click <span className="font-semibold">Publish</span> when ready.
            </p>
          </div>
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-ink-900 text-white shadow-2xl border-t border-ink-900/50">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={discard} className="text-sm text-white/70 hover:text-white">
                Cancel
              </button>
              <span className="hidden sm:inline text-xs text-white/50">
                {ready ? (isEdit ? 'Ready to save' : 'Ready to publish') : 'Required steps incomplete'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isEdit && (
                <button type="button"
                  onClick={() => toast.success('Draft is saved automatically')}
                  className="text-sm px-4 h-9 rounded-pill border border-white/20 hover:bg-white/10 transition">
                  Save as draft
                </button>
              )}
              <button type="button"
                disabled={!ready || publishing}
                onClick={publish}
                className="text-sm font-semibold px-5 h-9 rounded-pill bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
                {publishing ? (isEdit ? 'Saving…' : 'Publishing…') : (isEdit ? 'Save changes' : 'Publish')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
