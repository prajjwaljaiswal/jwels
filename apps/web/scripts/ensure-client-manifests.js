// Workaround for a long-standing Next.js / Vercel route-group bug:
// `.next/server/app/(group)/page.js.nft.json` references a sibling
// `page_client-reference-manifest.js` that Next.js sometimes fails to
// emit. Vercel's output tracer follows the nft reference and crashes
// with ENOENT during deploy.
//
// This script walks `.next/server/app`, finds every `page.js.nft.json`
// that references a missing manifest, and creates an empty stub so the
// tracer can resolve it.
//
// Tracked upstream: vercel/next.js #58272, #54187.

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '.next', 'server', 'app');
const STUB = `// Auto-generated stub. See scripts/ensure-client-manifests.js.
self.__RSC_MANIFEST = self.__RSC_MANIFEST || {};
self.__RSC_MANIFEST[""] = {clientModules:{},entryCSSFiles:{},rscModuleMapping:{},edgeRscModuleMapping:{},ssrModuleMapping:{}};
`;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name === 'page.js.nft.json') {
      const nftRaw = fs.readFileSync(full, 'utf8');
      let nft;
      try { nft = JSON.parse(nftRaw); } catch { continue; }
      if (!nft || !Array.isArray(nft.files)) continue;
      if (!nft.files.some((f) => f.endsWith('page_client-reference-manifest.js'))) continue;
      const manifestPath = path.join(dir, 'page_client-reference-manifest.js');
      if (!fs.existsSync(manifestPath)) {
        fs.writeFileSync(manifestPath, STUB);
        const rel = path.relative(OUT_DIR, manifestPath).replace(/\\/g, '/');
        console.log(`[ensure-client-manifests] wrote stub: ${rel}`);
      }
    }
  }
}

walk(OUT_DIR);
