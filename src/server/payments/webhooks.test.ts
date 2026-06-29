import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyStripeSignature, verifyRazorpaySignature } from '@/server/payments/webhooks';

const SECRET = 'whsec_test_secret';
const BODY = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });

function stripeHeader(body: string, secret: string, t: number): string {
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

describe('Stripe signature verification', () => {
  const now = 1_700_000_000;
  it('accepts a valid, fresh signature', () => {
    const header = stripeHeader(BODY, SECRET, now);
    expect(verifyStripeSignature(BODY, header, SECRET, { nowSec: now })).toBe(true);
  });

  it('rejects a tampered body', () => {
    const header = stripeHeader(BODY, SECRET, now);
    expect(verifyStripeSignature(BODY + 'x', header, SECRET, { nowSec: now })).toBe(false);
  });

  it('rejects a stale timestamp (replay protection)', () => {
    const header = stripeHeader(BODY, SECRET, now - 10_000);
    expect(verifyStripeSignature(BODY, header, SECRET, { nowSec: now })).toBe(false);
  });

  it('rejects the wrong secret and malformed headers', () => {
    const header = stripeHeader(BODY, SECRET, now);
    expect(verifyStripeSignature(BODY, header, 'whsec_wrong', { nowSec: now })).toBe(false);
    expect(verifyStripeSignature(BODY, 'garbage', SECRET, { nowSec: now })).toBe(false);
  });
});

describe('Razorpay signature verification', () => {
  it('accepts a valid signature and rejects tampering', () => {
    const sig = crypto.createHmac('sha256', SECRET).update(BODY).digest('hex');
    expect(verifyRazorpaySignature(BODY, sig, SECRET)).toBe(true);
    expect(verifyRazorpaySignature(BODY + 'x', sig, SECRET)).toBe(false);
    expect(verifyRazorpaySignature(BODY, sig, 'wrong')).toBe(false);
  });
});
