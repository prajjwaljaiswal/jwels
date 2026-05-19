import 'dotenv/config';
import { algoliaEnabled, configureIndex, reindexAll, PRODUCTS_INDEX } from '../src/lib/algolia';

async function main() {
  if (!algoliaEnabled()) {
    console.error('Algolia not configured. Set ALGOLIA_APP_ID and ALGOLIA_ADMIN_KEY in apps/api/.env');
    process.exit(1);
  }
  console.log(`→ Configuring index "${PRODUCTS_INDEX}"…`);
  await configureIndex();
  console.log(`→ Pushing all active products…`);
  const { pushed } = await reindexAll();
  console.log(`✓ Done. ${pushed} record(s) pushed to "${PRODUCTS_INDEX}".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
