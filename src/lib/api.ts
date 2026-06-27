import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Consistent API envelopes + error codes for every /api/v1 route.
 * Success: { ok: true, data }. Failure: { ok: false, error: { code, message, details? } }.
 */
export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'validation_error'
  | 'idempotency_replay'
  | 'internal';

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  validation_error: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  idempotency_replay: 409,
  rate_limited: 429,
  internal: 500,
};

export function ok<T>(data: T, init?: { status?: number; headers?: HeadersInit }) {
  return NextResponse.json({ ok: true as const, data }, { status: init?.status ?? 200, headers: init?.headers });
}

export function fail(code: ApiErrorCode, message: string, details?: unknown) {
  const body = { ok: false as const, error: { code, message, ...(details ? { details } : {}) } };
  return NextResponse.json(body, { status: STATUS[code] });
}

/** Domain error that maps cleanly onto an API failure. */
export class ApiException extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.details = details;
  }
}

/** Validate a JSON body against a zod schema, throwing a typed ApiException on failure. */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiException('validation_error', 'Request validation failed', result.error.flatten());
  }
  return result.data;
}

/** Wrap a route handler so thrown ApiExceptions (and unknown errors) become envelopes. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiException) return fail(e.code, e.message, e.details);
    // Never leak internals; the real logger/Sentry hook lands in Step 10.
    const message = process.env.NODE_ENV === 'development' && e instanceof Error ? e.message : 'Something went wrong';
    return fail('internal', message);
  }
}
