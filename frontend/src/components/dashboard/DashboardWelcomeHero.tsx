import styles from '../../pages/Dashboard.module.css';

interface Props {
  userName?: string;
}

export default function DashboardWelcomeHero({ userName }: Props) {
  const firstName = userName?.split(' ')[0] || 'there';

  return (
    <section className={styles.welcomeBanner} aria-label="Welcome">
      <div className={styles.welcomeContent}>
        <h1 className={styles.welcomeTitle}>Hello, {firstName}!</h1>
        <p className={styles.welcomeSubtitle}>Welcome back to Niolla NEXA</p>
      </div>
      <div className={styles.welcomeSkyline} aria-hidden>
        <svg viewBox="0 0 400 120" className={styles.skylineSvg} preserveAspectRatio="xMaxYMax meet">
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF9A3C" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FF7A00" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <rect width="400" height="120" fill="url(#skyGrad)" />
          <path
            fill="#FF7A00"
            fillOpacity="0.85"
            d="M0,95 L30,95 L30,70 L45,70 L45,95 L60,95 L60,55 L75,55 L75,95 L95,95 L95,40 L110,40 L110,95 L130,95 L130,60 L145,60 L145,95 L165,95 L165,50 L180,50 L180,95 L200,95 L200,35 L215,35 L215,95 L235,95 L235,65 L250,65 L250,95 L270,95 L270,45 L285,45 L285,95 L305,95 L305,55 L320,55 L320,95 L340,95 L340,70 L355,70 L355,95 L400,95 L400,120 L0,120 Z"
          />
          <circle cx="320" cy="30" r="22" fill="none" stroke="#FF7A00" strokeWidth="3" strokeOpacity="0.7" />
          <circle cx="320" cy="30" r="3" fill="#FF7A00" fillOpacity="0.7" />
          <line x1="320" y1="8" x2="320" y2="52" stroke="#FF7A00" strokeWidth="2" strokeOpacity="0.5" />
          <line x1="298" y1="30" x2="342" y2="30" stroke="#FF7A00" strokeWidth="2" strokeOpacity="0.5" />
        </svg>
      </div>
    </section>
  );
}
