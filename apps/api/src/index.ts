import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { assertEncryptionKeyConfigured } from './lib/crypto';

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
import { startAbandonedCartJob } from './jobs/abandonedCart';
import { startAutoDeliverJob } from './jobs/autoDeliver';

const app = express();

const corsOptions: cors.CorsOptions = {
  origin: true,           // echo request Origin — required when credentials: true
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Range'],
  maxAge: 86400,
};
app.use(cors(corsOptions));
// Preflight must use the same options so browsers get matching headers
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

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

// Generic error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
  res.status(500).json({ error: 'Internal server error' });
});

const port = parseInt(process.env.PORT || '4000', 10);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  startAbandonedCartJob();
  startAutoDeliverJob();
});
