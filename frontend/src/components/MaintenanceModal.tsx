import { useEffect } from 'react';
import { Wrench } from 'lucide-react';
import styles from './ConfirmDialog.module.css';

interface MaintenanceModalProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export default function MaintenanceModal({
  open,
  title,
  message,
  onClose,
}: MaintenanceModalProps) {
  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={`${styles.iconWrap} ${styles.iconMaintenance}`}>
          <Wrench size={24} />
        </div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions} style={{ gridTemplateColumns: '1fr' }}>
          <button type="button" className={styles.maintenanceOkBtn} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
