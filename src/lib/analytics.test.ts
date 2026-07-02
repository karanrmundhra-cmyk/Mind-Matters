import { describe, it, expect, afterEach } from 'vitest';
import { track, setAnalyticsSink, ANALYTICS_EVENTS } from '@/lib/analytics';

afterEach(() => setAnalyticsSink(null));

describe('analytics', () => {
  it('is a no-op with no sink (never throws)', () => {
    expect(() => track('loop_created')).not.toThrow();
  });

  it('forwards events + props to the registered sink', () => {
    const calls: Array<{ e: string; p?: Record<string, unknown> }> = [];
    setAnalyticsSink((e, p) => calls.push({ e, p }));
    track('loop_confirmed', { loopId: 'x' });
    expect(calls).toEqual([{ e: 'loop_confirmed', p: { loopId: 'x' } }]);
  });

  it('swallows sink errors', () => {
    setAnalyticsSink(() => {
      throw new Error('boom');
    });
    expect(() => track('loop_closed')).not.toThrow();
  });

  it('exposes the full spec event list', () => {
    expect(ANALYTICS_EVENTS).toContain('first_loop_confirmed');
    expect(ANALYTICS_EVENTS.length).toBe(18);
  });
});
