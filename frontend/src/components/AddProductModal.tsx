import { useState, useEffect } from 'react';
import { X, Package, Hash, DollarSign, List } from 'lucide-react';
import { api } from '../api/client';
import styles from './NewInquiryModal.module.css';

export interface ProductFormItem {
  _id: string;
  productId: string;
  name: string;
  code: string;
  description?: string;
  basePricing: number;
  features: string[];
  status: 'active' | 'inactive';
}

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProduct: ProductFormItem | null;
}

export default function AddProductModal({ open, onClose, onSuccess, editProduct }: AddProductModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [basePricing, setBasePricing] = useState('');
  const [featuresInput, setFeaturesInput] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editProduct?._id;

  useEffect(() => {
    if (!open) {
      setName('');
      setCode('');
      setDescription('');
      setBasePricing('');
      setFeaturesInput('');
      setStatus('active');
      setError('');
    } else if (editProduct) {
      setName(editProduct.name);
      setCode(editProduct.code);
      setDescription(editProduct.description || '');
      setBasePricing(String(editProduct.basePricing));
      setFeaturesInput((editProduct.features || []).join('\n'));
      setStatus(editProduct.status);
    }
  }, [open, editProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const features = featuresInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      code: code.trim(),
      description: description.trim() || undefined,
      basePricing: Number(basePricing) || 0,
      features,
      status,
    };

    if (isEdit) {
      const res = await api.patch<unknown>(`/products/${editProduct._id}`, payload);
      setSubmitting(false);
      if (!res.success) {
        setError(res.error?.message || 'Failed to update');
        return;
      }
    } else {
      const res = await api.post<unknown>('/products', payload);
      setSubmitting(false);
      if (!res.success) {
        setError(res.error?.message || 'Failed to create');
        return;
      }
    }
    onSuccess();
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '32rem' }}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? 'Edit Product' : 'Add Product'}</h2>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.errorBox}>
              <p>{error}</p>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="productName">
              <Package size={18} />
              Product name
            </label>
            <input
              id="productName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={styles.input}
              placeholder="e.g. NIOLLA POS"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="productCode">
              <Hash size={18} />
              Code
            </label>
            <input
              id="productCode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className={styles.input}
              placeholder="e.g. POS"
              disabled={isEdit}
            />
            {isEdit && <p className="text-xs text-gray-500 mt-1">Code cannot be changed after creation.</p>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="productDescription">Description</label>
            <textarea
              id="productDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.input}
              rows={3}
              placeholder="What this product offers"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="basePricing">
              <DollarSign size={18} />
              Base pricing (LKR)
            </label>
            <input
              id="basePricing"
              type="number"
              min={0}
              step={1}
              value={basePricing}
              onChange={(e) => setBasePricing(e.target.value)}
              required
              className={styles.input}
              placeholder="0"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="features">
              <List size={18} />
              Features (one per line)
            </label>
            <textarea
              id="features"
              value={featuresInput}
              onChange={(e) => setFeaturesInput(e.target.value)}
              className={styles.input}
              rows={4}
              placeholder={'Sales billing\nInventory\nReports'}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="productStatus">Status</label>
            <select
              id="productStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className={styles.input}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={submitting} className={styles.submitBtn}>
              {submitting ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update Product' : 'Add Product'}
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
