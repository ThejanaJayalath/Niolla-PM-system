import { useEffect, useState } from 'react';
import { Calendar, Banknote, Percent, Tag, X } from 'lucide-react';
import { api } from '../api/client';
import { formatPromotionalBlastToast } from '../lib/promotionalBlastToast';
import { pushSystemToast } from '../lib/systemToast';
import type { DiscountType } from '../lib/campaignPricing';
import styles from './NewInquiryModal.module.css';

export interface CampaignFormItem {
  _id: string;
  campaignId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  discountType: DiscountType;
  discountValue: number;
  discountPercent?: number;
  productScope: 'all' | 'specific';
  productIds?: string[];
  status: 'active' | 'inactive';
}

interface ProductOption {
  _id: string;
  name: string;
  code: string;
}

interface AddCampaignModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editCampaign: CampaignFormItem | null;
  products: ProductOption[];
}

function toDateInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default function AddCampaignModal({
  open,
  onClose,
  onSuccess,
  editCampaign,
  products,
}: AddCampaignModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [productScope, setProductScope] = useState<'all' | 'specific'>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [sendBlast, setSendBlast] = useState(false);
  const [blastChannel, setBlastChannel] = useState<'email' | 'sms'>('sms');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editCampaign?._id;

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setDiscountType('percent');
      setDiscountValue('10');
      setProductScope('all');
      setSelectedProductIds([]);
      setStatus('active');
      setSendBlast(false);
      setBlastChannel('sms');
      setError('');
    } else if (editCampaign) {
      setName(editCampaign.name);
      setDescription(editCampaign.description || '');
      setStartDate(toDateInput(editCampaign.startDate));
      setEndDate(toDateInput(editCampaign.endDate));
      const type = editCampaign.discountType ?? 'percent';
      setDiscountType(type);
      setDiscountValue(
        String(
          editCampaign.discountValue ??
            (type === 'percent' ? editCampaign.discountPercent ?? 0 : 0)
        )
      );
      setProductScope(editCampaign.productScope);
      setSelectedProductIds(editCampaign.productIds || []);
      setStatus(editCampaign.status);
    }
  }, [open, editCampaign]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (productScope === 'specific' && selectedProductIds.length === 0) {
      setError('Select at least one product, or choose “All products”.');
      return;
    }

    const value = Number(discountValue);
    if (Number.isNaN(value) || value < 0) {
      setError('Enter a valid discount value.');
      return;
    }
    if (discountType === 'percent' && value > 100) {
      setError('Percentage discount cannot exceed 100%.');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      startDate,
      endDate,
      discountType,
      discountValue: value,
      productScope,
      productIds: productScope === 'specific' ? selectedProductIds : [],
      status,
      ...(!isEdit && sendBlast
        ? { sendPromotionalBlast: true, promotionalChannel: blastChannel }
        : {}),
    };

    const res = isEdit
      ? await api.patch<unknown>(`/campaigns/${editCampaign._id}`, payload)
      : await api.post<{ campaign: unknown; promotionalBlast?: { sent: number; manual: number; failed: number; skipped: number; messagePreview: string } }>(
          '/campaigns',
          payload
        );

    setSubmitting(false);
    if (!res.success) {
      setError(res.error?.message || 'Failed to save campaign');
      return;
    }
    if (!isEdit && sendBlast && res.data?.promotionalBlast) {
      const toast = formatPromotionalBlastToast(res.data.promotionalBlast);
      pushSystemToast(toast.message, toast.variant);
    }
    onSuccess();
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '36rem' }}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? 'Edit campaign' : 'New festival campaign'}</h2>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error ? (
            <div className={styles.errorBox}>
              <p>{error}</p>
            </div>
          ) : null}

          <div className={styles.formGroup}>
            <label htmlFor="campaignName">
              <Tag size={16} />
              Campaign name
            </label>
            <input
              id="campaignName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Year Bonanza"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="campaignDescription">Description (optional)</label>
            <textarea
              id="campaignDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={styles.input}
              placeholder="Internal notes about this promotion"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={styles.formGroup}>
              <label htmlFor="campaignStart">
                <Calendar size={16} />
                Start date
              </label>
              <input
                id="campaignStart"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="campaignEnd">End date</label>
              <input
                id="campaignEnd"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate || undefined}
                className={styles.input}
              />
            </div>
          </div>

          <fieldset className="border-0 p-0 m-0">
            <legend className="text-sm font-semibold text-gray-800 mb-1">Discount application</legend>
            <p className="text-xs text-gray-500 mb-2">
              Percentage deducts a % from the total; flat amount deducts a fixed LKR value. Proposals and invoices
              show original price − discount = final payable while the campaign is active.
            </p>
            <div className="flex flex-col gap-2 mb-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === 'percent'}
                  onChange={() => setDiscountType('percent')}
                />
                <Percent size={14} />
                Percentage (% OFF)
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === 'flat'}
                  onChange={() => setDiscountType('flat')}
                />
                <Banknote size={14} />
                Flat amount (LKR OFF)
              </label>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="campaignDiscountValue">
                {discountType === 'percent' ? 'Discount (%)' : 'Discount (LKR)'}
              </label>
              <input
                id="campaignDiscountValue"
                type="number"
                min={0}
                max={discountType === 'percent' ? 100 : undefined}
                step={discountType === 'percent' ? 0.5 : 1}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                required
                className={styles.input}
                placeholder={discountType === 'percent' ? 'e.g. 15' : 'e.g. 5000'}
              />
            </div>
          </fieldset>

          <fieldset className="border-0 p-0 m-0">
            <legend className="text-sm font-semibold text-gray-800 mb-2">Product selection</legend>
            <div className="flex flex-col gap-2 mb-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="productScope"
                  checked={productScope === 'all'}
                  onChange={() => setProductScope('all')}
                />
                All products
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="productScope"
                  checked={productScope === 'specific'}
                  onChange={() => setProductScope('specific')}
                />
                Specific products only
              </label>
            </div>
            {productScope === 'specific' ? (
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                {products.length === 0 ? (
                  <p className="text-sm text-gray-500">No products in directory.</p>
                ) : (
                  products.map((p) => (
                    <label
                      key={p._id}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border cursor-pointer ${
                        selectedProductIds.includes(p._id)
                          ? 'bg-orange-100 border-orange-300 text-orange-900'
                          : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selectedProductIds.includes(p._id)}
                        onChange={() => toggleProduct(p._id)}
                      />
                      {p.name} ({p.code})
                    </label>
                  ))
                )}
              </div>
            ) : null}
          </fieldset>

          {!isEdit ? (
            <fieldset className="border border-orange-100 rounded-lg p-3 bg-orange-50/50">
              <legend className="text-sm font-semibold text-gray-800 px-1">Marketing integration</legend>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={sendBlast}
                  onChange={(e) => setSendBlast(e.target.checked)}
                />
                Send promotional blast to open prospects after creating
              </label>
              {sendBlast ? (
                <div className={styles.formGroup}>
                  <label htmlFor="blastChannel">Channel</label>
                  <select
                    id="blastChannel"
                    value={blastChannel}
                    onChange={(e) => setBlastChannel(e.target.value as 'email' | 'sms')}
                    className={styles.input}
                  >
                    <option value="sms">SMS / WhatsApp (phone numbers)</option>
                    <option value="email">Email (prospects with email only)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Example: &quot;Avurudu Special! Get 20% off on NIOLLA ERP. Valid till …&quot;
                  </p>
                </div>
              ) : null}
            </fieldset>
          ) : null}

          <div className={styles.formGroup}>
            <label htmlFor="campaignStatus">Status</label>
            <select
              id="campaignStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className={styles.input}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive (paused)</option>
            </select>
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={submitting} className={styles.submitBtn}>
              {submitting ? 'Saving…' : isEdit ? 'Update campaign' : 'Create campaign'}
            </button>
            <button type="button" onClick={onClose} disabled={submitting} className={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
