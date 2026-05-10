import { useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Single OK button — in-app “system” style instead of browser alert() */
  alertMode?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  alertMode = false,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.iconWrap}>
          {alertMode && !danger ? (
            <Info size={24} className={styles.iconInfo} />
          ) : (
            <AlertTriangle size={24} className={danger ? styles.iconDanger : styles.iconWarn} />
          )}
        </div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={alertMode ? styles.actionsSingle : styles.actions}>
          {!alertMode && (
            <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isLoading}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={
              alertMode
                ? styles.alertOkBtn
                : danger
                  ? styles.dangerBtn
                  : styles.confirmBtn
            }
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
