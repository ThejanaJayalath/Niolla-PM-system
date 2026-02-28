import { UserCircle } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function Customer() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Customer</h1>
      <div className={styles.card}>
        <div className={styles.cardIcon}>
          <UserCircle size={24} />
        </div>
        <div className={styles.cardContent}>
          <span className={styles.cardLabel}>Customer</span>
          <span className={styles.cardValue}>Manage your customers here.</span>
        </div>
      </div>
    </div>
  );
}
