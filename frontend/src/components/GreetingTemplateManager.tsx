import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import styles from './BirthdayTodaySection.module.css';

type TemplateType = 'birthday' | 'anniversary' | 'festival';

interface TemplateRow {
  type: TemplateType;
  label: string;
  festivalKey?: string;
}

interface TemplateState {
  hasTemplate: boolean;
  fileName?: string;
  previewUrl?: string;
}

const ROWS: TemplateRow[] = [
  { type: 'birthday', label: 'Birthday cards' },
  { type: 'anniversary', label: 'Project anniversary cards' },
];

interface GreetingTemplateManagerProps {
  festivalKey: string;
  festivalLabel: string;
}

export default function GreetingTemplateManager({ festivalKey, festivalLabel }: GreetingTemplateManagerProps) {
  const [states, setStates] = useState<Record<string, TemplateState>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const stateKey = (type: TemplateType, fk?: string) => `${type}:${fk || 'default'}`;

  const loadOne = useCallback(async (row: TemplateRow) => {
    const key = stateKey(row.type, row.festivalKey);
    const res = await api.getGreetingTemplateInfo(row.type, row.festivalKey);
    if (res.success && res.data?.hasTemplate && !res.data.isDefault) {
      const previewUrl = await api.fetchGreetingTemplatePreview(row.type, row.festivalKey);
      setStates((prev) => ({
        ...prev,
        [key]: {
          hasTemplate: true,
          fileName: res.data!.fileName,
          previewUrl: previewUrl || undefined,
        },
      }));
    } else {
      setStates((prev) => ({
        ...prev,
        [key]: { hasTemplate: false },
      }));
    }
  }, []);

  const loadAll = useCallback(async () => {
    const festivalRow: TemplateRow = {
      type: 'festival',
      label: `Festival — ${festivalLabel}`,
      festivalKey,
    };
    await Promise.all([...ROWS, festivalRow].map((row) => loadOne(row)));
  }, [festivalKey, festivalLabel, loadOne]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const onUpload = async (row: TemplateRow, file: File | null) => {
    if (!file) return;
    const key = stateKey(row.type, row.festivalKey);
    setUploadingKey(key);
    const res = await api.uploadGreetingTemplate(row.type, file, row.festivalKey);
    setUploadingKey(null);
    if (res.success) {
      pushSystemToast(res.data?.message ?? 'Template uploaded', 'success');
      await loadOne(row);
    } else {
      pushSystemToast(res.error?.message ?? 'Upload failed', 'error');
    }
  };

  const onRemove = async (row: TemplateRow) => {
    if (!window.confirm(`Remove custom template for ${row.label}? Built-in design will be used again.`)) return;
    const key = stateKey(row.type, row.festivalKey);
    setUploadingKey(key);
    const res = await api.deleteGreetingTemplate(row.type, row.festivalKey);
    setUploadingKey(null);
    if (res.success) {
      pushSystemToast('Custom template removed', 'success');
      setStates((prev) => {
        const old = prev[key];
        if (old?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(old.previewUrl);
        return { ...prev, [key]: { hasTemplate: false } };
      });
    } else {
      pushSystemToast(res.error?.message ?? 'Could not remove', 'error');
    }
  };

  const festivalRow: TemplateRow = {
    type: 'festival',
    label: `Festival — ${festivalLabel}`,
    festivalKey,
  };
  const allRows = [...ROWS, festivalRow];

  return (
    <section className={styles.templatePanel}>
      <div className={styles.templatePanelHead}>
        <ImagePlus size={20} />
        <div>
          <h2 className={styles.templatePanelTitle}>Custom card templates</h2>
          <p className={styles.templatePanelHint}>
            Upload PNG, JPG, WEBP, or SVG designs. SVG supports placeholders:{' '}
            <code>{'{{greeting}}'}</code> (e.g. Happy Birthday, John!), <code>{'{{name}}'}</code>,{' '}
            <code>{'{{project}}'}</code>, <code>{'{{festival}}'}</code>. Image files are sent as-is; the message text
            still personalizes each send. Default cards show lines like &quot;Happy Birthday, Name!&quot; and
            &quot;Happy New Year, Name!&quot;.
          </p>
        </div>
      </div>
      <div className={styles.templateGrid}>
        {allRows.map((row) => {
          const key = stateKey(row.type, row.festivalKey);
          const st = states[key];
          const busy = uploadingKey === key;
          return (
            <div key={key} className={styles.templateCard}>
              <div className={styles.templateCardHead}>
                <span className={styles.templateCardLabel}>{row.label}</span>
                {st?.hasTemplate ? (
                  <span className={styles.templateBadge}>Custom</span>
                ) : (
                  <span className={styles.templateBadgeMuted}>Default design</span>
                )}
              </div>
              {st?.previewUrl ? (
                <div className={styles.templatePreviewWrap}>
                  <img src={st.previewUrl} alt="" className={styles.templatePreviewImg} />
                </div>
              ) : null}
              {st?.fileName ? <p className={styles.templateFileName}>{st.fileName}</p> : null}
              <div className={styles.templateActions}>
                <label className={`${styles.btnSecondary} ${styles.templateUploadLabel}`}>
                  <Upload size={14} />
                  {busy ? 'Uploading…' : st?.hasTemplate ? 'Replace' : 'Upload template'}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    className={styles.hiddenFileInput}
                    disabled={!!uploadingKey}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      void onUpload(row, f ?? null);
                      e.target.value = '';
                    }}
                  />
                </label>
                {st?.hasTemplate ? (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={!!uploadingKey}
                    onClick={() => void onRemove(row)}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
