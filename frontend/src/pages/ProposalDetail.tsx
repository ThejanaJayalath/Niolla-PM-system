import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Info, Flag, DollarSign, Trash2, Edit3, Plus, Download } from 'lucide-react';
import { api, getPdfDownloadUrl } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './ProposalDetail.module.css';

interface Proposal {
  _id: string;
  inquiryId: string;
  proposalId?: string;
  customerName: string;
  projectDescription: string;
  requiredFeatures: string[];
  projectName?: string;
  milestones: Milestone[];
  advancePayment?: number;
  projectCost?: number;
  totalAmount: number;
  maintenanceCostPerMonth?: number;
  maintenanceNote?: string;
  validUntil?: string;
  notes?: string;
  createdAt: string;
}

interface Milestone {
  title: string;
  amount?: number | string;
  timePeriod?: string;
  description?: string;
  dueDate?: string;
}

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Form State
  const [projectTitle, setProjectTitle] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [advancePayment, setAdvancePayment] = useState('');
  const [projectCost, setProjectCost] = useState('');

  useEffect(() => {
    loadProposal();
  }, [id]);

  const loadProposal = async () => {
    if (!id) return;
    try {
      const res = await api.get<Proposal>(`/proposals/${id}`);
      if (res.success && res.data) {
        setProposal(res.data);
        initializeForm(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const initializeForm = (data: Proposal) => {
    setProjectTitle(data.projectName || '');
    setMilestones(data.milestones && data.milestones.length > 0
      ? data.milestones.map(m => ({
        ...m,
        amount: m.amount?.toString() || '',
        timePeriod: m.timePeriod || ''
      }))
      : [{ title: '', amount: '', timePeriod: '' }]
    );
    setAdvancePayment(data.advancePayment?.toString() || '');
    setProjectCost(data.projectCost?.toString() || '');
  };

  const calculateTotal = () => {
    const advance = parseFloat(advancePayment) || 0;
    const project = parseFloat(projectCost) || 0;
    return advance + project;
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const mappedMilestones = milestones
        .filter(m => m.title.trim())
        .map(m => ({
          title: m.title,
          amount: m.amount ? parseFloat(m.amount.toString()) : undefined,
          timePeriod: m.timePeriod
        }));

      const res = await api.patch<Proposal>(`/proposals/${id}`, {
        projectName: projectTitle,
        milestones: mappedMilestones,
        advancePayment: parseFloat(advancePayment) || 0,
        projectCost: parseFloat(projectCost) || 0,
        totalAmount: calculateTotal()
      });

      if (res.success && res.data) {
        setProposal(res.data);
        setIsEditing(false);
        initializeForm(res.data);
      } else {
        alert('Failed to update proposal');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update proposal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.delete(`/proposals/${id}`);
      navigate('/proposals');
    } catch (err) {
      console.error(err);
      alert('Failed to delete proposal');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: string) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const addMilestone = () => {
    setMilestones([...milestones, { title: '', amount: '', timePeriod: '' }]);
  };

  const downloadPdf = async () => {
    if (!proposal) return;
    setDownloading(true);
    try {
      await api.download(`/proposals/${proposal._id}/pdf`, `proposal-${proposal.customerName.replace(/\s+/g, '-')}.pdf`);
    } catch (err) {
      console.error('Download failed', err);
      alert(err instanceof Error ? err.message : 'Failed to download proposal');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className={styles.container}>Loading...</div>;
  if (!proposal) return <div className={styles.container}>Proposal not found</div>;

  return (
    <div className={styles.container}>
      {/* Back Button & Breadcrumb */}
      <div className="flex flex-col gap-4 mb-6">
        <Link to="/proposals" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors w-fit">
          <ArrowLeft size={20} />
          <span className="font-medium text-lg">Back</span>
        </Link>
        <div className={styles.breadcrumb}>
          <span>Home</span> &gt; <span>Proposals</span> &gt; <span className="font-semibold">Proposal Details</span>
        </div>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{proposal.customerName}</h1>
          <p className={styles.subTitle}>
            {proposal.proposalId ? `${proposal.proposalId} • ` : ''}Proposal Details
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={downloadPdf}
            disabled={downloading}
            className={styles.downloadBtn}
          >
            <Download size={16} />
            {downloading ? 'Downloading...' : 'Download PDF'}
          </button>
          <button onClick={handleDelete} className={styles.deleteBtn}>
            <Trash2 size={16} /> Delete Proposal
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Main Content */}
        <div className={styles.mainCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Proposal Details</h2>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <button onClick={handleSave} disabled={saving} className={styles.saveBtn}>
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <button onClick={() => setIsEditing(true)} className={styles.editBtn}>
                  <Edit3 size={16} /> Edit Proposal
                </button>
              )}
            </div>
          </div>

          {/* Inquiries Reference Details */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <FileText size={18} />
              <h3>Inquiries Reference Details</h3>
            </div>

            <div className={styles.formGroup}>
              <label>Name</label>
              <input
                type="text"
                value={proposal.customerName}
                readOnly
                className={styles.inputReadonly}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Description</label>
              <textarea
                value={proposal.projectDescription}
                readOnly
                className={styles.inputReadonly}
                rows={4}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Required Features</label>
              <div className={styles.chipContainer}>
                {proposal.requiredFeatures && proposal.requiredFeatures.length > 0 ? (
                  proposal.requiredFeatures.map((feature, index) => (
                    <span key={index} className={styles.chip}>
                      {feature}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 italic text-sm">No features specified</span>
                )}
              </div>
            </div>
          </div>

          {/* General Information */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <Info size={18} />
              <h3>General Information</h3>
            </div>

            <div className={styles.formGroup}>
              <label>Project Title</label>
              <input
                type="text"
                value={isEditing ? projectTitle : (proposal.projectName || '')}
                onChange={(e) => setProjectTitle(e.target.value)}
                readOnly={!isEditing}
                className={isEditing ? styles.inputParam : styles.inputReadonly}
              />
            </div>
          </div>

          {/* Milestones */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <Flag size={18} />
              <h3>Milestones</h3>
            </div>

            <div className={styles.formGroup}>
              <table className={styles.milestonesTable}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Amount</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(isEditing ? milestones : proposal.milestones).map((milestone, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={milestone.title || ''}
                          onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                          readOnly={!isEditing}
                          className={isEditing ? styles.milestoneInput : styles.milestoneInputReadonly}
                          placeholder="Milestone title"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={isEditing ? (milestone.amount?.toString() || '') : `Rs. ${(typeof milestone.amount === 'number' ? milestone.amount : parseFloat(milestone.amount?.toString() || '0')).toLocaleString()}`}
                          onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                          readOnly={!isEditing}
                          className={isEditing ? styles.milestoneInput : styles.milestoneInputReadonly}
                          placeholder="Amount"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={milestone.timePeriod || ''}
                          onChange={(e) => updateMilestone(index, 'timePeriod', e.target.value)}
                          readOnly={!isEditing}
                          className={isEditing ? styles.milestoneInput : styles.milestoneInputReadonly}
                          placeholder="Time period"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {isEditing && (
                <button onClick={addMilestone} className={styles.addMilestoneBtn}>
                  <Plus size={16} />
                  Add another Milestone
                </button>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <DollarSign size={18} />
              <h3>Pricing</h3>
            </div>

            <div className={styles.formGroup}>
              <label>Advance Payment</label>
              <input
                type="number"
                value={isEditing ? advancePayment : (proposal.advancePayment?.toString() || '')}
                onChange={(e) => setAdvancePayment(e.target.value)}
                readOnly={!isEditing}
                className={isEditing ? styles.inputParam : styles.inputReadonly}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Project Cost</label>
              <input
                type="number"
                value={isEditing ? projectCost : (proposal.projectCost?.toString() || '')}
                onChange={(e) => setProjectCost(e.target.value)}
                readOnly={!isEditing}
                className={isEditing ? styles.inputParam : styles.inputReadonly}
              />
            </div>

            <div className={styles.totalCostContainer}>
              <div className={styles.totalCostLabel}>Total Cost</div>
              <div className={styles.totalCostDisplay}>
                <div className={styles.totalCostAmount}>
                  LKR {(isEditing ? calculateTotal() : proposal.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Empty for now, can add related info later */}
        <div className={styles.sidebar}>
          {/* Sidebar content can be added here if needed */}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Proposal"
        message="Are you sure you want to delete this proposal? This action cannot be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        danger
      />
    </div>
  );
}
