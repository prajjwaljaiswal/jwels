'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

interface CategoryAttributeOption { id: string; value: string; sortOrder: number; }
interface CategoryAttribute {
  id: string; name: string;
  inputType: 'SELECT' | 'TEXT' | 'NUMBER';
  isRequired: boolean; sortOrder: number;
  options: CategoryAttributeOption[];
}
interface Category {
  id: string; name: string; slug: string;
  description: string | null; isActive: boolean; sortOrder: number;
  parentId: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  featured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImageUrl: string | null;
  promoImageUrl: string | null;
  promoLinkUrl: string | null;
  promoLabel: string | null;
  _count: { products: number };
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  parentId: string;
  imageUrl: string;
  iconUrl: string;
  featured: boolean;
  metaTitle: string;
  metaDescription: string;
  metaImageUrl: string;
  promoImageUrl: string;
  promoLinkUrl: string;
  promoLabel: string;
}
const EMPTY_FORM: FormState = {
  name: '', slug: '', description: '', sortOrder: '0', parentId: '',
  imageUrl: '', iconUrl: '', featured: false,
  metaTitle: '', metaDescription: '', metaImageUrl: '',
  promoImageUrl: '', promoLinkUrl: '', promoLabel: '',
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedAttrsId, setExpandedAttrsId] = useState<string | null>(null);
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null);
  const [expandedTreeIds, setExpandedTreeIds] = useState<Set<string>>(new Set());
  const [attributes, setAttributes] = useState<Record<string, CategoryAttribute[]>>({});
  const [err, setErr] = useState('');

  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);
  const [addErr, setAddErr] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const [attrForm, setAttrForm] = useState({ name: '', inputType: 'SELECT', isRequired: false, sortOrder: '0' });
  const [attrErr, setAttrErr] = useState('');
  const [optionInputs, setOptionInputs] = useState<Record<string, string>>({});

  const roots = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const childrenByParent = useMemo(() => {
    const m = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.parentId) {
        const arr = m.get(c.parentId) ?? [];
        arr.push(c);
        m.set(c.parentId, arr);
      }
    }
    return m;
  }, [categories]);

  async function loadCategories() {
    try { setCategories(await api<Category[]>('/api/categories/all')); }
    catch (e: any) { setErr(e.message); }
  }
  async function loadAttributes(categoryId: string) {
    const data = await api<CategoryAttribute[]>(`/api/categories/${categoryId}/attributes`);
    setAttributes((prev) => ({ ...prev, [categoryId]: data }));
  }
  useEffect(() => { loadCategories(); }, []);

  function toggleTree(id: string) {
    setExpandedTreeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleExpandAttrs(id: string) {
    if (expandedAttrsId === id) { setExpandedAttrsId(null); return; }
    setExpandedAttrsId(id); setAttrErr('');
    if (!attributes[id]) await loadAttributes(id);
  }

  function payloadFromForm(f: FormState) {
    return {
      name: f.name,
      slug: f.slug,
      description: f.description || undefined,
      sortOrder: parseInt(f.sortOrder) || 0,
      parentId: f.parentId || null,
      imageUrl: f.imageUrl || null,
      iconUrl:  f.iconUrl  || null,
      featured: f.featured,
      metaTitle: f.metaTitle || null,
      metaDescription: f.metaDescription || null,
      metaImageUrl: f.metaImageUrl || null,
      promoImageUrl: f.promoImageUrl || null,
      promoLinkUrl: f.promoLinkUrl || null,
      promoLabel: f.promoLabel || null,
    };
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault(); setAddErr('');
    try {
      await api('/api/categories', { method: 'POST', body: JSON.stringify(payloadFromForm(addForm)) });
      setAddForm(EMPTY_FORM);
      await loadCategories();
    } catch (e: any) { setAddErr(e.message); }
  }
  async function handleUpdateCategory(id: string) {
    try {
      await api(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(payloadFromForm(editForm)) });
      setEditId(null); await loadCategories();
    } catch (e: any) { setErr(e.message); }
  }
  async function handleToggleActive(cat: Category) {
    try { await api(`/api/categories/${cat.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !cat.isActive }) }); await loadCategories(); }
    catch (e: any) { setErr(e.message); }
  }
  async function handleToggleFeatured(cat: Category) {
    try { await api(`/api/categories/${cat.id}`, { method: 'PUT', body: JSON.stringify({ featured: !cat.featured }) }); await loadCategories(); }
    catch (e: any) { setErr(e.message); }
  }
  async function handleDeleteCategory(id: string) {
    try { await api(`/api/categories/${id}`, { method: 'DELETE' }); await loadCategories(); }
    catch (e: any) { setErr(e.message); }
  }
  async function handleAddAttribute(e: React.FormEvent, categoryId: string) {
    e.preventDefault(); setAttrErr('');
    try {
      await api(`/api/categories/${categoryId}/attributes`, {
        method: 'POST',
        body: JSON.stringify({
          name: attrForm.name, inputType: attrForm.inputType,
          isRequired: attrForm.isRequired,
          sortOrder: parseInt(attrForm.sortOrder) || 0,
        }),
      });
      setAttrForm({ name: '', inputType: 'SELECT', isRequired: false, sortOrder: '0' });
      await loadAttributes(categoryId);
    } catch (e: any) { setAttrErr(e.message); }
  }
  async function handleDeleteAttribute(categoryId: string, attrId: string) {
    try { await api(`/api/categories/attributes/${attrId}`, { method: 'DELETE' }); await loadAttributes(categoryId); }
    catch (e: any) { setErr(e.message); }
  }
  async function handleAddOption(categoryId: string, attrId: string) {
    const value = (optionInputs[attrId] || '').trim();
    if (!value) return;
    try {
      await api(`/api/categories/attributes/${attrId}/options`, { method: 'POST', body: JSON.stringify({ value }) });
      setOptionInputs((prev) => ({ ...prev, [attrId]: '' }));
      await loadAttributes(categoryId);
    } catch (e: any) { setErr(e.message); }
  }
  async function handleDeleteOption(categoryId: string, optId: string) {
    try { await api(`/api/categories/attributes/options/${optId}`, { method: 'DELETE' }); await loadAttributes(categoryId); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <div>
      <PageHeader title="Categories" subtitle="Two-level taxonomy. Top-level categories appear in the mega-menu; subcategories nest inside them." />

      {err && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-100 text-danger text-sm p-3 flex justify-between">
          <span>{err}</span>
          <button onClick={() => setErr('')} className="font-bold">×</button>
        </div>
      )}

      <Card className="p-5 mb-6">
        <h3 className="font-semibold text-ink-900 mb-3">Add a category</h3>
        <CategoryForm
          value={addForm}
          onChange={setAddForm}
          roots={roots}
          onSubmit={handleAddCategory}
          submitLabel="Add category"
        />
        {addErr && <p className="text-danger text-xs mt-2">{addErr}</p>}
      </Card>

      {roots.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No categories yet — add your first one above.</Card>
      ) : (
        <div className="space-y-3">
          {roots.map((root) => {
            const kids = childrenByParent.get(root.id) ?? [];
            const isOpen = expandedTreeIds.has(root.id);
            return (
              <Card key={root.id} className="overflow-hidden">
                <CategoryRow
                  cat={root}
                  depth={0}
                  editing={editId === root.id}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  startEdit={() => { setEditId(root.id); setEditForm(toForm(root)); }}
                  cancelEdit={() => setEditId(null)}
                  saveEdit={() => handleUpdateCategory(root.id)}
                  onToggleActive={() => handleToggleActive(root)}
                  onToggleFeatured={() => handleToggleFeatured(root)}
                  onDelete={() => handleDeleteCategory(root.id)}
                  onToggleAttrs={() => handleExpandAttrs(root.id)}
                  attrsOpen={expandedAttrsId === root.id}
                  hasChildren={kids.length > 0}
                  treeOpen={isOpen}
                  onToggleTree={() => toggleTree(root.id)}
                  roots={roots}
                  onToggleMenu={() => setExpandedMenuId(expandedMenuId === root.id ? null : root.id)}
                  menuOpen={expandedMenuId === root.id}
                />
                {expandedAttrsId === root.id && (
                  <AttributesPanel
                    category={root}
                    attributes={attributes[root.id] || []}
                    attrForm={attrForm}
                    setAttrForm={setAttrForm}
                    attrErr={attrErr}
                    optionInputs={optionInputs}
                    setOptionInputs={setOptionInputs}
                    onAddAttribute={(e) => handleAddAttribute(e, root.id)}
                    onDeleteAttribute={(id) => handleDeleteAttribute(root.id, id)}
                    onAddOption={(id) => handleAddOption(root.id, id)}
                    onDeleteOption={(id) => handleDeleteOption(root.id, id)}
                  />
                )}
                {expandedMenuId === root.id && <MenuPanel categorySlug={root.slug} categoryId={root.id} categoryName={root.name} />}
                {isOpen && kids.length > 0 && (
                  <div className="border-t border-line bg-canvas/40">
                    {kids.map((kid) => (
                      <div key={kid.id} className="border-b border-line last:border-b-0">
                        <CategoryRow
                          cat={kid}
                          depth={1}
                          editing={editId === kid.id}
                          editForm={editForm}
                          setEditForm={setEditForm}
                          startEdit={() => { setEditId(kid.id); setEditForm(toForm(kid)); }}
                          cancelEdit={() => setEditId(null)}
                          saveEdit={() => handleUpdateCategory(kid.id)}
                          onToggleActive={() => handleToggleActive(kid)}
                          onToggleFeatured={() => handleToggleFeatured(kid)}
                          onDelete={() => handleDeleteCategory(kid.id)}
                          onToggleAttrs={() => handleExpandAttrs(kid.id)}
                          attrsOpen={expandedAttrsId === kid.id}
                          hasChildren={false}
                          treeOpen={false}
                          onToggleTree={() => {}}
                          roots={roots}
                          onToggleMenu={() => {}}
                          menuOpen={false}
                        />
                        {expandedAttrsId === kid.id && (
                          <AttributesPanel
                            category={kid}
                            attributes={attributes[kid.id] || []}
                            attrForm={attrForm}
                            setAttrForm={setAttrForm}
                            attrErr={attrErr}
                            optionInputs={optionInputs}
                            setOptionInputs={setOptionInputs}
                            onAddAttribute={(e) => handleAddAttribute(e, kid.id)}
                            onDeleteAttribute={(id) => handleDeleteAttribute(kid.id, id)}
                            onAddOption={(id) => handleAddOption(kid.id, id)}
                            onDeleteOption={(id) => handleDeleteOption(kid.id, id)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function toForm(c: Category): FormState {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description ?? '',
    sortOrder: String(c.sortOrder),
    parentId: c.parentId ?? '',
    imageUrl: c.imageUrl ?? '',
    iconUrl: c.iconUrl ?? '',
    featured: c.featured,
    metaTitle: c.metaTitle ?? '',
    metaDescription: c.metaDescription ?? '',
    metaImageUrl: c.metaImageUrl ?? '',
    promoImageUrl: c.promoImageUrl ?? '',
    promoLinkUrl: c.promoLinkUrl ?? '',
    promoLabel: c.promoLabel ?? '',
  };
}

// ── Category row ─────────────────────────────────────────────────────────────
function CategoryRow(props: {
  cat: Category; depth: 0 | 1;
  editing: boolean;
  editForm: FormState;
  setEditForm: (f: FormState) => void;
  startEdit: () => void;
  cancelEdit: () => void;
  saveEdit: () => void;
  onToggleActive: () => void;
  onToggleFeatured: () => void;
  onDelete: () => void;
  onToggleAttrs: () => void;
  attrsOpen: boolean;
  hasChildren: boolean;
  treeOpen: boolean;
  onToggleTree: () => void;
  roots: Category[];
  onToggleMenu: () => void;
  menuOpen: boolean;
}) {
  const { cat, depth, editing } = props;
  if (editing) {
    return (
      <div className="px-5 py-4" style={{ paddingLeft: depth === 1 ? '3.5rem' : undefined }}>
        <CategoryForm
          value={props.editForm}
          onChange={props.setEditForm}
          roots={props.roots}
          onSubmit={(e) => { e.preventDefault(); props.saveEdit(); }}
          submitLabel="Save"
          onCancel={props.cancelEdit}
          selfId={cat.id}
        />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-5 py-4" style={{ paddingLeft: depth === 1 ? '3.5rem' : undefined }}>
      {depth === 0 ? (
        <button onClick={props.onToggleTree}
          className="h-7 w-7 rounded-md border border-line flex items-center justify-center text-ink-700 hover:bg-canvas"
          aria-label={props.treeOpen ? 'Collapse' : 'Expand'}
        >
          <span className={`transition-transform ${props.treeOpen ? 'rotate-90' : ''}`}>▶</span>
        </button>
      ) : <span className="text-ink-400">↳</span>}
      {cat.imageUrl ? (
        <img src={cat.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover border border-line" />
      ) : (
        <div className="h-10 w-10 rounded-md bg-canvas border border-line" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-ink-900">{cat.name}</span>
          <span className="text-xs text-ink-500">/{cat.slug}</span>
          <span className="text-xs text-ink-500">· #{cat.sortOrder}</span>
          <span className="text-xs text-ink-500">· {cat._count.products} product{cat._count.products === 1 ? '' : 's'}</span>
          {cat.featured && <StatusPill tone="info">Featured</StatusPill>}
        </div>
        {cat.description && <p className="text-xs text-ink-500 truncate mt-0.5">{cat.description}</p>}
      </div>
      <StatusPill tone={cat.isActive ? 'success' : 'neutral'}>{cat.isActive ? 'Active' : 'Inactive'}</StatusPill>
      <button onClick={props.startEdit} className="text-xs px-3 py-1.5 rounded-pill border border-line hover:border-ink-900">Edit</button>
      <button onClick={props.onToggleFeatured} className="text-xs px-3 py-1.5 rounded-pill border border-line hover:border-ink-900">
        {cat.featured ? 'Unfeature' : 'Feature'}
      </button>
      <button onClick={props.onToggleActive} className={`text-xs px-3 py-1.5 rounded-pill border ${cat.isActive ? 'bg-amber-50 text-warn border-amber-100' : 'bg-emerald-50 text-success border-emerald-100'}`}>
        {cat.isActive ? 'Deactivate' : 'Activate'}
      </button>
      <button onClick={props.onDelete} className="text-xs px-3 py-1.5 rounded-pill bg-red-50 text-danger border border-red-100">Delete</button>
      <button onClick={props.onToggleAttrs} className="text-xs px-3 py-1.5 rounded-pill border border-line hover:border-ink-900">
        {props.attrsOpen ? 'Hide attrs ▲' : 'Attrs ▼'}
      </button>
      {depth === 0 && (
        <button onClick={props.onToggleMenu} className="text-xs px-3 py-1.5 rounded-pill border border-line hover:border-ink-900">
          {props.menuOpen ? 'Hide menu ▲' : 'Menu ▼'}
        </button>
      )}
    </div>
  );
}

// ── Form ─────────────────────────────────────────────────────────────────────
function CategoryForm(props: {
  value: FormState;
  onChange: (v: FormState) => void;
  roots: Category[];
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onCancel?: () => void;
  selfId?: string; // when editing, exclude self from parent options
}) {
  const { value, onChange, roots, selfId } = props;
  const imgRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<'image' | 'icon' | 'meta' | null>(null);

  async function upload(file: File, field: 'imageUrl' | 'iconUrl' | 'metaImageUrl') {
    setUploading(field === 'imageUrl' ? 'image' : field === 'iconUrl' ? 'icon' : 'meta');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api<{ url: string }>('/api/categories/upload-image', { method: 'POST', body: fd });
      onChange({ ...value, [field]: res.url });
    } finally { setUploading(null); }
  }

  // Eligible parents: only roots, excluding self (and roots that aren't really roots — handled by validateParent on server)
  const parentOptions = roots.filter((r) => r.id !== selfId);

  return (
    <form onSubmit={props.onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className="input-field md:col-span-2" placeholder="Name" required
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value, slug: value.slug || toSlug(e.target.value) })} />
        <input className="input-field" placeholder="Slug" required
          value={value.slug} onChange={(e) => onChange({ ...value, slug: e.target.value })} />
        <input className="input-field" type="number" min="0" placeholder="Order"
          value={value.sortOrder} onChange={(e) => onChange({ ...value, sortOrder: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select className="input-field md:col-span-2"
          value={value.parentId}
          onChange={(e) => onChange({ ...value, parentId: e.target.value })}>
          <option value="">— Top-level category —</option>
          {parentOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input className="input-field md:col-span-2" placeholder="Description (optional)"
          value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ImageUploader label="Hero image" url={value.imageUrl} uploading={uploading === 'image'}
          onPick={() => imgRef.current?.click()} onClear={() => onChange({ ...value, imageUrl: '' })} />
        <input ref={imgRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'imageUrl')} />
        <ImageUploader label="Menu icon" url={value.iconUrl} uploading={uploading === 'icon'}
          onPick={() => iconRef.current?.click()} onClear={() => onChange({ ...value, iconUrl: '' })} square />
        <input ref={iconRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'iconUrl')} />
      </div>

      <details className="rounded-md border border-line p-3">
        <summary className="text-sm font-semibold text-ink-900 cursor-pointer">Mega-menu promo (right rail)</summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <input className="input-field" placeholder="Promo image URL"
            value={value.promoImageUrl} onChange={(e) => onChange({ ...value, promoImageUrl: e.target.value })} />
          <input className="input-field" placeholder="Promo link URL"
            value={value.promoLinkUrl} onChange={(e) => onChange({ ...value, promoLinkUrl: e.target.value })} />
          <input className="input-field md:col-span-2" placeholder="Promo label (e.g. 'Bridal collection')"
            value={value.promoLabel} onChange={(e) => onChange({ ...value, promoLabel: e.target.value })} />
        </div>
      </details>

      <details className="rounded-md border border-line p-3">
        <summary className="text-sm font-semibold text-ink-900 cursor-pointer">SEO meta</summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <input className="input-field" placeholder="Meta title (≤ 60 chars)"
            maxLength={160}
            value={value.metaTitle} onChange={(e) => onChange({ ...value, metaTitle: e.target.value })} />
          <input className="input-field" placeholder="Meta image URL"
            value={value.metaImageUrl} onChange={(e) => onChange({ ...value, metaImageUrl: e.target.value })} />
          <textarea className="input-field md:col-span-2 min-h-[60px]" placeholder="Meta description (≤ 155 chars)"
            maxLength={320}
            value={value.metaDescription} onChange={(e) => onChange({ ...value, metaDescription: e.target.value })} />
        </div>
      </details>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.featured}
            onChange={(e) => onChange({ ...value, featured: e.target.checked })} />
          Featured (appears in homepage rails)
        </label>
        <div className="ml-auto flex gap-2">
          {props.onCancel && (
            <button type="button" onClick={props.onCancel} className="btn-secondary !px-4 !py-2 text-sm">Cancel</button>
          )}
          <button type="submit" className="btn-primary !px-4 !py-2 text-sm">{props.submitLabel}</button>
        </div>
      </div>
    </form>
  );
}

function ImageUploader({ label, url, onPick, onClear, uploading, square }: {
  label: string; url: string; onPick: () => void; onClear: () => void; uploading: boolean; square?: boolean;
}) {
  return (
    <div className="rounded-md border border-line p-3 flex items-center gap-3">
      {url ? (
        <img src={url} alt="" className={`${square ? 'h-12 w-12' : 'h-14 w-20'} object-cover rounded-md border border-line`} />
      ) : (
        <div className={`${square ? 'h-12 w-12' : 'h-14 w-20'} rounded-md bg-canvas border border-line`} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-900">{label}</p>
        <p className="text-xs text-ink-500 truncate">{uploading ? 'Uploading…' : (url || 'No image')}</p>
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={onPick} disabled={uploading}
          className="text-xs px-3 py-1.5 rounded-pill border border-line hover:border-ink-900 disabled:opacity-50">
          {url ? 'Replace' : 'Upload'}
        </button>
        {url && (
          <button type="button" onClick={onClear}
            className="text-xs px-3 py-1.5 rounded-pill bg-red-50 text-danger border border-red-100">Clear</button>
        )}
      </div>
    </div>
  );
}

// ── Attributes panel (unchanged behaviour, extracted for reuse) ──────────────
function AttributesPanel(props: {
  category: Category;
  attributes: CategoryAttribute[];
  attrForm: { name: string; inputType: string; isRequired: boolean; sortOrder: string };
  setAttrForm: (v: any) => void;
  attrErr: string;
  optionInputs: Record<string, string>;
  setOptionInputs: (v: any) => void;
  onAddAttribute: (e: React.FormEvent) => void;
  onDeleteAttribute: (id: string) => void;
  onAddOption: (id: string) => void;
  onDeleteOption: (id: string) => void;
}) {
  const { category: cat, attributes, attrForm, setAttrForm, attrErr } = props;
  return (
    <div className="border-t border-line bg-canvas px-5 py-5">
      <h4 className="text-sm font-semibold text-ink-900 mb-3">Attributes for {cat.name}</h4>

      <form onSubmit={props.onAddAttribute} className="flex flex-wrap gap-2 mb-4">
        <input className="input-field h-9 flex-1 min-w-40 text-sm" placeholder="Attribute name (e.g. Size)"
          value={attrForm.name} onChange={(e) => setAttrForm({ ...attrForm, name: e.target.value })} required />
        <select className="input-field h-9 text-sm w-44"
          value={attrForm.inputType} onChange={(e) => setAttrForm({ ...attrForm, inputType: e.target.value })}>
          <option value="SELECT">Select (dropdown)</option>
          <option value="TEXT">Text (free input)</option>
          <option value="NUMBER">Number</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={attrForm.isRequired}
            onChange={(e) => setAttrForm({ ...attrForm, isRequired: e.target.checked })} />
          Required
        </label>
        <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">+ Add attribute</button>
      </form>
      {attrErr && <p className="text-danger text-xs mb-3">{attrErr}</p>}

      {attributes.length === 0 ? (
        <p className="text-sm text-ink-500">No attributes yet.</p>
      ) : (
        <div className="space-y-3">
          {attributes.map((attr) => (
            <div key={attr.id} className="rounded-md bg-surface border border-line p-4">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="font-semibold text-ink-900 text-sm">{attr.name}</span>
                <StatusPill tone="neutral">{attr.inputType}</StatusPill>
                {attr.isRequired && <StatusPill tone="danger">Required</StatusPill>}
                <button onClick={() => props.onDeleteAttribute(attr.id)} className="ml-auto text-xs px-2.5 py-1 rounded-pill bg-red-50 text-danger border border-red-100">Delete</button>
              </div>
              {attr.inputType === 'SELECT' ? (
                <div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {attr.options.map((opt) => (
                      <span key={opt.id} className="chip">
                        {opt.value}
                        <button onClick={() => props.onDeleteOption(opt.id)} className="text-ink-500 hover:text-danger">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input className="input-field h-9 text-sm flex-1" placeholder="Add option value"
                      value={props.optionInputs[attr.id] || ''}
                      onChange={(e) => props.setOptionInputs((prev: any) => ({ ...prev, [attr.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), props.onAddOption(attr.id))} />
                    <button onClick={() => props.onAddOption(attr.id)} className="btn-secondary !px-3 !py-1.5 text-xs">Add</button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-500">Vendors enter this value freely when listing a product.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mega-menu panel ──────────────────────────────────────────────────────────
interface MenuSection { id: string; title: string; sortOrder: number; items: MenuItem[]; }
interface MenuItem    { id: string; label: string; href: string; iconUrl: string | null; sortOrder: number; }

function MenuPanel({ categoryId, categoryName, categorySlug }: { categoryId: string; categoryName: string; categorySlug: string }) {
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [err, setErr] = useState('');
  const [newSection, setNewSection] = useState('');

  async function load() {
    try {
      const data = await api<any>(`/api/categories/menu/${categorySlug}`, { auth: false });
      setSections(data.menuSections ?? []);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [categoryId]);

  async function addSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSection.trim()) return;
    try {
      await api(`/api/categories/${categoryId}/menu-sections`, {
        method: 'POST',
        body: JSON.stringify({ title: newSection.trim(), sortOrder: sections.length * 10 }),
      });
      setNewSection(''); await load();
    } catch (e: any) { setErr(e.message); }
  }
  async function renameSection(id: string, title: string) {
    try { await api(`/api/categories/menu-sections/${id}`, { method: 'PUT', body: JSON.stringify({ title }) }); await load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function deleteSection(id: string) {
    try { await api(`/api/categories/menu-sections/${id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function addItem(sectionId: string, label: string, href: string) {
    try {
      await api(`/api/categories/menu-sections/${sectionId}/items`, {
        method: 'POST',
        body: JSON.stringify({ label, href, sortOrder: 999 }),
      });
      await load();
    } catch (e: any) { setErr(e.message); }
  }
  async function updateItem(id: string, patch: Partial<MenuItem>) {
    try { await api(`/api/categories/menu-items/${id}`, { method: 'PUT', body: JSON.stringify(patch) }); await load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function deleteItem(id: string) {
    try { await api(`/api/categories/menu-items/${id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="border-t border-line bg-canvas px-5 py-5">
      <h4 className="text-sm font-semibold text-ink-900 mb-3">Mega-menu sections for {categoryName}</h4>
      {err && <p className="text-danger text-xs mb-2">{err}</p>}

      <form onSubmit={addSection} className="flex gap-2 mb-4">
        <input className="input-field h-9 flex-1 text-sm" placeholder="New section title (e.g. By Stone Shape)"
          value={newSection} onChange={(e) => setNewSection(e.target.value)} />
        <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">+ Add section</button>
      </form>

      {sections.length === 0 ? (
        <p className="text-sm text-ink-500">No sections yet.</p>
      ) : (
        <div className="space-y-4">
          {sections.map((s) => (
            <MenuSectionEditor
              key={s.id}
              section={s}
              onRename={(t) => renameSection(s.id, t)}
              onDelete={() => deleteSection(s.id)}
              onAddItem={(label, href) => addItem(s.id, label, href)}
              onUpdateItem={updateItem}
              onDeleteItem={deleteItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuSectionEditor(props: {
  section: MenuSection;
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddItem: (label: string, href: string) => void;
  onUpdateItem: (id: string, patch: Partial<MenuItem>) => void;
  onDeleteItem: (id: string) => void;
}) {
  const [title, setTitle] = useState(props.section.title);
  const [newLabel, setNewLabel] = useState('');
  const [newHref, setNewHref]   = useState('');
  return (
    <div className="rounded-md bg-surface border border-line p-4">
      <div className="flex items-center gap-2 mb-3">
        <input className="input-field h-9 flex-1 text-sm font-semibold"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== props.section.title) props.onRename(title); }} />
        <button onClick={props.onDelete} className="text-xs px-2.5 py-1 rounded-pill bg-red-50 text-danger border border-red-100">Delete section</button>
      </div>
      <div className="space-y-2 mb-3">
        {props.section.items.length === 0 && (
          <p className="text-xs text-ink-500">No items yet.</p>
        )}
        {props.section.items.map((it) => (
          <MenuItemRow key={it.id} item={it}
            onSave={(label, href) => props.onUpdateItem(it.id, { label, href })}
            onDelete={() => props.onDeleteItem(it.id)} />
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input-field h-9 text-sm flex-1" placeholder="Label (e.g. Diamond Earrings)"
          value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <input className="input-field h-9 text-sm flex-[2]" placeholder="Link (e.g. /c/earrings?stone=Diamond)"
          value={newHref} onChange={(e) => setNewHref(e.target.value)} />
        <button onClick={() => {
          if (!newLabel.trim() || !newHref.trim()) return;
          props.onAddItem(newLabel.trim(), newHref.trim());
          setNewLabel(''); setNewHref('');
        }} className="btn-secondary !px-3 !py-1.5 text-xs">Add</button>
      </div>
    </div>
  );
}

function MenuItemRow({ item, onSave, onDelete }: { item: MenuItem; onSave: (l: string, h: string) => void; onDelete: () => void; }) {
  const [label, setLabel] = useState(item.label);
  const [href, setHref]   = useState(item.href);
  const dirty = label !== item.label || href !== item.href;
  return (
    <div className="flex items-center gap-2">
      <input className="input-field h-9 text-sm flex-1" value={label} onChange={(e) => setLabel(e.target.value)} />
      <input className="input-field h-9 text-sm flex-[2]" value={href} onChange={(e) => setHref(e.target.value)} />
      <button onClick={() => onSave(label, href)} disabled={!dirty}
        className="text-xs px-2.5 py-1 rounded-pill border border-line hover:border-ink-900 disabled:opacity-40">Save</button>
      <button onClick={onDelete} className="text-xs px-2.5 py-1 rounded-pill bg-red-50 text-danger border border-red-100">×</button>
    </div>
  );
}
