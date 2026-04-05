/**
 * Typed event emitter for SDK lifecycle events.
 *
 * Provides strongly-typed `on()`, `once()`, and `emit()` methods.
 * Listeners execute synchronously and fire-and-forget (D-09).
 * Listener exceptions are swallowed and re-emitted as `warning` events (D-10).
 * `on()` returns an unsubscribe function (D-12).
 *
 * @module events
 */

type Listener<T> = (payload: T) => void;

/**
 * Event map for SDK lifecycle events. Maps event names to their payload types.
 */
export type SDKEventMap = {
  /** Fired before each HTTP request is sent. */
  request: { method: string; url: string };
  /** Fired after each HTTP response is received. */
  response: { status: number; url: string; durationMs: number };
  /** Fired before each retry attempt (D-04). */
  retry: { attempt: number; delayMs: number; error: unknown };
  /** Fired when an unrecoverable error occurs. */
  error: { error: unknown };
  /** Fired when a listener throws an exception (D-10). */
  warning: { message: string; error: unknown };
  /** Fired when an S3 upload attempt starts. */
  'upload:start': { url: string; bytes: number; contentType: string };
  /** Fired when an S3 upload completes successfully. */
  'upload:complete': { url: string; contentType: string };
};

/**
 * Typed event emitter.
 *
 * - `on(event, listener)` — subscribe, returns unsubscribe function (D-12)
 * - `once(event, listener)` — subscribe for one firing only (D-11)
 * - `emit(event, payload)` — dispatch event synchronously (D-09)
 * - Listener exceptions are swallowed and re-emitted as `warning` events (D-10)
 *
 * @template TMap - Event map type constraining event names and payload types.
 *   Defaults to {@link SDKEventMap}.
 */
export class TypedEmitter<TMap extends Record<string, unknown> = SDKEventMap> {
  private readonly listeners = new Map<keyof TMap, Array<Listener<unknown>>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function (D-12).
   *
   * @param event - Event name.
   * @param listener - Callback to invoke when event fires.
   * @returns Unsubscribe function — call it to remove this listener.
   */
  on<K extends keyof TMap>(event: K, listener: Listener<TMap[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  /**
   * Subscribe to an event for a single firing only (D-11).
   * The listener is automatically removed after it fires once.
   *
   * @param event - Event name.
   * @param listener - Callback to invoke when event fires.
   * @returns Unsubscribe function — call it to cancel before the event fires.
   */
  once<K extends keyof TMap>(event: K, listener: Listener<TMap[K]>): () => void {
    const wrapper = (payload: TMap[K]): void => {
      unsub();
      listener(payload);
    };
    const unsub = this.on(event, wrapper as Listener<TMap[K]>);
    return unsub;
  }

  /**
   * Dispatch an event synchronously (D-09).
   *
   * If any listener throws, the exception is swallowed and a `warning` event
   * is emitted instead (D-10). If a `warning` listener itself throws, the
   * exception is silently swallowed to prevent infinite recursion.
   *
   * @param event - Event name.
   * @param payload - Event payload.
   */
  emit<K extends keyof TMap>(event: K, payload: TMap[K]): void {
    const fns = this.listeners.get(event);
    if (!fns) return;
    // Snapshot to array so that mutations during iteration are safe
    for (const fn of [...fns]) {
      try {
        fn(payload);
      } catch (err) {
        if (event !== 'warning') {
          // Emit warning event; if that also throws, swallow silently (D-10)
          try {
            this.emit(
              'warning' as K,
              { message: 'Listener threw an exception', error: err } as TMap[K],
            );
          } catch {
            // Warning listener threw — swallow to prevent infinite recursion
          }
        }
        // If we're already emitting 'warning', just swallow the error
      }
    }
  }

  private off<K extends keyof TMap>(event: K, listener: Listener<TMap[K]>): void {
    const fns = this.listeners.get(event);
    if (!fns) return;
    const idx = fns.indexOf(listener as Listener<unknown>);
    if (idx !== -1) fns.splice(idx, 1);
  }
}
