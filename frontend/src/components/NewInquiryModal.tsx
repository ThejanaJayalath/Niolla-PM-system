
import { useState, useRef, useEffect } from 'react';
import { X, User, Phone, FileText, Calendar } from 'lucide-react';
import { api } from '../api/client';

interface FormState {
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  requiredFeatures: string[];
  internalNotes: string;
}

interface NewInquiryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewInquiryModal({ open, onClose, onSuccess }: NewInquiryModalProps) {
  const featureInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>({
    customerName: '',
    phoneNumber: '',
    projectDescription: '',
    requiredFeatures: [],
    internalNotes: '',
  });
  const [featureInput, setFeatureInput] = useState('');
  const [duplicateAlert, setDuplicateAlert] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({
        customerName: '',
        phoneNumber: '',
        projectDescription: '',
        requiredFeatures: [],
        internalNotes: '',
      });
      setFeatureInput('');
      setDuplicateAlert(false);
      setError('');
    }
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'phoneNumber') setDuplicateAlert(false);
  };

  const addFeature = () => {
    const val = featureInput.trim();
    if (val && !form.requiredFeatures.includes(val)) {
      setForm((prev) => ({ ...prev, requiredFeatures: [...prev.requiredFeatures, val] }));
      setFeatureInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeature();
    }
  };

  const removeFeature = (index: number) => {
    setForm((prev) => ({
      ...prev,
      requiredFeatures: prev.requiredFeatures.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = {
      customerName: form.customerName,
      phoneNumber: form.phoneNumber,
      projectDescription: form.projectDescription,
      requiredFeatures: form.requiredFeatures,
      internalNotes: form.internalNotes,
    };
    const res = await api.post<unknown>('/inquiries', payload);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error?.message || 'Failed to save');
      return;
    }
    // @ts-ignore
    if (res.meta?.duplicatePhone) {
      setDuplicateAlert(true);
      return;
    }
    onSuccess();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-primary px-6 py-4 flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">Add Inquiries</h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-red-500 text-sm">{error}</div>}
          {duplicateAlert && <div className="text-amber-600 text-sm bg-amber-50 p-2 rounded">Phone number already exists.</div>}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                name="customerName"
                value={form.customerName}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-gray-400"
                placeholder="Enter Customer Name"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                name="phoneNumber"
                value={form.phoneNumber}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-gray-400"
                placeholder="Enter Serial Number" // Matching the image placeholder exactly, though it says Phone Number
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">Description</label>
            <textarea
              name="projectDescription"
              value={form.projectDescription}
              onChange={handleChange}
              required
              rows={3}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-gray-400 resize-none"
              placeholder="Add Description"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText size={16} className="text-primary" /> Features
            </label>
            <div className="flex gap-2">
              <input
                ref={featureInputRef}
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-gray-400"
                placeholder="Add required features"
              />
              <button
                type="button"
                onClick={addFeature}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                Add
              </button>
            </div>
            {form.requiredFeatures.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.requiredFeatures.map((f, i) => (
                  <span key={i} className="bg-orange-50 text-orange-700 px-2 py-1 rounded text-xs flex items-center gap-1 border border-orange-100">
                    {f}
                    <button type="button" onClick={() => removeFeature(i)} className="hover:text-orange-900"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar size={16} className="text-primary" /> Notes
            </label>
            <input
              name="internalNotes"
              value={form.internalNotes}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-gray-400"
              placeholder="Pick a date"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-orange-200 transition-all active:scale-[0.98]"
            >
              {submitting ? 'Creating...' : 'Crete Inquiries'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
