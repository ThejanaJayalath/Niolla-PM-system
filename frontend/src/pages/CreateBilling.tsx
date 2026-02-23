import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, CreditCard, Building2, Upload, Check, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import styles from './CreateBilling.module.css';

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
    <div className={styles.container}>
      {/* Back & Breadcrumb - same as Proposal Details */}
      <div className="flex flex-col gap-4 mb-6">
        <Link to="/billing" className={styles.backLink}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </Link>
        <div className={styles.breadcrumb}>
          <span>Home</span> &gt; <span>Billing</span> &gt; <span className="font-semibold">Create Billing</span>
        </div>
      </div>

      {/* Header - same structure as Proposal Details */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Create Billing</h1>
          <p className={styles.subTitle}>Create a new bill or invoice for your customer</p>
        </div>
        <div className={styles.headerActions}>
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
            className={styles.uploadBtn}
          >
            <Upload size={16} />
            {templateUploading ? 'Uploading...' : 'Upload Template'}
          </button>
          {templateInfo.hasTemplate && (
            <span className={styles.templateSuccess}>
              <Check size={18} strokeWidth={2.5} />
              Template Add successfully
            </span>
          )}
        </div>
      </div>

      {templateError && <div className={styles.templateError}>{templateError}</div>}

      <div className={styles.grid}>
        <div className={styles.mainCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Billing Details</h2>
          </div>

          <div className={styles.contentGrid}>
            {/* Left Column */}
            <div className={styles.leftColumn}>
              {/* Bill Reference Details */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeaderRow}>
                  <div className={styles.sectionHeader}>
                    <FileText size={18} />
                    <h3>Bill Reference Details</h3>
                  </div>
                  <div className={styles.sectionHeaderActions}>
                    <button
                    type="button"
                    onClick={() => setShowInquiryDropdown(!showInquiryDropdown)}
                    className={styles.addCustomerBtn}
                  >
                    <Plus size={16} />
                    Add Customer
                  </button>
                  {showInquiryDropdown && (
                    <div className={styles.dropdown}>
                      <div className={styles.dropdownSearch}>
                        <input
                          type="text"
                          placeholder="Search inquiries..."
                          value={searchInquiry}
                          onChange={(e) => setSearchInquiry(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className={styles.dropdownList}>
                        {filteredInquiries.map((inq) => (
                          <button
                            key={inq._id}
                            type="button"
                            onClick={() => handleSelectInquiry(inq)}
                            className={styles.dropdownItem}
                          >
                            <div className={styles.dropdownItemName}>{inq.customerName}</div>
                            {inq.customerId && <div className={styles.dropdownItemId}>{inq.customerId}</div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Name</label>
                  <input
                    type="text"
                    value={selectedInquiry?.customerName ?? ''}
                    placeholder="Customer name"
                    readOnly
                    className={styles.inputReadonly}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Customer Id</label>
                  <input
                    type="text"
                    value={selectedInquiry?.customerId ?? ''}
                    placeholder="Customer Id"
                    readOnly
                    className={styles.inputReadonly}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Description</label>
                  <textarea
                    value={selectedInquiry?.projectDescription ?? ''}
                    placeholder="Project description"
                    readOnly
                    rows={4}
                    className={styles.inputReadonly}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Required Features</label>
                  <textarea
                    value={selectedInquiry?.requiredFeatures?.join(', ') ?? ''}
                    placeholder="Required features"
                    readOnly
                    rows={2}
                    className={styles.inputReadonly}
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
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter company name"
                    className={styles.inputParam}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter address"
                    className={styles.inputParam}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email"
                    className={styles.inputParam}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Billing Date</label>
                  <input
                    type="date"
                    value={billingDate}
                    onChange={(e) => setBillingDate(e.target.value)}
                    className={styles.inputParam}
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Billing Information */}
            <div className={styles.rightColumn}>
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <CreditCard size={18} />
                  <h3>Billing Information</h3>
                </div>
                <p className={styles.itemsHint}>Use negative amount to decrease total (e.g. -500)</p>
                <div className={styles.formGroup}>
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th>Number</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row, index) => (
                        <tr key={index}>
                          <td>
                            <input
                              type="text"
                              value={row.number}
                              onChange={(e) => updateItem(index, 'number', e.target.value)}
                              placeholder="No."
                              className={styles.itemInput}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              placeholder="Description"
                              className={styles.itemInput}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              value={row.amount}
                              onChange={(e) => updateItem(index, 'amount', e.target.value)}
                              placeholder="0 or -"
                              className={styles.itemInput}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              disabled={items.length <= 1}
                              className={styles.removeItemBtn}
                              title="Remove row"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" onClick={addItem} className={styles.addItemBtn}>
                    <Plus size={16} />
                    {items.length === 0 ? 'Add Billing Item' : 'Add another Item'}
                  </button>
                </div>

                <div className={styles.totalCostContainer}>
                  <div className={styles.totalCostLabel}>Total Amount</div>
                  <div className={styles.totalCostDisplay}>
                    <div className={styles.totalCostAmount}>
                      LKR {calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedInquiry}
                  className={styles.submitBtn}
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
