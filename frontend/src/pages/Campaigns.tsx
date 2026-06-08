import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarRange, Mail, MessageCircle, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { formatPromotionalBlastToast } from '../lib/promotionalBlastToast';
import { pushSystemToast } from '../lib/systemToast';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import AddCampaignModal, { CampaignFormItem } from '../components/AddCampaignModal';
import CampaignReportModal from '../components/CampaignReportModal';
import styles from './Inquiries.module.css';

interface CampaignRow extends CampaignFormItem {
  phase: 'scheduled' | 'running' | 'ended';
  isLive: boolean;
  products?: { _id: string; name: string; code: string }[];
  promotionalMessage?: string;
  promotionalBlastAt?: string;
}

interface ProductOption {
  _id: string;
  name: string;
  code: string;
}

const PHASE_LABELS: Record<CampaignRow['phase'], string> = {
  scheduled: 'Scheduled',
  running: 'Live now',
  ended: 'Ended',
};

const PHASE_CLASSES: Record<CampaignRow['phase'], string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  running: 'bg-emerald-100 text-emerald-800',
  ended: 'bg-gray-100 text-gray-600',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Campaigns() {
  const { user } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'pm';

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCampaign, setEditCampaign] = useState<CampaignFormItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [blastingId, setBlastingId] = useState<string | null>(null);
  const [reportCampaignId, setReportCampaignId] = useState<string | null>(null);
  const [reportCampaignName, setReportCampaignName] = useState<string | undefined>();

  const load = async () => {
    try {
      const [campRes, prodRes] = await Promise.all([
        api.get<CampaignRow[]>('/campaigns'),
        api.get<ProductOption[]>('/products?activeOnly=true'),
      ]);
      if (campRes.success && campRes.data) setCampaigns(campRes.data);
      if (prodRes.success && Array.isArray(prodRes.data)) setProducts(prodRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    setLoading(true);
    load();
  }, [canManage]);

  const sendBlast = async (campaignId: string, channel: 'email' | 'sms') => {
    setBlastingId(`${campaignId}:${channel}`);
    try {
      const res = await api.post<{
        sent: number;
        manual: number;
        failed: number;
        skipped: number;
        messagePreview: string;
      }>(`/campaigns/${campaignId}/promotional-blast`, { channel });
      if (res.success && res.data) {
        const toast = formatPromotionalBlastToast(res.data);
        pushSystemToast(toast.message, toast.variant);
        await load();
      } else {
        pushSystemToast(res.error?.message || 'Blast failed', 'error');
      }
    } finally {
      setBlastingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/campaigns/${deleteId}`);
      setDeleteId(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  if (!canManage) {
    return (
      <div className={styles.page}>
        <p className="text-sm text-gray-600">Festival campaigns are available to owners and project managers only.</p>
      </div>
    );
  }

  const liveCount = campaigns.filter((c) => c.isLive).length;

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="text-primary" size={26} />
            Festival Campaign Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Set start/end dates and a discount (% or LKR). Active campaigns auto-apply on proposals and invoices as
            original − discount = final price.
            {liveCount > 0 ? (
              <span className="ml-1 font-semibold text-emerald-700">{liveCount} campaign(s) live now.</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditCampaign(null);
            setShowModal(true);
          }}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          New campaign
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Manage product pricing in the{' '}
        <Link to="/products" className="text-primary font-semibold hover:underline">
          Product Directory
        </Link>
        . Active campaigns apply discounted list prices while they run. After a festival ends, open{' '}
        <strong>Campaign report</strong> to see revenue and POS/ERP sales vs the prior month.
      </p>

      {loading ? (
        <p className="text-gray-500 py-12 text-center">Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-500 border border-dashed border-gray-200 rounded-xl">
          <CalendarRange size={48} className="mx-auto mb-4 text-gray-300" />
          <p>No campaigns yet. Create your first festival or seasonal sale.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Campaign</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Duration</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Discount</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Products</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Promo message</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Status</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.campaignId}</div>
                    {c.description ? <div className="text-xs text-gray-600 mt-1 max-w-xs">{c.description}</div> : null}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                    {formatDate(c.startDate)} – {formatDate(c.endDate)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-orange-700">
                    {c.discountType === 'flat'
                      ? `LKR ${Number(c.discountValue).toLocaleString()} off`
                      : `${c.discountValue ?? c.discountPercent ?? 0}% off`}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {c.productScope === 'all' ? (
                      <span className="text-gray-900 font-medium">All products</span>
                    ) : (
                      <span>
                        {(c.products || []).map((p) => p.code).join(', ') || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 max-w-[220px]">
                    {c.promotionalMessage || '—'}
                    {c.promotionalBlastAt ? (
                      <div className="text-emerald-700 mt-1">Blast sent {formatDate(c.promotionalBlastAt)}</div>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PHASE_CLASSES[c.phase]}`}>
                        {PHASE_LABELS[c.phase]}
                      </span>
                      {c.status === 'inactive' ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Paused
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      {c.phase !== 'ended' && c.status === 'active' ? (
                        <>
                          <button
                            type="button"
                            disabled={!!blastingId}
                            onClick={() => void sendBlast(c._id, 'sms')}
                            className="p-2 text-gray-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50"
                            title="SMS / WhatsApp blast"
                          >
                            <MessageCircle size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={!!blastingId}
                            onClick={() => void sendBlast(c._id, 'email')}
                            className="p-2 text-gray-600 hover:text-blue-700 rounded-lg hover:bg-blue-50"
                            title="Email blast"
                          >
                            <Mail size={16} />
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setReportCampaignId(c._id);
                          setReportCampaignName(c.name);
                        }}
                        className="p-2 text-gray-600 hover:text-violet-700 rounded-lg hover:bg-violet-50"
                        title="Campaign performance report"
                      >
                        <BarChart3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditCampaign({
                            _id: c._id,
                            campaignId: c.campaignId,
                            name: c.name,
                            description: c.description,
                            startDate: c.startDate,
                            endDate: c.endDate,
                            discountType: c.discountType ?? 'percent',
                            discountValue: c.discountValue ?? c.discountPercent ?? 0,
                            discountPercent: c.discountPercent,
                            productScope: c.productScope,
                            productIds: c.productIds || c.products?.map((p) => p._id),
                            status: c.status,
                          });
                          setShowModal(true);
                        }}
                        className="p-2 text-gray-600 hover:text-primary rounded-lg hover:bg-orange-50"
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(c._id)}
                        className="p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CampaignReportModal
        campaignId={reportCampaignId}
        campaignName={reportCampaignName}
        onClose={() => {
          setReportCampaignId(null);
          setReportCampaignName(undefined);
        }}
      />

      <AddCampaignModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={load}
        editCampaign={editCampaign}
        products={products}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete campaign?"
        message="This promotion will be removed permanently."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={deleting}
        danger
      />
    </div>
  );
}
