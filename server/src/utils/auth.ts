import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a random device token (64 character hex string)
 */
export function generateDeviceToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a device token for storage
 */
export async function hashDeviceToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

/**
 * Verify a device token against a hash
 */
export async function verifyDeviceToken(
  token: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
