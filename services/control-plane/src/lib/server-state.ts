// ABOUTME: Tiny module tracking server draining state for graceful shutdown.
// ABOUTME: Keeps state testable without importing main.ts.

let draining = false;

export function isDraining(): boolean {
  return draining;
}

export function setDraining(value: boolean): void {
  draining = value;
}
