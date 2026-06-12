import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { LayoutGrid } from 'lucide-react';
import {
  dismissInstallBanner,
  getManualInstallHint,
  getPwaInstallSnapshot,
  initPwaInstallListeners,
  subscribePwaInstall,
  triggerInstallPrompt,
} from '../lib/pwaInstall';
import { pushSystemToast } from '../lib/systemToast';
import styles from './PwaInstallPrompt.module.css';

const LOGO_PNG = '/logo/logo.png';
const PUBLISHER = typeof window !== 'undefined' ? window.location.host : 'niolla.app';

type PwaInstallModalContextValue = {
  openInstallModal: () => void;
};

const PwaInstallModalContext = createContext<PwaInstallModalContextValue>({
  openInstallModal: () => {},
});

function usePwaInstallModal() {
  return useContext(PwaInstallModalContext);
}

function InstallAppDialog({
  open,
  autoPrompted,
  onClose,
}: {
  open: boolean;
  autoPrompted: boolean;
  onClose: () => void;
}) {
  const [installing, setInstalling] = useState(false);

  if (!open) return null;

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const outcome = await triggerInstallPrompt();
      if (outcome === 'accepted') {
        pushSystemToast('Niolla PM installed — open it from your home screen or taskbar.', 'success');
        onClose();
      } else if (outcome === 'unavailable') {
        pushSystemToast(getManualInstallHint(), 'info', 10000);
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleLater = () => {
    dismissInstallBanner();
    onClose();
  };

  const handleDismiss = () => {
    if (autoPrompted) dismissInstallBanner();
    onClose();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div className={styles.dialog}>
        <button type="button" className={styles.closeBtn} onClick={handleDismiss} aria-label="Close">
          ×
        </button>

        <div className={styles.header}>
          <img src={LOGO_PNG} alt="" className={styles.appIcon} width={44} height={44} />
          <div className={styles.headerText}>
            <h2 id="pwa-install-title" className={styles.title}>
              Install Niolla PM app
            </h2>
            <p className={styles.publisher}>Publisher: {PUBLISHER}</p>
          </div>
        </div>

        <p className={styles.bodyLead}>Use this site often? Install the app which:</p>
        <ul className={styles.benefits}>
          <li>Opens in a focused window</li>
          <li>Has quick access — pin to taskbar or home screen</li>
          <li>Works offline after your first visit</li>
        </ul>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.installBtn}
            disabled={installing}
            onClick={() => void handleInstall()}
          >
            {installing ? 'Installing…' : 'Install'}
          </button>
          <button type="button" className={styles.laterBtn} onClick={handleLater}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const { showBanner } = useSyncExternalStore(subscribePwaInstall, getPwaInstallSnapshot, getPwaInstallSnapshot);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    initPwaInstallListeners();
  }, []);

  const openInstallModal = useCallback(() => setManualOpen(true), []);
  const closeInstallModal = useCallback(() => setManualOpen(false), []);

  const dialogOpen = showBanner || manualOpen;

  return (
    <PwaInstallModalContext.Provider value={{ openInstallModal }}>
      {children}
      <InstallAppDialog open={dialogOpen} autoPrompted={showBanner} onClose={closeInstallModal} />
    </PwaInstallModalContext.Provider>
  );
}

/** Toolbar-style install control (matches browser “install app” icon). */
export function PwaInstallHeaderButton() {
  const { canInstall, isStandalone } = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getPwaInstallSnapshot
  );
  const { openInstallModal } = usePwaInstallModal();

  if (isStandalone || !canInstall) return null;

  return (
    <button
      type="button"
      className={`${styles.headerBtn} ${styles.headerBtnVisible}`}
      onClick={openInstallModal}
      title="Install Niolla PM app"
      aria-label="Install Niolla PM app"
    >
      <LayoutGrid size={18} strokeWidth={1.75} aria-hidden />
      <span className={styles.headerBtnLabel}>Install app</span>
    </button>
  );
}
