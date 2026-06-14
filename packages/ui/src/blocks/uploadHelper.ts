import { api } from '@/lib/api';
import type { EditorContext } from './types';

/**
 * Upload a file (image or video) from a vendor-page block editor and return its
 * Cloudinary URL. The upload endpoint picks the resource type from the file's
 * mime type, so this works for both images and video.
 */
export async function uploadBlockFile(ctx: EditorContext, file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const { url } = await api<{ url: string }>(`/api/vendor-pages/me/${ctx.pageId}/upload`, {
    method: 'POST', body: fd,
  });
  return url;
}

/** @deprecated use uploadBlockFile — kept for backward compatibility. */
export const uploadBlockImage = uploadBlockFile;
