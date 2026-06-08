import { formatLkr } from '../lib/campaignPricing';
import styles from './PriceBreakdownPanel.module.css';

interface PriceBreakdownPanelProps {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  campaignName?: string;
  discountLabel?: string;
  compact?: boolean;
}

export default function PriceBreakdownPanel({
  originalPrice,
  discountAmount,
  finalPrice,
  campaignName,
  discountLabel,
  compact = false,
}: PriceBreakdownPanelProps) {
  if (discountAmount <= 0) return null;

  return (
    <div className={compact ? styles.panelCompact : styles.panel}>
      {campaignName ? (
        <p className={styles.campaignName}>
          {campaignName}
          {discountLabel ? <span className={styles.badge}>{discountLabel}</span> : null}
        </p>
      ) : null}
      <p className={styles.formula}>Original price − Discount = Final payable</p>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Original price</dt>
          <dd>{formatLkr(originalPrice)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Discount</dt>
          <dd className={styles.discount}>− {formatLkr(discountAmount)}</dd>
        </div>
        <div className={`${styles.row} ${styles.finalRow}`}>
          <dt>Final payable</dt>
          <dd className={styles.final}>{formatLkr(finalPrice)}</dd>
        </div>
      </dl>
    </div>
  );
}
