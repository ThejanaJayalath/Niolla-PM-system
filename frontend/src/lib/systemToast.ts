export type ToastVariant = 'info' | 'warning' | 'error' | 'success';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type Listener = (items: ToastItem[]) => void;

let nextId = 1;
const queue: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  const snapshot = [...queue];
  listeners.forEach((l) => l(snapshot));
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener([...queue]);
  return () => {
    listeners.delete(listener);
  };
}

/** In-app toast (no `window.alert`). Safe to call from non-React code e.g. `api.download`. */
export function pushSystemToast(message: string, variant: ToastVariant = 'info', durationMs = 9000): void {
  const id = nextId++;
  queue.push({ id, message, variant });
  emit();
  if (durationMs > 0) {
    setTimeout(() => removeToast(id), durationMs);
  }
}

export function removeToast(id: number): void {
  const i = queue.findIndex((t) => t.id === id);
  if (i >= 0) {
    queue.splice(i, 1);
    emit();
  }
}
