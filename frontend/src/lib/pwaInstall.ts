export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const BANNER_DISMISS_KEY = 'niolla-pwa-banner-dismissed-at';
const BANNER_DISMISS_MS = 24 * 60 * 60 * 1000; // show banner again after 24h

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export interface PwaInstallSnapshot {
  isStandalone: boolean;
  canInstall: boolean;
  showBanner: boolean;
}

/** Stable reference for useSyncExternalStore — mutate fields in place when values change. */
const snapshot: PwaInstallSnapshot = {
  isStandalone: false,
  canInstall: false,
  showBanner: false,
};

function refreshSnapshot(): void {
  const isStandalone = isStandalonePwa();
  const canInstall = deferredPrompt !== null;
  const showBanner = canShowInstallBanner();
  snapshot.isStandalone = isStandalone;
  snapshot.canInstall = canInstall;
  snapshot.showBanner = showBanner;
}

function notify() {
  refreshSnapshot();
  listeners.forEach((fn) => fn());
}

export function getPwaInstallSnapshot(): PwaInstallSnapshot {
  refreshSnapshot();
  return snapshot;
}

export function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function canShowInstallBanner(): boolean {
  if (isStandalonePwa()) return false;
  if (!deferredPrompt) return false;
  const raw = localStorage.getItem(BANNER_DISMISS_KEY);
  if (!raw) return true;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return true;
  return Date.now() - dismissedAt > BANNER_DISMISS_MS;
}

export function dismissInstallBanner(): void {
  localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now()));
  notify();
}

export function clearInstallDismiss(): void {
  localStorage.removeItem(BANNER_DISMISS_KEY);
  notify();
}

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (isStandalonePwa()) return 'unavailable';
  const prompt = deferredPrompt;
  if (!prompt) return 'unavailable';
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      clearInstallDismiss();
    }
    notify();
    return outcome;
  } catch {
    return 'unavailable';
  }
}

export function subscribePwaInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call once at app startup — keeps install prompt available even after banner dismiss. */
export function initPwaInstallListeners(): void {
  if (typeof window === 'undefined') return;

  refreshSnapshot();

  window.addEventListener('beforeinstallprompt', (e) => {
    if (isStandalonePwa()) return;
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    clearInstallDismiss();
    notify();
  });
}

export function getManualInstallHint(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'Safari → Share → Add to Home Screen';
  }
  if (/android/.test(ua)) {
    return 'Chrome menu (⋮) → Install app, or Add to Home screen';
  }
  return 'Browser menu (⋮) → Install Niolla PM, or use the install icon in the address bar';
}
