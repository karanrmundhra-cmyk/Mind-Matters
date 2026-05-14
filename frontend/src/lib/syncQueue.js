import Dexie from "dexie";
import { api } from "./api";

/**
 * Offline-first sync queue.
 *
 *  • Every mutating axios request (POST/PATCH/PUT/DELETE) is attempted live.
 *  • If the network fails (no internet, server down) the request is appended
 *    to an IndexedDB queue and the call resolves OK (optimistic).
 *  • A drain loop runs whenever the browser is online and tries to flush the
 *    queue in FIFO order. Each successful flush emits "syncqueue-change".
 *  • Subscribers (FloatingDock) get { status, pending } via subscribeSync().
 *
 * Status semantics:
 *   green   — online AND pending=0
 *   yellow  — online AND pending>0 (draining)  OR  offline AND pending=0
 *   red     — offline AND pending>0  (changes waiting to upload)
 */

class SyncDB extends Dexie {
  constructor() {
    super("mm_offline");
    this.version(1).stores({
      queue: "++id, ts, url",
    });
  }
}
const db = new SyncDB();

const listeners = new Set();
let state = { status: "green", pending: 0 };
let draining = false;

const emit = () => listeners.forEach((fn) => { try { fn(state); } catch { /* ignore */ } });

const computeStatus = (pending) => {
  const online = navigator.onLine !== false;
  if (online && pending === 0) return "green";
  if (online && pending > 0) return "yellow";
  if (!online && pending === 0) return "yellow"; // offline but no changes yet
  return "red"; // offline + queued
};

const refresh = async () => {
  const pending = await db.queue.count();
  state = { status: computeStatus(pending), pending };
  emit();
};

/** Subscribe to sync state. Returns an unsubscribe fn. */
export function subscribeSync(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

/** Queue a failed request for later retry. */
async function enqueue(req) {
  await db.queue.add({
    method: req.method,
    url: req.url,
    data: req.data ?? null,
    headers: req.headers ?? null,
    ts: Date.now(),
    retries: 0,
  });
  await refresh();
}

/** Drain the queue while online. Returns the number of successfully flushed items. */
export async function drainQueue() {
  if (draining) return 0;
  if (navigator.onLine === false) {
    await refresh();
    return 0;
  }
  draining = true;
  let flushed = 0;
  try {
    while (true) {
      const next = await db.queue.orderBy("id").first();
      if (!next) break;
      try {
        await api.request({
          method: next.method,
          url: next.url,
          data: next.data,
          headers: next.headers || undefined,
          // Bypass our offline-fallback wrapper to avoid re-enqueueing.
          _offlineSkip: true,
        });
        await db.queue.delete(next.id);
        flushed += 1;
        await refresh();
      } catch (err) {
        const isNet = !err.response;
        if (isNet) {
          // Still offline / server down — stop and try again later.
          break;
        }
        // Server returned 4xx/5xx — bump retries; drop after 3 attempts to avoid blocking the queue.
        const retries = (next.retries || 0) + 1;
        if (retries >= 3) {
          await db.queue.delete(next.id);
        } else {
          await db.queue.update(next.id, { retries });
        }
        await refresh();
        break;
      }
    }
  } finally {
    draining = false;
  }
  return flushed;
}

/** Attempt a write; if the network fails, queue it locally. */
export async function safeWrite(method, url, data, config = {}) {
  try {
    const res = await api.request({
      method,
      url,
      data,
      ...config,
      _offlineSkip: true,
    });
    // Opportunistic drain after a successful live write.
    if (state.pending > 0) drainQueue();
    return res;
  } catch (err) {
    const isNet = !err.response;
    if (isNet) {
      await enqueue({ method, url, data, headers: config.headers });
      drainQueue(); // schedule retry, will no-op if offline
      // Return a synthetic 202 so callers can keep their UI optimistic.
      return {
        data: data ?? null,
        status: 202,
        statusText: "Queued (offline)",
        headers: {},
        _queued: true,
      };
    }
    throw err;
  }
}

// Wire axios response interceptor: skip our explicit safeWrite calls
// (they handle their own offline fallback), but for any other mutating
// request that fails with a network error, enqueue it transparently so
// existing call sites don't need to change.
api.interceptors.request.use((config) => {
  // No-op marker — kept so we can inspect easily.
  return config;
});
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const cfg = err.config || {};
    const isNet = !err.response;
    const method = (cfg.method || "get").toLowerCase();
    const isMutation = ["post", "patch", "put", "delete"].includes(method);
    if (isNet && isMutation && !cfg._offlineSkip) {
      await enqueue({
        method,
        url: cfg.url,
        data: cfg.data ? safeParse(cfg.data) : null,
        headers: cfg.headers,
      });
      drainQueue();
      return {
        data: null,
        status: 202,
        statusText: "Queued (offline)",
        headers: {},
        config: cfg,
        _queued: true,
      };
    }
    return Promise.reject(err);
  },
);

const safeParse = (d) => {
  if (typeof d !== "string") return d;
  try { return JSON.parse(d); } catch { return d; }
};

// Boot: emit initial state + drain on load + listen for online events.
refresh();
window.addEventListener("online", () => drainQueue());
window.addEventListener("offline", () => refresh());
// Background drain attempt every 20s in case server was temporarily 5xx.
setInterval(() => { if (navigator.onLine !== false) drainQueue(); }, 20000);
