import jwt, { SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  role: Role;
}

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
