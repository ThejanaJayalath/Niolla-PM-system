import styles from './Billing.module.css';

export default function Billing() {
  return (
    <div>
      <h1 className={styles.title}>Billing</h1>
      <div className={styles.placeholder}>
        <p>Billing will be available in a future phase.</p>
        <p className={styles.hint}>Invoices, payments, and subscription management.</p>
      </div>
    </div>
  );
}
