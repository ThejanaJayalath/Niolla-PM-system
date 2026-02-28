import { useNavigate } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import styles from './Dashboard.module.css';

/** Meetings tab is temporarily locked for maintenance. */
export default function Meetings() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className={`${styles.card} max-w-md w-full text-center`} style={{ padding: '2rem' }}>
                <div className="flex justify-center mb-4">
                    <div
                        className="flex items-center justify-center w-14 h-14 rounded-full"
                        style={{ background: '#fef3c7', color: '#f59e0b' }}
                    >
                        <Wrench size={28} />
                    </div>
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Meetings temporarily unavailable</h1>
                <p className="text-gray-600 mb-6">Meeting function closed temporarily due to maintenance.</p>
                <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors shadow-sm"
                    style={{
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                    }}
                >
                    Go to Dashboard
                </button>
            </div>
        </div>
    );
}
