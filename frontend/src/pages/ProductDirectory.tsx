import { useState, useEffect } from 'react';
import { useMemo } from 'react';
import { campaignDiscountFields, computePriceBreakdown } from '../lib/campaignPricing';
import { Plus, Pencil, Trash2, Package, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import AddProductModal, { ProductFormItem } from '../components/AddProductModal';
import ProductSalesAnalytics from '../components/ProductSalesAnalytics';
import styles from './Inquiries.module.css';

interface ProductRow extends ProductFormItem {
  customerCount: number;
}

interface CampaignSummary {
  _id: string;
  name: string;
  discountType?: 'percent' | 'flat';
  discountValue?: number;
  discountPercent?: number;
  productScope: 'all' | 'specific';
  productIds?: string[];
  products?: { _id: string }[];
  isLive: boolean;
}

function campaignAppliesToProduct(c: CampaignSummary, productId: string): boolean {
  if (c.productScope === 'all') return true;
  if (c.productIds?.includes(productId)) return true;
  return c.products?.some((p) => p._id === productId) ?? false;
}

interface LiveSaleInfo {
  campaignName: string;
  discountPercent: number;
  salePrice: number;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(
    amount
  );
}

export default function ProductDirectory() {
  const { user } = useAuth();
  const showCampaigns = user?.role === 'owner' || user?.role === 'pm';
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductFormItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = async () => {
    try {
      const requests: Promise<unknown>[] = [api.get<ProductRow[]>('/products')];
      if (showCampaigns) requests.push(api.get<CampaignSummary[]>('/campaigns'));
      const results = await Promise.all(requests);
      const prodRes = results[0] as Awaited<ReturnType<typeof api.get<ProductRow[]>>>;
      if (prodRes.success && prodRes.data) setProducts(prodRes.data);
      if (showCampaigns && results[1]) {
        const campRes = results[1] as Awaited<ReturnType<typeof api.get<CampaignSummary[]>>>;
        if (campRes.success && campRes.data) setCampaigns(campRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const liveSaleByProduct = useMemo(() => {
    const map: Record<string, LiveSaleInfo> = {};
    const live = campaigns.filter((c) => c.isLive);
    for (const p of products) {
      const match = live
        .filter((c) => campaignAppliesToProduct(c, p._id))
        .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))[0];
      if (match) {
        const { discountType, discountValue } = campaignDiscountFields({
          _id: match._id,
          name: match.name,
          discountType: match.discountType ?? 'percent',
          discountValue: match.discountValue ?? match.discountPercent ?? 0,
          discountPercent: match.discountPercent,
        });
        const breakdown = computePriceBreakdown(p.basePricing, discountType, discountValue);
        map[p._id] = {
          campaignName: match.name,
          discountPercent: discountType === 'percent' ? discountValue : 0,
          salePrice: breakdown.finalPrice,
        };
      }
    }
    return map;
  }, [campaigns, products]);

  useEffect(() => {
    setLoading(true);
    load();
  }, []);

  const handleAdd = () => {
    setEditProduct(null);
    setShowModal(true);
  };

  const handleEdit = (p: ProductRow) => {
    setEditProduct(p);
    setShowModal(true);
  };

  const handleDelete = async () => {
    const id = deleteId;
    if (!id) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await api.delete(`/products/${id}`);
      if (res?.success === false) {
        setDeleteError(res.error?.message || 'Failed to delete product');
        return;
      }
      setDeleteId(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Directory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage NIOLLA software products, track sales volume per product, and view best-seller analytics.
            {showCampaigns ? (
              <>
                {' '}
                <Link to="/campaigns" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
                  <Sparkles size={14} />
                  Festival campaigns
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Product
        </button>
      </div>

      <ProductSalesAnalytics />

      {loading ? (
        <p className="text-gray-500 py-12 text-center">Loading products...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Package size={48} className="mx-auto mb-4 text-gray-300" />
          <p>No products yet. Add your first product profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
          {products.map((p) => (
            <article
              key={p._id}
              className="bg-white border border-orange-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{p.name}</h2>
                  <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded mt-1 inline-block">
                    {p.code}
                  </span>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {p.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>

              {p.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{p.description}</p>}

              <div className="mb-2">
                {liveSaleByProduct[p._id] ? (
                  <>
                    <p className="text-xs text-gray-500 line-through">{formatPrice(p.basePricing)}</p>
                    <p className="text-sm font-bold text-emerald-700">
                      {formatPrice(liveSaleByProduct[p._id].salePrice)}{' '}
                      <span className="text-xs font-semibold text-emerald-600">
                        ({liveSaleByProduct[p._id].discountPercent}% off — {liveSaleByProduct[p._id].campaignName})
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-gray-800">{formatPrice(p.basePricing)} base</p>
                )}
              </div>

              {p.features.length > 0 && (
                <ul className="text-sm text-gray-600 list-disc list-inside mb-4 flex-1 space-y-0.5">
                  {p.features.slice(0, 4).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                  {p.features.length > 4 && (
                    <li className="list-none text-gray-400">+{p.features.length - 4} more</li>
                  )}
                </ul>
              )}

              <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                <Link
                  to={`/customer?productId=${p._id}`}
                  className="text-sm font-medium text-primary hover:underline"
                  title="Licenses / setups sold"
                >
                  {p.customerCount} sold
                </Link>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(p)}
                    className="p-2 text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError('');
                      setDeleteId(p._id);
                    }}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AddProductModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditProduct(null);
        }}
        onSuccess={() => {
          setShowModal(false);
          setEditProduct(null);
          load();
        }}
        editProduct={editProduct}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Product"
        message={
          deleteError ||
          'Are you sure you want to delete this product? Products with linked customers cannot be removed.'
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
