import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Info, Flag, DollarSign, Trash2, Edit3, Plus, Download } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { format } from 'date-fns';

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
        time: m.timePeriod // Map timePeriod to time for UI consistency if needed, but keeping logic distinct
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
    try {
      await api.download(`/proposals/${proposal._id}/pdf`, `proposal-${proposal.customerName.replace(/\s+/g, '-')}.pdf`);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!proposal) return <div className="p-8 text-center text-gray-500">Proposal not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <button
            onClick={() => navigate('/proposals')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors w-fit"
          >
            <ArrowLeft size={20} />
            <span className="font-medium text-lg">Back</span>
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Home</span>
            <span>&gt;</span>
            <span>Proposals</span>
            <span>&gt;</span>
            <span className="font-semibold text-gray-500">Proposal Details</span>
          </div>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-[2rem] font-extrabold text-gray-900 tracking-tight leading-tight">
              {proposal.customerName}
            </h1>
            <p className="text-base text-gray-500 mt-1">
              {proposal.proposalId ? `${proposal.proposalId} • ` : ''}Proposal Details
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={downloadPdf}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download size={16} />
              Download PDF
            </button>
            <button
              onClick={handleDelete}
              className="bg-white border border-red-100 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <Trash2 size={16} />
              Delete Proposal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Status/Edit Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-700">Status:</span>
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                  CREATED
                </span>
              </div>
              {isEditing ? (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                >
                  <Edit3 size={16} />
                  Edit Proposal
                </button>
              )}
            </div>

            {/* Inquiries Reference Details (Read-only from Inquiry) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={20} className="text-primary" />
                <h3 className="text-base font-bold text-gray-900">Inquiries Reference Details</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                  <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600">
                    {proposal.customerName}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 min-h-[80px]">
                    {proposal.projectDescription}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Required Features</label>
                  <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 min-h-[60px]">
                    {proposal.requiredFeatures?.join(', ') || 'No features specified'}
                  </div>
                </div>
              </div>
            </div>

            {/* General Information (Editable) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Info size={20} className="text-primary" />
                <h3 className="text-base font-bold text-gray-900">General Information</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Title</label>
                <input
                  type="text"
                  value={isEditing ? projectTitle : (proposal.projectName || '')}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  readOnly={!isEditing}
                  className={`w-full px-4 py-2.5 rounded-lg text-sm ${isEditing ? 'bg-white border border-gray-300 focus:outline-none focus:border-primary' : 'bg-gray-50 border border-gray-300 text-gray-600'}`}
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Milestones (Editable) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Flag size={20} className="text-primary" />
                <h3 className="text-base font-bold text-gray-900">Milestones</h3>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm font-medium text-gray-700">
                  <div>Title</div>
                  <div>Amount</div>
                  <div>Time</div>
                </div>

                {(isEditing ? milestones : proposal.milestones).map((milestone, index) => (
                  <div key={index} className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={milestone.title}
                      onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                      readOnly={!isEditing}
                      className={`px-3 py-2 rounded-lg text-sm ${isEditing ? 'bg-white border border-gray-300 focus:outline-none focus:border-primary' : 'bg-gray-50 border border-gray-300 text-gray-600'}`}
                    />
                    <input
                      type="text"
                      value={isEditing ? (milestone.amount || '') : `Rs. ${(milestone.amount || 0).toLocaleString()}`}
                      onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                      readOnly={!isEditing}
                      className={`px-3 py-2 rounded-lg text-sm ${isEditing ? 'bg-white border border-gray-300 focus:outline-none focus:border-primary' : 'bg-gray-50 border border-gray-300 text-gray-600'}`}
                    />
                    <input
                      type="text"
                      value={milestone.timePeriod || ''}
                      onChange={(e) => updateMilestone(index, 'timePeriod', e.target.value)}
                      readOnly={!isEditing}
                      className={`px-3 py-2 rounded-lg text-sm ${isEditing ? 'bg-white border border-gray-300 focus:outline-none focus:border-primary' : 'bg-gray-50 border border-gray-300 text-gray-600'}`}
                    />
                  </div>
                ))}

                {isEditing && (
                  <button
                    onClick={addMilestone}
                    className="text-primary hover:text-primary-hover font-medium text-sm flex items-center gap-1 mt-2"
                  >
                    <Plus size={16} />
                    Add another Milestone
                  </button>
                )}
              </div>
            </div>

            {/* Pricing (Editable) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign size={20} className="text-primary" />
                <h3 className="text-base font-bold text-gray-900">Pricing</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Advance Payment</label>
                  <input
                    type="number"
                    value={isEditing ? advancePayment : (proposal.advancePayment || '')}
                    onChange={(e) => setAdvancePayment(e.target.value)}
                    readOnly={!isEditing}
                    className={`w-full px-4 py-2.5 rounded-lg text-sm ${isEditing ? 'bg-white border border-gray-300 focus:outline-none focus:border-primary' : 'bg-gray-50 border border-gray-300 text-gray-600'}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Cost</label>
                  <input
                    type="number"
                    value={isEditing ? projectCost : (proposal.projectCost || '')}
                    onChange={(e) => setProjectCost(e.target.value)}
                    readOnly={!isEditing}
                    className={`w-full px-4 py-2.5 rounded-lg text-sm ${isEditing ? 'bg-white border border-gray-300 focus:outline-none focus:border-primary' : 'bg-gray-50 border border-gray-300 text-gray-600'}`}
                  />
                </div>

                <div className="pt-4">
                  <div className="text-sm font-medium text-gray-700 mb-2 text-center">Total Cost</div>
                  <div className="bg-white border-2 border-primary rounded-lg px-6 py-6 text-center">
                    <div className="text-3xl font-bold text-primary">
                      LKR {(isEditing ? calculateTotal() : proposal.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
