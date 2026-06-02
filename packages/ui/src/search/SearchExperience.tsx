'use client';
import { useMemo } from 'react';
import { algoliasearch } from 'algoliasearch';
import {
  SearchBox,
  Hits,
  RefinementList,
  RangeInput,
  ClearRefinements,
  CurrentRefinements,
  Configure,
  Stats,
  Pagination,
  ToggleRefinement,
  useStats,
  useHits,
} from 'react-instantsearch';
import { InstantSearchNext } from 'react-instantsearch-nextjs';
import Link from 'next/link';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || '';
const INDEX = process.env.NEXT_PUBLIC_ALGOLIA_INDEX || 'jewel_products';

interface SearchExperienceProps {
  /** When set, restrict results to this vendor (used inside a vendor storefront). */
  vendorId?: string;
  /** When true, hide the Shop facet (it's redundant inside a vendor storefront). */
  hideVendorFacet?: boolean;
  /** Pre-filter results to a category slug (used by storefront category nav). */
  categorySlug?: string;
}

export function SearchExperience({ vendorId, hideVendorFacet, categorySlug }: SearchExperienceProps = {}) {
  const client = useMemo(() => algoliasearch(APP_ID, SEARCH_KEY), []);

  const filterParts: string[] = [];
  if (vendorId) filterParts.push(`vendorId:"${vendorId}"`);
  if (categorySlug) filterParts.push(`categorySlug:"${categorySlug}"`);
  const filters = filterParts.length ? filterParts.join(' AND ') : undefined;

  return (
    <InstantSearchNext
      indexName={INDEX}
      searchClient={client}
      future={{ preserveSharedStateOnUnmount: true }}
      routing
      initialUiState={{}}
    >
      <Configure hitsPerPage={24} filters={filters} />
      <div className="max-w-container mx-auto px-6 py-6">
        <div className="mb-6">
          <SearchBox
            placeholder="Search jewelry — try 'jhumka' or 'gold pendant'…"
            classNames={{
              root: 'w-full',
              form: 'relative',
              input: 'input-field !h-12 pl-12 pr-10',
              submit: 'absolute left-3 top-1/2 -translate-y-1/2 text-ink-500',
              reset: 'absolute right-3 top-1/2 -translate-y-1/2 text-ink-500',
              loadingIndicator: 'hidden',
            }}
          />
        </div>

        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <CurrentRefinements
            classNames={{
              root: 'flex flex-wrap items-center gap-2',
              list: 'flex flex-wrap gap-2',
              item: 'inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-brand-50 border border-brand-500/40 text-xs text-brand-700',
              label: 'font-semibold',
              category: 'inline-flex items-center gap-1',
              categoryLabel: '',
              delete: 'ml-1 text-brand-700 hover:text-brand-900',
            }}
          />
          <div className="flex items-center gap-3 ml-auto">
            <Stats
              classNames={{ root: 'text-xs text-ink-500' }}
              translations={{
                rootElementText: (params: { nbHits: number; processingTimeMS: number }) =>
                  `${params.nbHits.toLocaleString('en-IN')} result${params.nbHits === 1 ? '' : 's'}`,
              }}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <aside className="space-y-5 hidden lg:block">
            <FilterBlock title="Category">
              <RefinementList
                attribute="categoryName"
                searchable
                limit={8}
                showMore
                classNames={refinementClassNames}
              />
            </FilterBlock>

            <FilterBlock title="Price">
              <RangeInput
                attribute="price"
                classNames={{
                  root: 'space-y-2',
                  form: 'flex items-center gap-2',
                  input: 'input-field !py-1.5 !h-9 text-sm w-full',
                  separator: 'text-ink-500 text-sm',
                  submit: 'btn-secondary !py-1.5 !px-3 text-xs',
                }}
                translations={{
                  separatorElementText: 'to',
                  submitButtonText: 'Go',
                }}
              />
            </FilterBlock>

            <FilterBlock title="Metal">
              <RefinementList attribute="metalType" classNames={refinementClassNames} />
            </FilterBlock>

            <FilterBlock title="Materials">
              <RefinementList attribute="materials" limit={6} showMore classNames={refinementClassNames} />
            </FilterBlock>

            {!hideVendorFacet && (
              <FilterBlock title="Shop">
                <RefinementList attribute="vendorName" searchable limit={6} showMore classNames={refinementClassNames} />
              </FilterBlock>
            )}

            <FilterBlock title="Rating">
              <RefinementList
                attribute="averageRating"
                transformItems={(items) =>
                  items
                    .filter((i) => Number(i.value) >= 3)
                    .sort((a, b) => Number(b.value) - Number(a.value))
                    .map((i) => ({ ...i, label: `${i.value}★ & up` }))
                }
                classNames={refinementClassNames}
              />
            </FilterBlock>

            <FilterBlock title="Availability">
              <ToggleRefinement attribute="inStock" label="In stock only" />
            </FilterBlock>

            <ClearRefinements
              classNames={{
                button: 'btn-secondary w-full !py-2 text-sm',
                disabledButton: 'btn-secondary w-full !py-2 text-sm opacity-50 cursor-not-allowed',
              }}
              translations={{ resetButtonText: 'Clear all filters' }}
            />
          </aside>

          <main>
            <Hits
              hitComponent={HitCard}
              classNames={{
                root: '',
                list: 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5',
                item: 'list-none',
                emptyRoot: '',
              }}
            />
            <EmptyResultsFallback />

            <div className="mt-8 flex justify-center">
              <Pagination
                classNames={{
                  list: 'inline-flex items-center gap-1',
                  item: 'list-none',
                  link: 'inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-md border border-line text-sm text-ink-700 hover:border-ink-900',
                  selectedItem: '',
                  disabledItem: 'opacity-40',
                }}
              />
            </div>
          </main>
        </div>
      </div>
    </InstantSearchNext>
  );
}

const refinementClassNames = {
  root: '',
  list: 'space-y-1.5',
  item: '',
  label: 'flex items-center gap-2 text-sm text-ink-700 cursor-pointer hover:text-ink-900',
  labelText: 'flex-1',
  checkbox: 'rounded border-line accent-brand-600',
  count: 'text-xs text-ink-500',
  searchBox: 'mb-2',
  selectedItem: 'font-semibold text-ink-900',
  showMore: 'text-xs text-brand-700 hover:underline mt-1',
  noResults: 'text-xs text-ink-500',
};

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide font-semibold text-ink-900 mb-2">{title}</h3>
      {children}
    </div>
  );
}

interface AlgoliaHit {
  objectID: string;
  name: string;
  vendorName: string;
  vendorId: string;
  price: number;
  image: string | null;
  averageRating: number;
  reviewCount: number;
  inStock: boolean;
  featured: boolean;
}

function HitCard({ hit }: { hit: AlgoliaHit }) {
  const cardData: ProductCardData = {
    id: hit.objectID,
    name: hit.name,
    price: hit.price,
    images: hit.image ? [hit.image] : [],
    vendor: { shopName: hit.vendorName },
    rating: hit.averageRating,
    reviewCount: hit.reviewCount,
    badge: !hit.inStock ? 'Out of stock' : null,
  };
  return <ProductCard product={cardData} />;
}

function EmptyResultsFallback() {
  const { items } = useHits();
  const { nbHits, query } = useStats();
  if (nbHits > 0) return null;
  return (
    <div className="text-center py-16 border border-line rounded-md bg-surface">
      <p className="font-display text-xl text-ink-900 mb-1">
        {query ? `No results for "${query}"` : 'No products match these filters'}
      </p>
      <p className="text-sm text-ink-700 mb-5">
        Try removing some filters or browse popular categories.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {['Earrings', 'Necklaces', 'Rings', 'Bracelets', 'Anklets'].map((cat) => (
          <Link key={cat} href={`/products?categoryName=${encodeURIComponent(cat)}`}
            className="px-4 py-2 rounded-pill border border-line text-sm text-ink-900 hover:border-ink-700 hover:bg-canvas">
            {cat}
          </Link>
        ))}
      </div>
      {items.length === 0 && (
        <p className="text-xs text-ink-500 mt-6">Tip: try a shorter or alternate term (e.g. 'jhumka' instead of 'small gold earring').</p>
      )}
    </div>
  );
}
