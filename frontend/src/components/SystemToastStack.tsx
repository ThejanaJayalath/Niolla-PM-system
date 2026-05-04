import { useEffect, useState, type ReactNode } from 'react';
import { X, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { subscribeToasts, removeToast, type ToastItem, type ToastVariant } from '../lib/systemToast';

function variantStyles(v: ToastVariant): { bar: string; icon: ReactNode } {
  switch (v) {
    case 'success':
      return {
        bar: 'border-l-emerald-500 bg-white shadow-lg ring-1 ring-emerald-100',
        icon: <CheckCircle className="shrink-0 text-emerald-600" size={22} aria-hidden />,
      };
    case 'error':
      return {
        bar: 'border-l-red-600 bg-white shadow-lg ring-1 ring-red-100',
        icon: <AlertCircle className="shrink-0 text-red-600" size={22} aria-hidden />,
      };
    case 'warning':
      return {
        bar: 'border-l-amber-500 bg-white shadow-lg ring-1 ring-amber-100',
        icon: <AlertTriangle className="shrink-0 text-amber-600" size={22} aria-hidden />,
      };
    default:
      return {
        bar: 'border-l-orange-500 bg-white shadow-lg ring-1 ring-orange-100',
        icon: <Info className="shrink-0 text-orange-600" size={22} aria-hidden />,
      };
  }
}

export default function SystemToastStack() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex max-w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((t) => {
        const { bar, icon } = variantStyles(t.variant);
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex gap-3 rounded-lg border border-gray-200 border-l-4 py-3 pl-3 pr-2 ${bar}`}
          >
            <div className="pt-0.5">{icon}</div>
            <p className="min-w-0 flex-1 text-sm leading-snug text-gray-800">{t.message}</p>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
