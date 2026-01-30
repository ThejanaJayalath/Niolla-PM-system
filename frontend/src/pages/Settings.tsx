import styles from './Settings.module.css';

export default function Settings() {
  return (
    <div>
      <h1 className={styles.title}>Settings</h1>
      <div className={styles.placeholder}>
        <p>Settings will be available in a future phase.</p>
        <p className={styles.hint}>User management, preferences, and more.</p>
      </div>
    </div>
  );
}
