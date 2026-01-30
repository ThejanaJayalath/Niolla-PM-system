import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye, Download } from 'lucide-react';
import { api } from '../api/client';
import styles from './Proposals.module.css';

interface Proposal {
  _id: string;
  inquiryId: string;
  customerName: string;
  totalAmount: number;
  validUntil?: string;
  createdAt: string;
}

export default function Proposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Proposal[]>('/proposals').then((res) => {
      if (res.success && res.data) setProposals(res.data);
      setLoading(false);
    });
  }, []);

  const downloadPdf = async (id: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/v1/proposals/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proposal-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1 className={styles.title}>Proposals</h1>
      {loading ? (
        <p className={styles.muted}>Loading...</p>
      ) : proposals.length === 0 ? (
        <div className={styles.empty}>
          <p>No proposals yet. Create a sample proposal from an inquiry detail page (Proposal tab).</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Total Amount</th>
                <th>Created Date</th>
                <th>Valid Until</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p._id}>
                  <td className={styles.cellName}>{p.customerName}</td>
                  <td>${p.totalAmount.toLocaleString()}</td>
                  <td>{format(new Date(p.createdAt), 'MMM d, yyyy')}</td>
                  <td>{p.validUntil ? format(new Date(p.validUntil), 'MMM d, yyyy') : '—'}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link to={`/proposals/${p._id}`} className={styles.iconBtn} title="View" aria-label="View">
                        <Eye size={18} />
                      </Link>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Download PDF"
                        aria-label="Download PDF"
                        onClick={() => downloadPdf(p._id)}
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
