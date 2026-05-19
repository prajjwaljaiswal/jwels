import { randomBytes } from 'crypto';

const key = randomBytes(32).toString('base64');
console.log('# Add to apps/api/.env');
console.log(`SHIPPING_ENCRYPTION_KEY=${key}`);
