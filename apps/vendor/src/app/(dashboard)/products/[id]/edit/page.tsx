'use client';
import { ListingEditorShell } from '@/components/listing-editor/ListingEditorShell';

export default function EditProductPage({ params }: { params: { id: string } }) {
  return <ListingEditorShell productId={params.id} />;
}
