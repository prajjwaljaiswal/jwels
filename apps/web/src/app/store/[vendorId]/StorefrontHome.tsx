"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useVendor } from "@/lib/vendor-context";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { Block } from "@/components/blocks/types";

interface PublishedPage {
  id: string;
  vendorId: string;
  blocks: Block[];
}


export default function StorefrontHome() {
  const { vendor } = useVendor();

  const [homepage, setHomepage] = useState<PublishedPage | null>(null);

  useEffect(() => {
    api<PublishedPage>(`/api/storefront-pages/${vendor.id}`, {
      auth: false,
      silent: true,
    })
      .then((page) => setHomepage(page))
      .catch(() => setHomepage(null));

  }, [vendor.id]);

  const hasCustomHomepage =
    homepage && Array.isArray(homepage.blocks) && homepage.blocks.length > 0;

  return (
    <>
      {hasCustomHomepage ? (
        <BlockRenderer
          blocks={homepage!.blocks}
          ctx={{ scope: "vendor", vendorId: vendor.id }}
        />
      ) : (
        <h2>Loading...</h2>
      )}
    </>
  );
}




