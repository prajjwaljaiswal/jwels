import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { requireAuth, loadPermissions } from '../middleware/auth';
import { sendPasswordResetEmail } from '../lib/email';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['CUSTOMER', 'VENDOR']).default('CUSTOMER'),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { name, email, phone, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role: role as Role },
  });

  const token = signToken({ userId: user.id, role: user.role });
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ userId: user.id, role: user.role });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// Google sign-in / sign-up: verifies a Google ID token, then issues our JWT.
const googleSchema = z.object({
  credential: z.string().min(10), // the JWT ID token from Google Identity Services
  role: z.enum(['CUSTOMER', 'VENDOR']).optional(),
});

interface GoogleTokenInfo {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  error_description?: string;
}

router.post('/google', async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'Google sign-in is not configured' });

  let info: GoogleTokenInfo;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(parsed.data.credential)}`);
    info = (await r.json()) as GoogleTokenInfo;
    if (!r.ok || info.error_description) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
  } catch {
    return res.status(401).json({ error: 'Could not verify Google token' });
  }

  if (info.aud !== clientId) return res.status(401).json({ error: 'Token audience mismatch' });
  const verified = info.email_verified === true || info.email_verified === 'true';
  if (!info.email || !verified) return res.status(401).json({ error: 'Email not verified by Google' });

  let user = await prisma.user.findUnique({ where: { email: info.email } });
  if (!user) {
    // First-time Google sign-in: create a passwordless account (random hash).
    const placeholder = await bcrypt.hash(`google:${info.sub}:${Date.now()}`, 10);
    user = await prisma.user.create({
      data: {
        name: info.name || info.email.split('@')[0],
        email: info.email,
        passwordHash: placeholder,
        role: (parsed.data.role as Role) || Role.CUSTOMER,
      },
    });
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { vendor: true },
  });
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { passwordHash, ...safe } = user;
  const permissions = user.role === Role.ADMIN ? await loadPermissions(user.id) : [];
  res.json({ ...safe, permissions });
});

const updateMeSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(4).max(20).optional().nullable(),
});

router.patch('/me', requireAuth, async (req, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: { name?: string; phone?: string | null } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
  });
  const { passwordHash, ...safe } = user;
  res.json(safe);
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.post('/change-password', requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ ok: true });
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
  vendor: z.string().optional(),
});

router.post('/forgot-password', async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Always return 200 to prevent email enumeration
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: tokenHash, passwordResetTokenExpiry: expiry },
  });

  const storefrontOrigin = process.env.STOREFRONT_ORIGIN || 'http://localhost:3002';
  const vendorParam = parsed.data.vendor ? `&vendor=${encodeURIComponent(parsed.data.vendor)}` : '';
  const resetLink = `${storefrontOrigin}/reset-password?token=${rawToken}${vendorParam}`;

  try {
    await sendPasswordResetEmail(user.email, resetLink);
  } catch {
    // Don't expose email failures to the client
  }

  res.json({ message: 'If that email exists, a reset link has been sent.' });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

router.post('/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { token, password } = parsed.data;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) return res.status(400).json({ error: 'Token is invalid or has expired.' });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetToken: null, passwordResetTokenExpiry: null },
  });

  res.json({ message: 'Password reset successful.' });
});

export default router;
