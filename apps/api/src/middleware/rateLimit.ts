import rateLimit from 'express-rate-limit';

// Rate limiters guard abuse-prone endpoints (brute force, credential stuffing,
// coupon-code guessing, checkout spamming). All key on client IP by default —
// `app.set('trust proxy', 1)` in index.ts ensures the real client IP is read
// behind the PM2/nginx reverse proxy. Limits are relaxed outside production so
// local development and QA are not throttled.
const isProd = process.env.NODE_ENV === 'production';

const base = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
};

/** Login / Google sign-in — strict, blunts credential stuffing. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 20 : 200,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

/** Account creation & password-reset flows — slower, more abuse-prone. */
export const sensitiveAuthLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: isProd ? 10 : 200,
  message: { error: 'Too many attempts. Please try again later.' },
});

/** Checkout / payment endpoints. */
export const checkoutLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 40 : 300,
  message: { error: 'Too many requests. Please slow down and try again.' },
});

/** Coupon apply / validate — prevents code brute-forcing. */
export const couponLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 30 : 300,
  message: { error: 'Too many coupon attempts. Please try again later.' },
});
