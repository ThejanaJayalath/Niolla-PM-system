import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Building2, CreditCard, Trash2, Edit3, Plus, Download, Send, Copy, X } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './ProposalDetail.module.css';

interface BillingItem {
  number?: string;
  description?: string;
  amount: number;
}

interface Billing {
  _id: string;
  billingId: string;
  inquiryId?: string;
  customerName: string;
  projectName?: string;
  phoneNumber?: string;
  items: BillingItem[];
  subTotal?: number;
  advanceApplied?: number;
  totalAmount: number;
  billingType?: 'NORMAL' | 'ADVANCE' | 'FINAL';
  companyName?: string;
  address?: string;
  email?: string;
  billingDate: string;
  createdAt: string;
  updatedAt: string;
}

interface ItemRow {
  number: string;
  description: string;
  amount: string;
}

interface SystemInvoice {
  _id: string;
  invoiceNumber: string;
  sourceType?: 'PAYMENT' | 'PROPOSAL_ADVANCE';
  status: string;
}

interface NotifyCustomerResponse {
  pdfUrl: string;
  queuedEmail: boolean;
  queuedSms: boolean;
  invoice: SystemInvoice & { invoiceNumber: string };
}

export default function BillingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [linkedInvoice, setLinkedInvoice] = useState<SystemInvoice | null>(null);
  const [loadingLinkedInvoice, setLoadingLinkedInvoice] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyModal, setNotifyModal] = useState<{
    pdfUrl: string;
    invoiceNumber: string;
    queuedEmail: boolean;
    queuedSms: boolean;
  } | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [billingDate, setBillingDate] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [applyAdvance, setApplyAdvance] = useState(false);
  const [advanceApplyAmount, setAdvanceApplyAmount] = useState('');
  const [remainingAdvance, setRemainingAdvance] = useState(0);

  useEffect(() => {
    loadBilling();
  }, [id]);

  const inquiryId = billing?.inquiryId && typeof billing.inquiryId === 'object' && '_id' in billing.inquiryId
    ? (billing.inquiryId as { _id: string })._id
    : typeof billing?.inquiryId === 'string'
      ? billing.inquiryId
      : undefined;

  useEffect(() => {
    if (!inquiryId || !isEditing) {
      setRemainingAdvance(0);
      return;
    }
    (async () => {
      const res = await api.get<{ remainingAdvance: number }>(`/billing/remaining-advance?inquiryId=${inquiryId}`);
      if (res.success && res.data) setRemainingAdvance(res.data.remainingAdvance ?? 0);
      else setRemainingAdvance(0);
    })();
  }, [inquiryId, isEditing]);

  useEffect(() => {
    if (!inquiryId) {
      setLinkedInvoice(null);
      return;
    }
    let cancelled = false;
    setLoadingLinkedInvoice(true);
    (async () => {
      try {
        const res = await api.get<SystemInvoice[]>(`/invoices?inquiryId=${inquiryId}`);
        if (cancelled) return;
        const list = res.success && res.data ? res.data : [];
        const pick =
          list.find((i) => i.sourceType === 'PROPOSAL_ADVANCE') || (list.length > 0 ? list[0] : null);
        setLinkedInvoice(pick);
      } catch {
        if (!cancelled) setLinkedInvoice(null);
      } finally {
        if (!cancelled) setLoadingLinkedInvoice(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inquiryId]);

  const loadBilling = async () => {
    if (!id) return;
    try {
      const res = await api.get<Billing>(`/billing/${id}`);
      if (res.success && res.data) {
        setBilling(res.data);
        initializeForm(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const initializeForm = (data: Billing) => {
    setCompanyName(data.companyName || '');
    setAddress(data.address || '');
    setEmail(data.email || '');
    setBillingDate(data.billingDate ? new Date(data.billingDate).toISOString().slice(0, 10) : '');
    setItems(
      data.items && data.items.length > 0
        ? data.items.map((i) => ({
            number: i.number || '',
            description: i.description || '',
            amount: i.amount?.toString() || '',
          }))
        : [{ number: '', description: '', amount: '' }]
    );
    setApplyAdvance((data.advanceApplied ?? 0) > 0);
    setAdvanceApplyAmount((data.advanceApplied ?? 0) > 0 ? String(data.advanceApplied) : '');
  };

  const calculateSubTotal = () => {
    return items.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  };

  const subTotalEdit = calculateSubTotal();
  const rawApply = parseFloat(advanceApplyAmount);
  const defaultApply = Math.min(remainingAdvance, subTotalEdit);
  const advanceAppliedEdit =
    applyAdvance && inquiryId
      ? Math.max(0, Math.min(remainingAdvance, subTotalEdit, Number.isFinite(rawApply) ? rawApply : defaultApply))
      : 0;
  const totalEdit = Math.max(0, subTotalEdit - advanceAppliedEdit);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const mappedItems = items
        .filter((i) => i.description.trim() || rowHasAmount(i))
        .map((i) => ({
          number: i.number.trim() || undefined,
          description: i.description.trim() || undefined,
          amount: parseFloat(i.amount) || 0,
        }));
      const subTotal = mappedItems.length > 0 ? mappedItems.reduce((s, i) => s + i.amount, 0) : (billing?.subTotal ?? 0);
      const advanceApplied = applyAdvance ? advanceAppliedEdit : 0;
      const totalAmount = Math.max(0, subTotal - advanceApplied);

      const res = await api.patch<Billing>(`/billing/${id}`, {
        companyName: companyName.trim() || undefined,
        address: address.trim() || undefined,
        email: email.trim() || undefined,
        billingDate: billingDate ? new Date(billingDate).toISOString() : undefined,
        items: mappedItems.length > 0 ? mappedItems : undefined,
        subTotal,
        advanceApplied,
        totalAmount,
      });

      if (res.success && res.data) {
        setBilling(res.data);
        setIsEditing(false);
        initializeForm(res.data);
      } else {
        pushSystemToast('Failed to update billing', 'error');
      }
    } catch (err) {
      console.error(err);
      pushSystemToast('Failed to update billing', 'error');
    } finally {
      setSaving(false);
    }
  };

  function rowHasAmount(row: ItemRow): boolean {
    return row.amount !== '' && !Number.isNaN(parseFloat(row.amount));
  }

  const handleDelete = () => setShowDeleteConfirm(true);

  const confirmDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.delete(`/billing/${id}`);
      navigate('/billing');
    } catch (err) {
      console.error(err);
      pushSystemToast('Failed to delete billing', 'error');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const updateItem = (index: number, field: keyof ItemRow, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { number: '', description: '', amount: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const downloadPdf = async () => {
    if (!id || !billing) return;
    setDownloading(true);
    try {
      await api.download(
        `/billing/${id}/pdf`,
        `invoice-${billing.customerName.replace(/\s+/g, '-')}.pdf`
      );
    } catch (err) {
      console.error('Download failed', err);
      pushSystemToast(err instanceof Error ? err.message : 'Failed to download invoice', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleSendInvoiceToCustomer = async () => {
    if (!linkedInvoice) return;
    setNotifying(true);
    try {
      const res = await api.post<NotifyCustomerResponse>(`/invoices/${linkedInvoice._id}/notify-customer`, {});
      if (res.success && res.data) {
        setNotifyModal({
          pdfUrl: res.data.pdfUrl,
          invoiceNumber: res.data.invoice.invoiceNumber,
          queuedEmail: res.data.queuedEmail,
          queuedSms: res.data.queuedSms,
        });
        const channels = [res.data.queuedEmail && 'email', res.data.queuedSms && 'SMS'].filter(Boolean).join(' & ');
        pushSystemToast(
          channels ? `Notification queued (${channels}) with PDF download link.` : 'Notification queued.',
          'success'
        );
      } else {
        pushSystemToast(res.error?.message || 'Could not queue notification.', 'error');
      }
    } catch (err) {
      console.error(err);
      pushSystemToast(err instanceof Error ? err.message : 'Could not queue notification.', 'error');
    } finally {
      setNotifying(false);
    }
  };

  const copyPdfLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      pushSystemToast('Download link copied.', 'success');
    } catch {
      pushSystemToast('Could not copy link.', 'warning');
    }
  };

  if (loading) return <div className={styles.container}>Loading...</div>;
  if (!billing) return <div className={styles.container}>Billing not found</div>;

  const displayItems = isEditing ? items : billing.items;
  const displaySubTotal = isEditing
    ? subTotalEdit
    : (billing.subTotal ?? (billing.items?.length ? billing.items.reduce((s, i) => s + Number(i.amount), 0) : 0));
  const displayAdvanceApplied = isEditing ? advanceAppliedEdit : (billing.advanceApplied ?? 0);
  const displayTotal = isEditing ? totalEdit : billing.totalAmount;
  const hasNoItems = !isEditing && (!billing.items || billing.items.length === 0) && billing.billingType !== 'ADVANCE';

  return (
    <div className={styles.container}>
      <div className="flex flex-col gap-4 mb-6">
        <Link to="/billing" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors w-fit">
          <ArrowLeft size={20} />
          <span className="font-medium text-lg">Back</span>
        </Link>
        <div className={styles.breadcrumb}>
          <span>Home</span> &gt; <span>Billing</span> &gt; <span className="font-semibold">Billing Details</span>
        </div>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{billing.customerName}</h1>
          <p className={styles.subTitle}>
            {billing.billingId} • Billing Details
          </p>
        </div>
        <div className={styles.headerActions}>
          {inquiryId && linkedInvoice ? (
            <button
              type="button"
              onClick={handleSendInvoiceToCustomer}
              disabled={notifying || loadingLinkedInvoice}
              className={styles.sendNotifyBtn}
              title={`Email & SMS: ${linkedInvoice.invoiceNumber} with secure PDF link`}
            >
              <Send size={16} />
              {notifying ? 'Sending...' : 'Send invoice link'}
            </button>
          ) : null}
          {inquiryId && !loadingLinkedInvoice && !linkedInvoice ? (
            <span className="text-sm text-gray-500 max-w-xs text-right">
              No linked system invoice for this inquiry.{' '}
              <Link to="/invoices" className="text-primary font-medium underline">
                Open Invoices
              </Link>
            </span>
          ) : null}
          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading}
            className={styles.downloadBtn}
            title="Download invoice as PDF"
          >
            <Download size={16} />
            {downloading ? 'Downloading...' : 'Download PDF'}
          </button>
          <button onClick={handleDelete} className={styles.deleteBtn}>
            <Trash2 size={16} /> Delete Billing
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.mainCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Billing Details</h2>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <button onClick={handleSave} disabled={saving} className={styles.saveBtn}>
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <button onClick={() => setIsEditing(true)} className={styles.editBtn}>
                  <Edit3 size={16} /> Edit Billing
                </button>
              )}
            </div>
          </div>

          <div className={styles.contentGrid}>
            <div className={styles.leftColumn}>
              {/* Bill Reference Details */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <FileText size={18} />
                  <h3>Bill Reference Details</h3>
                </div>
                <div className={styles.formGroup}>
                  <label>Name</label>
                  <input type="text" value={billing.customerName} readOnly className={styles.inputReadonly} />
                </div>
                <div className={styles.formGroup}>
                  <label>Customer Id</label>
                  <input
                    type="text"
                    value={
                      billing.inquiryId && typeof billing.inquiryId === 'object' && 'customerId' in billing.inquiryId
                        ? (billing.inquiryId as { customerId: string }).customerId
                        : billing.inquiryId && typeof billing.inquiryId === 'object' && '_id' in billing.inquiryId
                          ? (billing.inquiryId as { _id: string })._id
                          : (billing.inquiryId ?? '')
                    }
                    readOnly
                    className={styles.inputReadonly}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Description</label>
                  <textarea
                    value={billing.projectName || ''}
                    readOnly
                    className={styles.inputReadonly}
                    rows={4}
                  />
                </div>
              </div>

              {/* General Details */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <Building2 size={18} />
                  <h3>General Details</h3>
                </div>
                <div className={styles.formGroup}>
                  <label>Company Name (optional)</label>
                  <input
                    type="text"
                    value={isEditing ? companyName : (billing.companyName || '')}
                    onChange={(e) => setCompanyName(e.target.value)}
                    readOnly={!isEditing}
                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Address</label>
                  <input
                    type="text"
                    value={isEditing ? address : (billing.address || '')}
                    onChange={(e) => setAddress(e.target.value)}
                    readOnly={!isEditing}
                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="text"
                    value={isEditing ? email : (billing.email || '')}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={!isEditing}
                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Billing Date</label>
                  <input
                    type="date"
                    value={isEditing ? billingDate : (billing.billingDate ? new Date(billing.billingDate).toISOString().slice(0, 10) : '')}
                    onChange={(e) => setBillingDate(e.target.value)}
                    readOnly={!isEditing}
                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                  />
                </div>
              </div>
            </div>

            <div className={styles.rightColumn}>
              {/* Billing Information */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <CreditCard size={18} />
                  <h3>Billing Information</h3>
                </div>
                {billing.billingType === 'ADVANCE' && !isEditing && (
                  <div className={styles.formGroup}>
                    <div className={styles.summaryRow}>
                      <span>Advance amount</span>
                      <span>LKR {billing.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
                {(billing.billingType !== 'ADVANCE' || isEditing) && (
                <div className={styles.formGroup}>
                  <table className={styles.milestonesTable}>
                    <thead>
                      <tr>
                        <th>Number</th>
                        <th>Description</th>
                        <th>Amount</th>
                        {isEditing && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {hasNoItems ? (
                        <tr>
                          <td colSpan={isEditing ? 4 : 3} className="text-gray-400 italic text-sm py-4">
                            No billing items
                          </td>
                        </tr>
                      ) : (
                      displayItems.map((item, index) => (
                        <tr key={index}>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={items[index]?.number ?? ''}
                                onChange={(e) => updateItem(index, 'number', e.target.value)}
                                className={styles.milestoneInput}
                                placeholder="No."
                              />
                            ) : (
                              <input
                                type="text"
                                value={item.number || ''}
                                readOnly
                                className={styles.milestoneInputReadonly}
                              />
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={items[index]?.description ?? ''}
                                onChange={(e) => updateItem(index, 'description', e.target.value)}
                                className={styles.milestoneInput}
                                placeholder="Description"
                              />
                            ) : (
                              <input
                                type="text"
                                value={item.description || ''}
                                readOnly
                                className={styles.milestoneInputReadonly}
                              />
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={items[index]?.amount ?? ''}
                                onChange={(e) => updateItem(index, 'amount', e.target.value)}
                                className={styles.milestoneInput}
                                placeholder="Amount"
                              />
                            ) : (
                              <input
                                type="text"
                                value={`Rs. ${(typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0).toLocaleString()}`}
                                readOnly
                                className={styles.milestoneInputReadonly}
                              />
                            )}
                          </td>
                          {isEditing && (
                            <td>
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                disabled={items.length <= 1}
                                className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30"
                              >
                                Remove
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                      )}
                    </tbody>
                  </table>
                  {isEditing && (
                    <button type="button" onClick={addItem} className={styles.addMilestoneBtn}>
                      <Plus size={16} />
                      Add another Item
                    </button>
                  )}
                </div>
                )}

                {billing.billingType !== 'ADVANCE' && (
                  <>
                    <div className={styles.summaryRow}>
                      <span>Sub Total</span>
                      <span>LKR {displaySubTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {isEditing && inquiryId && (remainingAdvance > 0 || applyAdvance) && (
                      <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={applyAdvance}
                            onChange={(e) => {
                              setApplyAdvance(e.target.checked);
                              if (e.target.checked && advanceApplyAmount === '') {
                                setAdvanceApplyAmount(String(Math.min(remainingAdvance, subTotalEdit)));
                              }
                            }}
                          />
                          Apply Advance Payment
                        </label>
                        {applyAdvance && (
                          <>
                            <div className={styles.advanceRemaining}>
                              Remaining Advance: LKR {remainingAdvance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                            <div className={styles.formGroup}>
                              <label>Apply amount (LKR)</label>
                              <input
                                type="number"
                                min="0"
                                max={Math.min(remainingAdvance, subTotalEdit)}
                                step="any"
                                value={advanceApplyAmount}
                                onChange={(e) => setAdvanceApplyAmount(e.target.value)}
                                className={styles.milestoneInput}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {displayAdvanceApplied > 0 && (
                      <div className={styles.summaryRow}>
                        <span>− Advance applied</span>
                        <span>LKR {displayAdvanceApplied.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </>
                )}

                <div className={styles.totalCostContainer}>
                  <div className={styles.totalCostLabel}>Total Amount</div>
                  <div className={styles.totalCostDisplay}>
                    <div className={styles.totalCostAmount}>
                      LKR {displayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Billing"
        message="Are you sure you want to delete this billing record? This action cannot be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        danger
      />

      {notifyModal ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="billing-notify-modal-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-orange-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 id="billing-notify-modal-title" className="text-lg font-semibold text-gray-900">
                Invoice link sent
              </h2>
              <button
                type="button"
                onClick={() => setNotifyModal(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-800">{notifyModal.invoiceNumber}</span>
                {' — '}
                Queued{' '}
                {notifyModal.queuedEmail && notifyModal.queuedSms
                  ? 'email and SMS'
                  : notifyModal.queuedEmail
                    ? 'email'
                    : 'SMS'}{' '}
                with the secure PDF link.
              </p>
              <div>
                <span className="block text-xs font-medium text-gray-500 mb-1">Public download link</span>
                <div className="flex gap-2">
                  <input
                    readOnly
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 font-mono"
                    value={notifyModal.pdfUrl}
                  />
                  <button
                    type="button"
                    onClick={() => copyPdfLink(notifyModal.pdfUrl)}
                    className="shrink-0 px-3 py-2 bg-primary text-white rounded-lg hover:opacity-90 flex items-center gap-1.5 text-xs font-medium"
                  >
                    <Copy size={14} />
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setNotifyModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
