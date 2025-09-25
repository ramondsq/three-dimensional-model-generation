import crypto from 'crypto';

export function normalizePrompt(p) {
  return String(p || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

export async function hashBuffer(buffer) {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}
