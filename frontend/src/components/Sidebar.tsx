import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { X, Lock } from 'lucide-react';
import MaintenanceModal from './MaintenanceModal';
import {
    LayoutDashboard,
    FolderKanban,
    ListTodo,
    FileText,
    TrendingUp,
    CreditCard,
    MessageSquare,
    Calendar,
    Settings,
    Users,
    User,
    UserCircle,
} from 'lucide-react';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
    const [meetingsMaintenanceOpen, setMeetingsMaintenanceOpen] = useState(false);

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: FolderKanban, label: 'Projects', path: '/projects' },
        { icon: ListTodo, label: 'Tasks', path: '/tasks' },
        { icon: FileText, label: 'Work Logs', path: '/work-logs' },
        { icon: TrendingUp, label: 'Performance', path: '/performance' },
        { icon: CreditCard, label: 'Billing', path: '/billing' },
        { icon: UserCircle, label: 'Customer', path: '/customer' },
    ];

    const leadsItems = [
        { icon: MessageSquare, label: 'Inquiries', path: '/inquiries' },
        { icon: FileText, label: 'Proposal', path: '/proposals' },
        { icon: Calendar, label: 'Meetings', path: '/meetings', locked: true },
    ];

    const adminItems = [
        { icon: Settings, label: 'Settings', path: '/settings' },
        { icon: Users, label: 'Team Management', path: '/team' },
        { icon: User, label: 'Profile', path: '/profile' },
    ];

    return (
        <>
            <MaintenanceModal
                open={meetingsMaintenanceOpen}
                title="Meetings temporarily unavailable"
                message="Meeting function closed temporarily due to maintenance."
                onClose={() => setMeetingsMaintenanceOpen(false)}
            />
            {/* Mobile sidebar */}
            <div
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-orange-100 flex flex-col font-sans transform transition-transform duration-300 ease-in-out lg:hidden ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="px-6 pt-6 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img
                            src="/login/Niollanexa.gif"
                            alt="Niolla Desk"
                            className="h-14 w-auto object-contain"
                        />
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/50 rounded-lg text-gray-600 lg:hidden"
                            aria-label="Close sidebar"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto pt-2 pb-4 no-scrollbar">
                    <nav className="px-4 space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.label}
                                to={item.path}
                                onClick={onClose}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? 'bg-sidebar-active text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon
                                            size={20}
                                            className={isActive ? 'text-gray-900' : 'text-gray-500'}
                                        />
                                        {item.label}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="mt-8 px-4">
                        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            LEADS MANAGEMENT
                        </h3>
                        <nav className="space-y-1">
                            {leadsItems.map((item) =>
                                (item as { locked?: boolean }).locked ? (
                                    <button
                                        key={item.label}
                                        type="button"
                                        onClick={() => {
                                            setMeetingsMaintenanceOpen(true);
                                            onClose?.();
                                        }}
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors text-gray-500 hover:bg-white/50 hover:text-gray-700 w-full text-left"
                                    >
                                        <item.icon size={20} className="text-gray-400" />
                                        {item.label}
                                        <Lock size={14} className="ml-auto text-gray-400" />
                                    </button>
                                ) : (
                                    <NavLink
                                        key={item.label}
                                        to={item.path}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                                ? 'bg-sidebar-active text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                                            }`
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon
                                                    size={20}
                                                    className={isActive ? 'text-gray-900' : 'text-gray-500'}
                                                />
                                                {item.label}
                                            </>
                                        )}
                                    </NavLink>
                                )
                            )}
                        </nav>
                    </div>

                    <div className="mt-8 px-4">
                        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            ADMINISTRATION
                        </h3>
                        <nav className="space-y-1">
                            {adminItems.map((item) => (
                                <NavLink
                                    key={item.label}
                                    to={item.path}
                                    onClick={onClose}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                            ? 'bg-sidebar-active text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <item.icon
                                                size={20}
                                                className={isActive ? 'text-gray-900' : 'text-gray-500'}
                                            />
                                            {item.label}
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </nav>
                    </div>
                </div>
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:flex w-64 h-screen bg-sidebar border-r border-orange-100 flex-col font-sans">
                <div className="px-6 pt-6 pb-2">
                    <div className="flex items-center gap-2">
                        <img
                            src="/login/Niollanexa.gif"
                            alt="Niolla Desk"
                            className="h-20 w-auto object-contain"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pt-2 pb-4 no-scrollbar">
                    <nav className="px-4 space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.label}
                                to={item.path}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? 'bg-sidebar-active text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon
                                            size={20}
                                            className={isActive ? 'text-gray-900' : 'text-gray-500'}
                                        />
                                        {item.label}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="mt-8 px-4">
                        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            LEADS MANAGEMENT
                        </h3>
                        <nav className="space-y-1">
                            {leadsItems.map((item) =>
                                (item as { locked?: boolean }).locked ? (
                                    <button
                                        key={item.label}
                                        type="button"
                                        onClick={() => setMeetingsMaintenanceOpen(true)}
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors text-gray-500 hover:bg-white/50 hover:text-gray-700 w-full text-left"
                                    >
                                        <item.icon size={20} className="text-gray-400" />
                                        {item.label}
                                        <Lock size={14} className="ml-auto text-gray-400" />
                                    </button>
                                ) : (
                                    <NavLink
                                        key={item.label}
                                        to={item.path}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                                ? 'bg-sidebar-active text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                                            }`
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon
                                                    size={20}
                                                    className={isActive ? 'text-gray-900' : 'text-gray-500'}
                                                />
                                                {item.label}
                                            </>
                                        )}
                                    </NavLink>
                                )
                            )}
                        </nav>
                    </div>

                    <div className="mt-8 px-4">
                        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            ADMINISTRATION
                        </h3>
                        <nav className="space-y-1">
                            {adminItems.map((item) => (
                                <NavLink
                                    key={item.label}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                            ? 'bg-sidebar-active text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <item.icon
                                                size={20}
                                                className={isActive ? 'text-gray-900' : 'text-gray-500'}
                                            />
                                            {item.label}
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </nav>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
