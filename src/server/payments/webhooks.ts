import crypto from 'node:crypto';

/**
 * Server-side webhook signature verification for Stripe and Razorpay. Verifying the
 * signature is mandatory before trusting any payment webhook (prevents spoofed events).
 * Pure crypto — unit-testable with a known secret.
 */

function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify a Stripe `Stripe-Signature` header of the form `t=<ts>,v1=<sig>`.
 * Signed payload is `${t}.${rawBody}`, HMAC-SHA256 keyed by the endpoint secret.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
  opts: { toleranceSec?: number; nowSec?: number } = {},
): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k?.trim(), v?.trim()] as const;
    }),
  );
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;

  const tolerance = opts.toleranceSec ?? 300;
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > tolerance) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return timingSafeEqualHex(expected, v1);
}

/** Verify a Razorpay webhook: HMAC-SHA256(rawBody, secret) hex === `X-Razorpay-Signature`. */
export function verifyRazorpaySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualHex(expected, signature);
}
