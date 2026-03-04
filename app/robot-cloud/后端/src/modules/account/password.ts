import crypto from 'crypto';

const SCRYPT_KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }

  const calculated = crypto.scryptSync(password, salt, SCRYPT_KEY_LEN).toString('hex');
  const hashBuffer = Uint8Array.from(Buffer.from(hash, 'hex'));
  const calculatedBuffer = Uint8Array.from(Buffer.from(calculated, 'hex'));

  if (hashBuffer.length !== calculatedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, calculatedBuffer);
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
