import { describe, it, expect, beforeEach } from 'vitest';
import { isDraining, setDraining } from '../src/lib/server-state';

describe('server-state', () => {
  beforeEach(() => {
    setDraining(false);
  });

  it('starts as not draining', () => {
    expect(isDraining()).toBe(false);
  });

  it('can be set to draining', () => {
    setDraining(true);
    expect(isDraining()).toBe(true);
  });

  it('can be reset to not draining', () => {
    setDraining(true);
    setDraining(false);
    expect(isDraining()).toBe(false);
  });
});
