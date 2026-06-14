import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { assertEncryptionKeyConfigured } from './lib/crypto';
import { buildCorsOptions } from './lib/cors';
import { logger } from './lib/logger';

assertEncryptionKeyConfigured();

// Prevent PgBouncer "connection closed" noise from crashing the process.
// Prisma auto-reconnects on the next query — these are safe to swallow.
process.on('unhandledRejection', (reason: any) => {
  const msg = String(reason?.message ?? reason ?? '');
  if (msg.includes('kind: Closed') || msg.includes('Connection closed') || msg.includes('Connection pool')) {
    return; // transient DB connection drop — ignore
  }
  console.error('Unhandled rejection:', reason);
});

import authRouter from './routes/auth';
import vendorRouter from './routes/vendors';
import productRouter from './routes/products';
import orderRouter from './routes/orders';
import adminRouter from './routes/admin';
import categoryRouter from './routes/categories';
import reviewRouter from './routes/reviews';
import settingsRouter from './routes/settings';
import rbacRouter from './routes/rbac';
import shippingRouter from './routes/shipping';
import paymentsRouter from './routes/payments';
import vendorPagesRouter, { publicRouter as storefrontPagesRouter } from './routes/vendorPages';
import assetsRouter from './routes/assets';
import couponRouter from './routes/coupons';
import cartRouter from './routes/cart';
import wishlistRouter from './routes/wishlist';
import addressRouter from './routes/addresses';
import questionsRouter from './routes/questions';
import collectionsRouter from './routes/collections';
import fulfillmentRouter from './routes/fulfillment';
import returnsRouter from './routes/returns';
import { startAbandonedCartJob } from './jobs/abandonedCart';
import { startAutoDeliverJob } from './jobs/autoDeliver';
import { startSettlementJob } from './jobs/settlement';

const app = express();

// Trust the first reverse proxy (PM2/nginx) so req.ip / X-Forwarded-For reflect
// the real client — required for rate limiting to key on the actual caller.
app.set('trust proxy', 1);

// Security headers. CSP is disabled here (this API only returns JSON; CSP belongs
// on the Next.js apps) and CORP is set to cross-origin since the API is consumed
// from other origins.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

const corsOptions = buildCorsOptions();
app.use(cors(corsOptions));
// Preflight must use the same options so browsers get matching headers
app.options('*', cors(corsOptions));
// Capture the raw body so webhook handlers can verify HMAC signatures over the
// exact bytes Razorpay signed.
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { (req as any).rawBody = buf; },
}));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/vendors', vendorRouter);
// Vendor media library — must mount after vendorRouter so it inherits /api/vendors namespace.
app.use('/api/vendors', assetsRouter);
app.use('/api/products', productRouter);
app.use('/api/orders', orderRouter);
app.use('/api/admin', adminRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin/rbac', rbacRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/vendor-pages', vendorPagesRouter);
app.use('/api/storefront-pages', storefrontPagesRouter);
app.use('/api/coupons', couponRouter);
app.use('/api/cart', cartRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/addresses', addressRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/fulfillment', fulfillmentRouter);
app.use('/api/returns', returnsRouter);

// Generic error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ method: req.method, path: req.originalUrl, err: err?.message, stack: err?.stack }, 'request failed');
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
  res.status(500).json({ error: 'Internal server error' });
});

const port = parseInt(process.env.PORT || '4000', 10);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  startAbandonedCartJob();
  startAutoDeliverJob();
  startSettlementJob();
});
