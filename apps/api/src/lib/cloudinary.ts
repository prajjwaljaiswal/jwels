import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function uploadBuffer(
  buffer: Buffer,
  folder = 'products',
  resourceType: 'image' | 'video' = 'image'
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: resourceType }, (err, result) => {
        if (err || !result) return reject(err ?? new Error('Upload failed'));
        resolve(result.secure_url);
      })
      .end(buffer);
  });
}

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  resourceType: 'image' | 'video' | 'raw';
}

// Richer upload that returns Cloudinary metadata — used by the media library
// so we can store width/height/bytes/format and later delete via publicId.
export function uploadBufferFull(
  buffer: Buffer,
  folder = 'assets',
  resourceType: 'image' | 'video' = 'image'
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: resourceType }, (err, result) => {
        if (err || !result) return reject(err ?? new Error('Upload failed'));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
          resourceType: (result.resource_type as any) ?? resourceType,
        });
      })
      .end(buffer);
  });
}

export async function deleteByPublicId(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image') {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export { cloudinary };
