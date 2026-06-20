import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// Secret-guarded on-demand revalidation target. The API's notifyStorefrontRevalidate()
// (apps/api/src/lib/revalidate.ts) POSTs { tags: string[] } here when a vendor edits
// theme/settings or publishes a page. Reachable because middleware passes /api through.
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get('x-revalidate-secret') !== secret) {
    return new NextResponse('forbidden', { status: 403 });
  }
  let tags: string[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.tags)) tags = body.tags.filter((t: unknown) => typeof t === 'string');
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  for (const t of tags) revalidateTag(t);
  return NextResponse.json({ ok: true, revalidated: tags });
}
