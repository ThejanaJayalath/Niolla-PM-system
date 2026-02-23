import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, CreditCard, DollarSign, Building2, Upload, Check, Trash2 } from 'lucide-react';
import { api } from '../api/client';

interface Inquiry {
  _id: string;
  customerId?: string;
  customerName: string;
  projectDescription: string;
  requiredFeatures: string[];
  phoneNumber?: string;
}

interface BillingItemRow {
  number: string;
  description: string;
  amount: string;
}

export default function CreateBilling() {
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [searchInquiry, setSearchInquiry] = useState('');
  const [showInquiryDropdown, setShowInquiryDropdown] = useState(false);

  const [items, setItems] = useState<BillingItemRow[]>([{ number: '', description: '', amount: '' }]);
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [billingDate, setBillingDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [submitting, setSubmitting] = useState(false);
  const [templateInfo, setTemplateInfo] = useState<{ hasTemplate: boolean; fileName?: string }>({ hasTemplate: false });
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  useEffect(() => {
    loadInquiries();
    loadTemplateInfo();
  }, []);

  const loadTemplateInfo = async () => {
    const res = await api.getBillingTemplateInfo();
    if (res.success && res.data) {
      setTemplateInfo({ hasTemplate: res.data.hasTemplate, fileName: res.data.fileName });
    }
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setTemplateError('Only .docx (Word) files are allowed.');
      return;
    }
    setTemplateError(null);
    setTemplateUploading(true);
    const res = await api.uploadBillingTemplate(file);
    setTemplateUploading(false);
    if (res.success) await loadTemplateInfo();
    else setTemplateError(res.error?.message || 'Upload failed');
    e.target.value = '';
  };

  const loadInquiries = async () => {
    try {
      const res = await api.get<Inquiry[]>('/inquiries');
      if (res.success && res.data) {
        setInquiries(res.data);
        const preSelectedId = location.state?.inquiryId;
        if (preSelectedId) {
          const found = res.data.find((i) => i._id === preSelectedId);
          if (found) handleSelectInquiry(found);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectInquiry = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setSearchInquiry(inquiry.customerName);
    setShowInquiryDropdown(false);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { number: '', description: '', amount: '' }]);
  };

  const updateItem = (index: number, field: keyof BillingItemRow, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  };

  const handleSubmit = async () => {
    if (!selectedInquiry) {
      alert('Please select a customer');
      return;
    }
    const mappedItems = items
      .filter((i) => i.description.trim() || i.amount.trim())
      .map((i) => ({
        number: i.number.trim() || undefined,
        description: i.description.trim() || undefined,
        amount: parseFloat(i.amount) || 0,
      }));
    if (mappedItems.length === 0) {
      alert('Add at least one billing item with amount');
      return;
    }
    const total = calculateTotal();
    setSubmitting(true);
    try {
      const res = await api.post('/billing', {
        inquiryId: selectedInquiry._id,
        customerName: selectedInquiry.customerName,
        projectName: selectedInquiry.projectDescription ? selectedInquiry.projectDescription.slice(0, 100) : undefined,
        phoneNumber: selectedInquiry.phoneNumber,
        items: mappedItems,
        totalAmount: total,
        companyName: companyName.trim() || undefined,
        address: address.trim() || undefined,
        email: email.trim() || undefined,
        billingDate: new Date(billingDate).toISOString(),
      });
      if (res.success) {
        navigate('/billing');
      } else {
        alert(res.error?.message || 'Failed to create bill');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create bill');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInquiries = inquiries.filter(
    (inq) =>
      inq.customerName.toLowerCase().includes(searchInquiry.toLowerCase()) ||
      (inq.customerId && inq.customerId.toLowerCase().includes(searchInquiry.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex flex-col gap-4 mb-6">
          <button
            onClick={() => navigate('/billing')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors w-fit"
          >
            <ArrowLeft size={20} />
            <span className="font-medium text-lg">Back</span>
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Home</span>
            <span>&gt;</span>
            <span>Billing</span>
            <span>&gt;</span>
            <span className="font-semibold text-gray-500">Create Billing</span>
          </div>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-[2rem] font-extrabold text-gray-900 tracking-tight leading-tight">Create Billing</h1>
            <p className="text-base text-gray-500 mt-1">Create a new bill or invoice for your customer</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleUploadTemplate}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={templateUploading}
              className="bg-white border border-primary text-primary hover:bg-primary/5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Upload size={16} />
              {templateUploading ? 'Uploading...' : 'Upload Template'}
            </button>
            {templateInfo.hasTemplate && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-2">
                <Check size={18} className="shrink-0" strokeWidth={2.5} />
                Template Add successfully
              </span>
            )}
          </div>
        </div>
        {templateError && (
          <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {templateError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Bill Reference Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-primary" />
                  <h3 className="text-base font-bold text-gray-900">Bill Reference Details</h3>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowInquiryDropdown(!showInquiryDropdown)}
                    className="bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Add Customer
                  </button>
                  {showInquiryDropdown && (
                    <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-96 max-h-64 overflow-y-auto">
                      <div className="p-2 border-b border-gray-200">
                        <input
                          type="text"
                          placeholder="Search inquiries..."
                          value={searchInquiry}
                          onChange={(e) => setSearchInquiry(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-primary"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredInquiries.map((inq) => (
                          <button
                            key={inq._id}
                            onClick={() => handleSelectInquiry(inq)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                          >
                            <div className="font-medium text-gray-900">{inq.customerName}</div>
                            {inq.customerId && <div className="text-xs text-gray-500">{inq.customerId}</div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={selectedInquiry?.customerName ?? ''}
                    placeholder="Customer name"
                    disabled
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer Id</label>
                  <input
                    type="text"
                    value={selectedInquiry?.customerId ?? ''}
                    placeholder="Customer Id"
                    disabled
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea
                    value={selectedInquiry?.projectDescription ?? ''}
                    placeholder="Project description"
                    disabled
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-400 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Required Features</label>
                  <textarea
                    value={selectedInquiry?.requiredFeatures?.join(', ') ?? ''}
                    placeholder="Required features"
                    disabled
                    rows={2}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-400 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* General Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={20} className="text-primary" />
                <h3 className="text-base font-bold text-gray-900">General Details</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name (optional)</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter company name"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter address"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing Date</label>
                  <input
                    type="date"
                    value={billingDate}
                    onChange={(e) => setBillingDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Billing Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard size={20} className="text-primary" />
                <h3 className="text-base font-bold text-gray-900">Billing Information</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">Use negative amount to decrease total (e.g. -500)</p>
              <div className="space-y-3">
                {items.length > 0 && (
                  <div className="grid grid-cols-[80px_1fr_120px_40px] gap-3 text-sm font-medium text-gray-700">
                    <div>Number</div>
                    <div>Description</div>
                    <div>Amount</div>
                    <div></div>
                  </div>
                )}
                {items.map((row, index) => (
                  <div key={index} className="grid grid-cols-[80px_1fr_120px_40px] gap-3 items-center">
                    <input
                      type="text"
                      value={row.number}
                      onChange={(e) => updateItem(index, 'number', e.target.value)}
                      placeholder="No."
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      step="any"
                      value={row.amount}
                      onChange={(e) => updateItem(index, 'amount', e.target.value)}
                      placeholder="0 or -"
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30"
                      title="Remove row"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItem}
                  className="text-primary hover:text-primary-hover font-medium text-sm flex items-center gap-1"
                >
                  <Plus size={16} />
                  {items.length === 0 ? 'Add Billing Item' : 'Add another Item'}
                </button>
              </div>

              <div className="pt-6 mt-4 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-2 text-center">Total Amount</div>
                <div className="bg-white border-2 border-primary rounded-lg px-6 py-6 text-center">
                  <div className="text-3xl font-bold text-primary">
                    LKR {calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedInquiry}
                  className="w-full px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Bill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
