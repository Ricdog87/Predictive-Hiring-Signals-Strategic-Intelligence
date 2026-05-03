export type ToastEventDetail = { message: string };

export function emitToast(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastEventDetail>('dashboard-toast', { detail: { message } }));
}
