import { describe, expect, it, vi } from 'vitest';
import { TypedEmitter } from '../events.js';
import type { SDKEventMap } from '../events.js';

describe('TypedEmitter', () => {
  // ── Test 1: on() listener receives correct payload ────────────────────────

  it('on() calls listener with correct payload', () => {
    const emitter = new TypedEmitter();
    const fn = vi.fn();
    emitter.on('retry', fn);
    emitter.emit('retry', { attempt: 1, delayMs: 500, error: null });
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith({ attempt: 1, delayMs: 500, error: null });
  });

  // ── Test 2: on() returns unsubscribe function (D-12) ─────────────────────

  it('on() returns unsubscribe function that prevents future calls', () => {
    const emitter = new TypedEmitter();
    const fn = vi.fn();
    const unsub = emitter.on('retry', fn);
    unsub();
    emitter.emit('retry', { attempt: 1, delayMs: 500, error: null });
    expect(fn).not.toHaveBeenCalled();
  });

  // ── Test 3: once() fires listener exactly once (D-11) ────────────────────

  it('once() fires listener exactly once', () => {
    const emitter = new TypedEmitter();
    const fn = vi.fn();
    emitter.once('error', fn);
    emitter.emit('error', { error: new Error('oops') });
    emitter.emit('error', { error: new Error('oops again') });
    expect(fn).toHaveBeenCalledOnce();
  });

  // ── Test 4: Listener that throws does NOT propagate (D-10) ───────────────

  it('listener that throws does not propagate to emit() caller', () => {
    const emitter = new TypedEmitter();
    emitter.on('retry', () => {
      throw new Error('listener blew up');
    });
    // Should not throw
    expect(() => {
      emitter.emit('retry', { attempt: 1, delayMs: 500, error: null });
    }).not.toThrow();
  });

  // ── Test 5: Listener that throws causes warning event (D-10) ─────────────

  it('listener that throws emits warning event', () => {
    const emitter = new TypedEmitter();
    const listenerError = new Error('listener blew up');
    emitter.on('retry', () => {
      throw listenerError;
    });
    const warningFn = vi.fn();
    emitter.on('warning', warningFn);
    emitter.emit('retry', { attempt: 1, delayMs: 500, error: null });
    expect(warningFn).toHaveBeenCalledOnce();
    const call = warningFn.mock.calls[0] as [{ message: string; error: unknown }];
    expect(call[0].error).toBe(listenerError);
  });

  // ── Test 6: Warning listener that throws does NOT recurse ────────────────

  it('warning listener that throws does not recurse infinitely', () => {
    const emitter = new TypedEmitter();
    emitter.on('retry', () => {
      throw new Error('retry listener throws');
    });
    emitter.on('warning', () => {
      throw new Error('warning listener also throws');
    });
    // Must complete without stack overflow
    expect(() => {
      emitter.emit('retry', { attempt: 1, delayMs: 500, error: null });
    }).not.toThrow();
  });

  // ── Test 7: Multiple listeners on same event all fire ────────────────────

  it('multiple listeners on same event all fire', () => {
    const emitter = new TypedEmitter();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const fn3 = vi.fn();
    emitter.on('request', fn1);
    emitter.on('request', fn2);
    emitter.on('request', fn3);
    const payload: SDKEventMap['request'] = { method: 'POST', url: 'https://api.deepidv.com/v1/test' };
    emitter.emit('request', payload);
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
    expect(fn3).toHaveBeenCalledOnce();
  });

  // ── Test 8: Emit with no listeners does not error ────────────────────────

  it('emit with no listeners does not error', () => {
    const emitter = new TypedEmitter();
    expect(() => {
      emitter.emit('response', { status: 200, url: 'https://api.deepidv.com', durationMs: 150 });
    }).not.toThrow();
  });

  // ── Test 9: Unsubscribe during iteration does not crash ──────────────────

  it('unsubscribe during iteration does not crash', () => {
    const emitter = new TypedEmitter();
    const fn = vi.fn();
    let unsub: (() => void) | undefined;
    emitter.on('retry', () => {
      if (unsub) unsub();
    });
    unsub = emitter.on('retry', fn);
    // Should not crash — unsub called while iterating listeners
    expect(() => {
      emitter.emit('retry', { attempt: 1, delayMs: 500, error: null });
    }).not.toThrow();
  });

  // ── Test 10: emit() is synchronous (D-09) ────────────────────────────────

  it('emit() is synchronous — returns void immediately', () => {
    const emitter = new TypedEmitter();
    const order: number[] = [];
    emitter.on('retry', () => {
      order.push(2);
    });
    order.push(1);
    emitter.emit('retry', { attempt: 1, delayMs: 500, error: null });
    order.push(3);
    expect(order).toStrictEqual([1, 2, 3]);
  });

  // ── Test 11: once() returns unsubscribe, cancellable before fire ─────────

  it('once() returns unsubscribe function that cancels before first fire', () => {
    const emitter = new TypedEmitter();
    const fn = vi.fn();
    const unsub = emitter.once('error', fn);
    unsub();
    emitter.emit('error', { error: new Error('err') });
    expect(fn).not.toHaveBeenCalled();
  });
});
