'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VendorOnboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/sell/onboard'); }, [router]);
  return null;
}
