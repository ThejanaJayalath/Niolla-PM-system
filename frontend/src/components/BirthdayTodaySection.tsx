import { useCallback, useEffect, useState } from 'react';
import { Cake, Mail, MessageCircle, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import { openWhatsAppWithCardDownload } from '../lib/whatsappCardSend';
import styles from './BirthdayTodaySection.module.css';

export interface BirthdayPersonRow {
  subjectType: 'customer' | 'employee' | 'inquiry';
  subjectId: string;
  name: string;
  email?: string;
  phone?: string;
  roleLabel: string;
  dateOfBirth: string;
  latestCardId?: string;
  latestCardImageUrl?: string;
  lastSentAt?: string;
  lastSentChannel?: 'email' | 'whatsapp';
}

interface CardPreview {
  cardId: string;
  imageUrl: string;
  greetingMessage: string;
  aiGenerated: boolean;
}

interface BirthdayTodaySectionProps {
  enabled: boolean;
}

export default function BirthdayTodaySection({ enabled }: BirthdayTodaySectionProps) {
  const [people, setPeople] = useState<BirthdayPersonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, CardPreview>>({});

  const load = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    api
      .get<BirthdayPersonRow[]>('/birthdays/today')
      .then((res) => {
        if (res.success && res.data) setPeople(res.data);
        else setPeople([]);
      })
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const rowKey = (p: BirthdayPersonRow) => `${p.subjectType}:${p.subjectId}`;

  const generateCard = async (p: BirthdayPersonRow) => {
    const key = `gen:${rowKey(p)}`;
    setBusyKey(key);
    const res = await api.post<CardPreview>(
      `/birthdays/${p.subjectType}/${p.subjectId}/generate-card`,
      {}
    );
    setBusyKey(null);
    if (res.success && res.data) {
      setPreviews((prev) => ({ ...prev, [rowKey(p)]: res.data! }));
      pushSystemToast(
        res.data.aiGenerated ? 'AI birthday card generated' : 'Birthday card generated',
        'success'
      );
      load();
    } else {
      pushSystemToast(res.error?.message ?? 'Could not generate card', 'error');
    }
  };

  const markReplied = async (cardId: string) => {
    const res = await api.patch(`/engagement/cards/${cardId}/response`, { responded: true });
    if (res.success) {
      pushSystemToast('Marked as replied', 'success');
      load();
    } else {
      pushSystemToast(res.error?.message ?? 'Could not update', 'error');
    }
  };

  const sendCard = async (p: BirthdayPersonRow, channel: 'email' | 'whatsapp') => {
    const key = `send:${channel}:${rowKey(p)}`;
    setBusyKey(key);
    const preview = previews[rowKey(p)];
    const res = await api.post<{
      sent: boolean;
      channel: string;
      whatsappDeepLink?: string;
      cardDownloadUrl?: string;
      message?: string;
    }>(`/birthdays/${p.subjectType}/${p.subjectId}/send`, {
      channel,
      cardId: preview?.cardId ?? p.latestCardId,
      greetingMessage: preview?.greetingMessage,
    });
    setBusyKey(null);
    if (res.success && res.data) {
      if (channel === 'whatsapp' && res.data.whatsappDeepLink && !res.data.sent) {
        const imageUrl =
          res.data.cardDownloadUrl ?? preview?.imageUrl ?? p.latestCardImageUrl;
        if (imageUrl) {
          try {
            await openWhatsAppWithCardDownload(
              res.data.whatsappDeepLink,
              imageUrl,
              `birthday-${p.name.replace(/\s+/g, '-')}`
            );
            pushSystemToast(
              res.data.message ?? 'Card saved — attach it in WhatsApp, then send',
              'success'
            );
          } catch {
            window.open(res.data.whatsappDeepLink, '_blank', 'noopener,noreferrer');
            pushSystemToast('Opened WhatsApp — download the card preview and attach it manually', 'success');
          }
        } else {
          window.open(res.data.whatsappDeepLink, '_blank', 'noopener,noreferrer');
          pushSystemToast(res.data.message ?? 'Opened WhatsApp', 'success');
        }
        load();
      } else {
        pushSystemToast(res.data.message ?? `Sent via ${channel}`, 'success');
        load();
      }
    } else {
      pushSystemToast(res.error?.message ?? 'Could not send card', 'error');
    }
  };

  if (!enabled) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Cake size={22} />
        </div>
        <div>
          <h2 className={styles.title}>Birthdays today</h2>
          <p className={styles.subtitle}>
            Clients, prospects, and team members celebrating today. Generate a branded card, then send
            by email or WhatsApp.
          </p>
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Scanning birthdays…</p>
      ) : people.length === 0 ? (
        <p className={styles.muted}>No birthdays today. Add date of birth on customers, prospects, or team profiles.</p>
      ) : (
        <div className={styles.list}>
          {people.map((p) => {
            const key = rowKey(p);
            const preview = previews[key];
            const imageUrl = preview?.imageUrl ?? p.latestCardImageUrl;
            const genBusy = busyKey === `gen:${key}`;
            const emailBusy = busyKey === `send:email:${key}`;
            const waBusy = busyKey === `send:whatsapp:${key}`;
            const canEmail = !!p.email?.trim();
            const canPhone = !!p.phone?.trim();
            const cardId = preview?.cardId ?? p.latestCardId;

            return (
              <article key={key} className={styles.card}>
                <div className={styles.cardMain}>
                  <div>
                    <span className={styles.name}>{p.name}</span>
                    <span className={styles.badge}>{p.roleLabel}</span>
                    {p.email ? <span className={styles.meta}>{p.email}</span> : null}
                    {p.phone ? <span className={styles.meta}>{p.phone}</span> : null}
                    {p.lastSentAt ? (
                      <span className={styles.sentTag}>
                        Sent via {p.lastSentChannel ?? 'channel'}{' '}
                        {new Date(p.lastSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={!!busyKey}
                      onClick={() => generateCard(p)}
                    >
                      <Sparkles size={16} />
                      {genBusy ? 'Generating…' : 'Generate card'}
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      disabled={!!busyKey || !canEmail}
                      title={!canEmail ? 'No email on file' : 'Generate card (if needed) and send by email'}
                      onClick={() => sendCard(p, 'email')}
                    >
                      <Mail size={16} />
                      {emailBusy ? 'Sending…' : 'Send email'}
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      disabled={!!busyKey || !canPhone}
                      title={!canPhone ? 'No phone on file' : 'Generate card (if needed) and send via WhatsApp'}
                      onClick={() => sendCard(p, 'whatsapp')}
                    >
                      <MessageCircle size={16} />
                      {waBusy ? 'Sending…' : 'Send WhatsApp'}
                    </button>
                    {cardId && p.lastSentAt ? (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        disabled={!!busyKey}
                        onClick={() => markReplied(cardId)}
                      >
                        Mark replied
                      </button>
                    ) : null}
                  </div>
                </div>
                {imageUrl ? (
                  <div className={styles.previewWrap}>
                    <img src={imageUrl} alt={`Birthday card for ${p.name}`} className={styles.previewImg} />
                    {preview?.aiGenerated ? (
                      <span className={styles.aiTag}>AI generated</span>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
