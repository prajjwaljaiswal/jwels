import { api } from '@/lib/api';
import type { EditorContext } from './types';

/** Upload an image from a vendor-page block editor and return its Cloudinary URL. */
export async function uploadBlockImage(ctx: EditorContext, file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const { url } = await api<{ url: string }>(`/api/vendor-pages/me/${ctx.pageId}/upload`, {
    method: 'POST', body: fd,
  });
  return url;
}
