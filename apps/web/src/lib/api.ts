import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem('token', token);
  else window.localStorage.removeItem('token');
}

export async function api<T = any>(
  path: string,
  options: RequestInit & { auth?: boolean; silent?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...options, headers });
  } catch (e: any) {
    const msg = 'Network error — please check your connection';
    if (!options.silent) toast.error(msg);
    throw new Error(msg);
  }

  if (!res.ok) {
    const text = await res.text();
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch {}
    const errObj = parsed?.error;
    function firstZodError(o: any): string | null {
      if (!o || typeof o !== 'object') return null;
      if (Array.isArray(o.formErrors) && o.formErrors[0]) return o.formErrors[0];
      const fieldErrs = o.fieldErrors;
      if (fieldErrs && typeof fieldErrs === 'object') {
        for (const v of Object.values(fieldErrs) as any[]) {
          if (Array.isArray(v) && v[0]) return String(v[0]);
        }
      }
      for (const v of Object.values(o)) {
        const nested = firstZodError(v);
        if (nested) return nested;
      }
      return null;
    }
    const errMsg =
      (typeof errObj === 'string' ? errObj : null) ??
      firstZodError(errObj) ??
      (parsed?.message && typeof parsed.message === 'string' ? parsed.message : null) ??
      `Request failed: ${res.status}`;
    if (!options.silent) toast.error(errMsg);
    throw new Error(errMsg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
