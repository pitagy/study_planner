// lib/ui.ts
export function confirmAsync(message: string) {
  if (typeof window === 'undefined') return Promise.resolve(true);
  return Promise.resolve(window.confirm(message));
}
