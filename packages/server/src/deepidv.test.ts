/**
 * Tests for DeepIDV public entry point class.
 *
 * All tests are synchronous constructor-level tests — no network calls made.
 */

import { describe, it, expect } from 'vitest';
import { DeepIDV } from './deepidv.js';
import { ValidationError } from '@deepidv/core';

describe('DeepIDV constructor', () => {
  it('Test 1: creates instance with all module namespace properties when valid apiKey is provided', () => {
    const client = new DeepIDV({ apiKey: 'sk-test-123' });
    expect(client.sessions).toBeDefined();
    expect(client.document).toBeDefined();
    expect(client.face).toBeDefined();
    expect(client.identity).toBeDefined();
  });

  it('Test 2: throws ValidationError containing "apiKey" when no apiKey is provided', () => {
    expect(() => new DeepIDV({} as { apiKey: string })).toThrow(ValidationError);
    expect(() => new DeepIDV({} as { apiKey: string })).toThrow(/apiKey/i);
  });

  it('Test 3: throws ValidationError when apiKey is an empty string', () => {
    expect(() => new DeepIDV({ apiKey: '' })).toThrow(ValidationError);
  });

  it('Test 4: throws ValidationError when baseUrl is not a valid URL', () => {
    expect(() => new DeepIDV({ apiKey: 'sk-test', baseUrl: 'not-a-url' })).toThrow(ValidationError);
  });

  it('Test 5: throws ValidationError when timeout is negative', () => {
    expect(() => new DeepIDV({ apiKey: 'sk-test', timeout: -1 })).toThrow(ValidationError);
  });

  it('Test 6: throws ValidationError when maxRetries is negative', () => {
    expect(() => new DeepIDV({ apiKey: 'sk-test', maxRetries: -1 })).toThrow(ValidationError);
  });

  it('Test 7: creates instance successfully with valid custom baseUrl', () => {
    const client = new DeepIDV({ apiKey: 'sk-test', baseUrl: 'https://custom.api.com' });
    expect(client.sessions).toBeDefined();
    expect(client.document).toBeDefined();
    expect(client.face).toBeDefined();
    expect(client.identity).toBeDefined();
  });

  it('Test 8: exposes event subscription via on() method', () => {
    const client = new DeepIDV({ apiKey: 'sk-test-123' });
    const handler = (_payload: { method: string; url: string }) => {};
    const unsub = client.on('request', handler);
    expect(typeof unsub).toBe('function');
    // calling unsub should not throw
    expect(() => unsub()).not.toThrow();
  });
});
