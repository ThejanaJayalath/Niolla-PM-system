import { useCallback, useEffect, useState } from 'react';
import { CalendarHeart, Mail, MessageCircle, PartyPopper, Sparkles, TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import { openWhatsAppWithCardDownload } from '../lib/whatsappCardSend';
import BirthdayTodaySection from './BirthdayTodaySection';
import styles from './BirthdayTodaySection.module.css';

interface AnniversaryRow {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  email?: string;
  phone?: string;
  latestCardId?: string;
  latestCardImageUrl?: string;
  lastSentAt?: string;
  lastSentChannel?: 'email' | 'whatsapp';
}

interface EngagementStatRow {
  subjectType: string;
  subjectId: string;
  personName: string;
  sends: number;
  responses: number;
  responseRate: number;
  lastSentAt?: string;
  campaignTypes: string[];
}

interface EngagementRecentRow {
  cardId: string;
  personName: string;
  campaignType: string;
  sentAt: string;
  sentChannel?: 'email' | 'whatsapp';
  respondedAt?: string;
  subjectType: string;
}

interface EngagementOverview {
  summary: {
    totalSends: number;
    totalReplies: number;
    responseRate: number;
    awaitingReply: number;
  };
  leaderboard: EngagementStatRow[];
  recent: EngagementRecentRow[];
}

const FESTIVAL_LABELS: Record<string, string> = {
  new_year: 'New Year',
  christmas: 'Christmas',
  vesak: 'Vesak',
  deepavali: 'Deepavali',
  general: 'General festive',
};

export default function CrmEngagementSection({ enabled }: { enabled: boolean }) {
  const [anniversaries, setAnniversaries] = useState<AnniversaryRow[]>([]);
  const [prospectCount, setProspectCount] = useState(0);
  const [festivals, setFestivals] = useState<string[]>([]);
  const [overview, setOverview] = useState<EngagementOverview | null>(null);
  const [festivalKey, setFestivalKey] = useState('new_year');
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    Promise.all([
      api.get<AnniversaryRow[]>('/engagement/anniversaries/today'),
      api.get<{ festivals: string[]; prospects: { inquiryId: string }[] }>('/engagement/festival/prospects'),
      api.get<EngagementOverview>('/engagement/stats'),
    ])
      .then(([ann, fest, st]) => {
        if (ann.success && ann.data) setAnniversaries(ann.data);
        else setAnniversaries([]);
        if (fest.success && fest.data) {
          setFestivals(fest.data.festivals);
          setProspectCount(fest.data.prospects.length);
          if (fest.data.festivals.length && !fest.data.festivals.includes(festivalKey)) {
            setFestivalKey(fest.data.festivals[0]);
          }
        }
        if (st.success && st.data) setOverview(st.data);
        else setOverview(null);
      })
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const sendAnniversary = async (row: AnniversaryRow, channel: 'email' | 'whatsapp') => {
    const key = `ann:${channel}:${row.projectId}`;
    setBusyKey(key);
    const res = await api.post<{
      sent: boolean;
      whatsappDeepLink?: string;
      cardDownloadUrl?: string;
      message?: string;
    }>(`/engagement/anniversaries/${row.projectId}/send`, {
      channel,
      cardId: row.latestCardId,
    });
    setBusyKey(null);
    if (res.success && res.data) {
      if (channel === 'whatsapp' && res.data.whatsappDeepLink && !res.data.sent) {
        const imageUrl = res.data.cardDownloadUrl ?? row.latestCardImageUrl;
        if (imageUrl) {
          try {
            await openWhatsAppWithCardDownload(
              res.data.whatsappDeepLink,
              imageUrl,
              `anniversary-${row.customerName.replace(/\s+/g, '-')}`
            );
          } catch {
            window.open(res.data.whatsappDeepLink, '_blank', 'noopener,noreferrer');
          }
        } else {
          window.open(res.data.whatsappDeepLink, '_blank', 'noopener,noreferrer');
        }
      }
      pushSystemToast(res.data.message ?? 'Sent', 'success');
      load();
    } else {
      pushSystemToast(res.error?.message ?? 'Send failed', 'error');
    }
  };

  const generateAnniversary = async (row: AnniversaryRow) => {
    setBusyKey(`gen:${row.projectId}`);
    const res = await api.post(`/engagement/anniversaries/${row.projectId}/generate-card`, {});
    setBusyKey(null);
    if (res.success) {
      pushSystemToast('Anniversary card generated', 'success');
      load();
    } else {
      pushSystemToast(res.error?.message ?? 'Could not generate', 'error');
    }
  };

  const runFestivalBlast = async (channel: 'email' | 'whatsapp') => {
    if (!window.confirm(`Send ${FESTIVAL_LABELS[festivalKey] || festivalKey} wishes to ${prospectCount} prospect(s) via ${channel}?`)) {
      return;
    }
    setBusyKey(`blast:${channel}`);
    const res = await api.post<{
      sent: number;
      manual: number;
      failed: number;
      skipped: number;
      results?: {
        customerName?: string;
        status: string;
        message: string;
        whatsappDeepLink?: string;
        cardDownloadUrl?: string;
      }[];
    }>(`/engagement/festival/${festivalKey}/blast`, { channel });
    setBusyKey(null);
    if (res.success && res.data) {
      const { sent, manual = 0, failed, skipped } = res.data;
      const parts = [
        sent ? `${sent} sent` : null,
        manual ? `${manual} ready in WhatsApp (manual)` : null,
        skipped ? `${skipped} skipped` : null,
        failed ? `${failed} failed` : null,
      ].filter(Boolean);
      pushSystemToast(`Blast done: ${parts.join(', ')}`, sent > 0 || manual > 0 ? 'success' : 'error');

      if (channel === 'whatsapp' && manual > 0 && res.data.results) {
        const manualRows = res.data.results.filter((r) => r.whatsappDeepLink);
        if (manualRows.length === 1 && manualRows[0].whatsappDeepLink) {
          const row = manualRows[0];
          if (row.cardDownloadUrl) {
            try {
              await openWhatsAppWithCardDownload(
                row.whatsappDeepLink,
                row.cardDownloadUrl,
                `festival-${(row.customerName || 'prospect').replace(/\s+/g, '-')}`
              );
            } catch {
              window.open(row.whatsappDeepLink, '_blank', 'noopener,noreferrer');
            }
          } else {
            window.open(row.whatsappDeepLink, '_blank', 'noopener,noreferrer');
          }
        } else if (manualRows.length > 1) {
          pushSystemToast(
            `${manualRows.length} cards need manual send — attach each downloaded image in WhatsApp.`,
            'success'
          );
          for (const row of manualRows.slice(0, 3)) {
            if (!row.whatsappDeepLink) continue;
            if (row.cardDownloadUrl) {
              try {
                await openWhatsAppWithCardDownload(
                  row.whatsappDeepLink,
                  row.cardDownloadUrl,
                  `festival-${(row.customerName || 'prospect').replace(/\s+/g, '-')}`
                );
              } catch {
                window.open(row.whatsappDeepLink, '_blank', 'noopener,noreferrer');
              }
            } else {
              window.open(row.whatsappDeepLink, '_blank', 'noopener,noreferrer');
            }
          }
        }
      }

      if (failed > 0 || skipped > 0) {
        const detail = res.data.results
          ?.filter((r) => r.status === 'failed' || r.status === 'skipped')
          .map((r) => `${(r as { customerName?: string }).customerName || 'Prospect'}: ${r.message}`)
          .slice(0, 3)
          .join('; ');
        if (detail) pushSystemToast(detail, 'error');
      }
      load();
    } else {
      pushSystemToast(res.error?.message ?? 'Blast failed', 'error');
    }
  };

  if (!enabled) return null;

  const anniversarySection = (
      <section className={styles.section}>
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <CalendarHeart size={22} />
          </div>
          <div>
            <h2 className={styles.title}>Project anniversaries today</h2>
            <p className={styles.subtitle}>
              First-year milestone (from project start date). Send a branded thank-you note by email or WhatsApp.
            </p>
          </div>
        </div>
        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : anniversaries.length === 0 ? (
          <p className={styles.muted}>No first anniversaries today.</p>
        ) : (
          anniversaries.map((row) => (
            <article key={row.projectId} className={styles.card}>
              <div className={styles.cardMain}>
                <div>
                  <span className={styles.name}>{row.clientName}</span>
                  <span className={styles.badge}>1 year</span>
                  <span className={styles.meta}>{row.projectName}</span>
                  {row.lastSentAt ? (
                    <span className={styles.sentTag}>
                      Sent via {row.lastSentChannel} {new Date(row.lastSentAt).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={!!busyKey}
                    onClick={() => generateAnniversary(row)}
                  >
                    <Sparkles size={16} />
                    Generate
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={!!busyKey || !row.email}
                    onClick={() => sendAnniversary(row, 'email')}
                  >
                    <Mail size={16} /> Email
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={!!busyKey || !row.phone}
                    onClick={() => sendAnniversary(row, 'whatsapp')}
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </button>
                  {row.latestCardId && row.lastSentAt ? (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      disabled={!!busyKey}
                      onClick={async () => {
                        const res = await api.patch(`/engagement/cards/${row.latestCardId}/response`, {
                          responded: true,
                        });
                        if (res.success) {
                          pushSystemToast('Marked as replied', 'success');
                          load();
                        }
                      }}
                    >
                      Mark replied
                    </button>
                  ) : null}
                </div>
              </div>
              {row.latestCardImageUrl ? (
                <div className={styles.previewWrap}>
                  <img src={row.latestCardImageUrl} alt="" className={styles.previewImg} />
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
  );

  const festivalSection = (
      <section className={styles.section}>
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <PartyPopper size={22} />
          </div>
          <div>
            <h2 className={styles.title}>Festival blast</h2>
            <p className={styles.subtitle}>
              Send NIOLLA-branded festive wishes to all active prospects ({prospectCount}).
            </p>
          </div>
        </div>
        <div className={styles.actions} style={{ marginTop: '0.5rem' }}>
          <select
            value={festivalKey}
            onChange={(e) => setFestivalKey(e.target.value)}
            className={styles.btnSecondary}
            style={{ minWidth: 160 }}
          >
            {(festivals.length ? festivals : Object.keys(FESTIVAL_LABELS)).map((k) => (
              <option key={k} value={k}>
                {FESTIVAL_LABELS[k] || k}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={!!busyKey || prospectCount === 0}
            onClick={() => runFestivalBlast('whatsapp')}
          >
            <MessageCircle size={16} />
            Blast WhatsApp
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={!!busyKey || prospectCount === 0}
            title="Prospects need email on file"
            onClick={() => runFestivalBlast('email')}
          >
            <Mail size={16} />
            Blast email
          </button>
        </div>
      </section>
  );

  const engagementSection = (
    <section className={styles.engagementPanel}>
      <div className={styles.engagementPanelHead}>
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <TrendingUp size={22} />
          </div>
          <div>
            <h2 className={styles.title}>Engagement tracking</h2>
            <p className={styles.subtitle}>
              See who engages most after birthday, anniversary, and festival messages.
            </p>
          </div>
        </div>
        <p className={styles.analyticsHint}>
          Sends are logged automatically when you use Send email / Send WhatsApp (including manual WhatsApp).
          After a client replies, click <strong>Mark replied</strong> on the birthday/anniversary row or in Recent
          sends below.
        </p>
      </div>
      <div className={styles.engagementPanelBody}>
        {loading ? (
          <p className={styles.muted}>Loading engagement data…</p>
        ) : !overview || overview.summary.totalSends === 0 ? (
          <p className={styles.engagementEmpty}>
            No sends logged yet. Send a birthday, anniversary, or festival card, then use <strong>Mark replied</strong>{' '}
            when the client responds.
          </p>
        ) : (
          <>
            <div className={styles.engagementStats}>
              <div className={styles.engagementStatCard}>
                <p className={styles.engagementStatLabel}>Total sends</p>
                <p className={styles.engagementStatValue}>{overview.summary.totalSends}</p>
              </div>
              <div className={styles.engagementStatCard}>
                <p className={styles.engagementStatLabel}>Replies marked</p>
                <p className={styles.engagementStatValue}>{overview.summary.totalReplies}</p>
              </div>
              <div className={styles.engagementStatCard}>
                <p className={styles.engagementStatLabel}>Response rate</p>
                <p className={styles.engagementStatValue}>{overview.summary.responseRate}%</p>
              </div>
              <div className={styles.engagementStatCard}>
                <p className={styles.engagementStatLabel}>Awaiting reply</p>
                <p className={styles.engagementStatValue}>{overview.summary.awaitingReply}</p>
              </div>
            </div>

            <h3 className={styles.engagementSubTitle}>Who responds best</h3>
            <div className={styles.engagementTableWrap}>
              <table className={styles.engagementTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Sends</th>
                    <th>Replies</th>
                    <th>Rate</th>
                    <th>Campaigns</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.leaderboard.map((s) => (
                    <tr key={`${s.subjectType}:${s.subjectId}`}>
                      <td className="font-medium">{s.personName}</td>
                      <td>{s.subjectType}</td>
                      <td>{s.sends}</td>
                      <td>{s.responses}</td>
                      <td className={styles.engagementRate}>{s.responseRate}%</td>
                      <td>{s.campaignTypes.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className={styles.engagementSubTitle}>Recent sends</h3>
            <div className={styles.engagementTableWrap}>
              <table className={styles.engagementTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Campaign</th>
                    <th>Channel</th>
                    <th>Sent</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {overview.recent.map((r) => (
                    <tr key={r.cardId}>
                      <td className="font-medium">{r.personName}</td>
                      <td>{r.campaignType}</td>
                      <td>{r.sentChannel ?? '—'}</td>
                      <td>{new Date(r.sentAt).toLocaleString()}</td>
                      <td>
                        {r.respondedAt ? (
                          <span className={styles.sentTag}>Replied</span>
                        ) : (
                          <span className={styles.engagementStatusAwaiting}>Awaiting</span>
                        )}
                      </td>
                      <td>
                        {!r.respondedAt ? (
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            disabled={!!busyKey}
                            onClick={async () => {
                              const res = await api.patch(`/engagement/cards/${r.cardId}/response`, {
                                responded: true,
                              });
                              if (res.success) {
                                pushSystemToast('Marked as replied', 'success');
                                load();
                              }
                            }}
                          >
                            Mark replied
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );

  return (
    <>
      <div className={styles.crmCardsRow}>
        <BirthdayTodaySection enabled />
        {anniversarySection}
        {festivalSection}
      </div>
      {engagementSection}
    </>
  );
}
