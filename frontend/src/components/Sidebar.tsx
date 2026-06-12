import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import {
    LayoutDashboard,
    FolderKanban,
    ListTodo,
    FileText,
    TrendingUp,
    TrendingDown,
    ArrowLeftRight,
    CreditCard,
    MessageSquare,
    Calendar,
    CalendarCheck,
    Banknote,
    Bell,
    BarChart3,
    Settings,
    Users,
    User,
    UserCircle,
    UserRoundSearch,
    Wallet,
    ScrollText,
    Receipt,
    Folders,
    Package,
    Sparkles,
    Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    canAccessLeadsAndBilling,
    canDeleteAccounts,
    canManageAccounts,
  canViewCompanyFinancials,
  canViewOperationalReports,
    isDeveloperPortal,
} from '../lib/roles';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
    const { user } = useAuth();
    const role = user?.role;
    const isDev = isDeveloperPortal(role);
    const showLeads = canAccessLeadsAndBilling(role);
    const showFinancialNav = canViewCompanyFinancials(role);
    const showReports = canViewOperationalReports(role) || showFinancialNav;
    const showCampaigns = canAccessLeadsAndBilling(role);
    const navItems = isDev
        ? [
              { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
              { icon: FolderKanban, label: 'My Projects', path: '/projects' },
              { icon: ListTodo, label: 'Tasks', path: '/tasks' },
              { icon: Bell, label: 'Notifications', path: '/notifications' },
          ]
        : [
              { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
              { icon: FolderKanban, label: 'Projects', path: '/projects' },
              ...(showLeads ? [{ icon: Wrench, label: 'Update Tickets', path: '/update-tickets' }] : []),
              ...(canManageAccounts(role)
                  ? [{ icon: Users, label: 'Assign Employees', path: '/assign-employees' }]
                  : []),
              { icon: Bell, label: 'Notifications', path: '/notifications' },
              ...(showReports ? [{ icon: BarChart3, label: 'Reports', path: '/reports' }] : []),
              { icon: ListTodo, label: 'Tasks', path: '/tasks' },
              { icon: FileText, label: 'Work Logs', path: '/work-logs' },
              { icon: TrendingUp, label: 'Performance', path: '/performance' },
              ...(showLeads ? [{ icon: Package, label: 'Product Directory', path: '/products' }] : []),
              ...(showCampaigns ? [{ icon: Sparkles, label: 'Festival Campaigns', path: '/campaigns' }] : []),
              ...(showLeads ? [{ icon: UserCircle, label: 'Customer', path: '/customer' }] : []),
          ];

    const paymentItems = showLeads
        ? [
              { icon: Folders, label: 'Projects & payments', path: '/projects-payments' },
              { icon: Wallet, label: 'Payment Plans', path: '/payment-plans' },
              { icon: CalendarCheck, label: 'Installments', path: '/installments' },
              { icon: Banknote, label: 'Payments', path: '/payments' },
              { icon: CreditCard, label: 'Billing', path: '/billing' },
              { icon: Receipt, label: 'Invoices', path: '/invoices' },
              ...(showFinancialNav ? [{ icon: TrendingDown, label: 'Expenses', path: '/expenses' }] : []),
              ...(showFinancialNav ? [{ icon: ArrowLeftRight, label: 'Transactions', path: '/transactions' }] : []),
          ]
        : [];

    const leadsItems = showLeads
        ? [
              { icon: UserRoundSearch, label: 'Prospects', path: '/prospects' },
              { icon: MessageSquare, label: 'Inquiries', path: '/inquiries' },
              { icon: FileText, label: 'Proposal', path: '/proposals' },
              { icon: Calendar, label: 'Meetings', path: '/meetings' },
          ]
        : [];

    const adminItems = [
        ...(showLeads ? [{ icon: Settings, label: 'Settings', path: '/settings' }] : []),
        ...(canManageAccounts(role) ? [{ icon: Users, label: 'Team Management', path: '/team' }] : []),
        ...(canDeleteAccounts(role) ? [{ icon: ScrollText, label: 'Audit', path: '/audit' }] : []),
        { icon: User, label: 'Profile', path: '/profile' },
    ];

    return (
        <>
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

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-2 pb-4 pr-1 sidebar-scrollbar">
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

                    {leadsItems.length > 0 ? (
                    <div className="mt-8 px-4">
                        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            LEADS MANAGEMENT
                        </h3>
                        <nav className="space-y-1">
                            {leadsItems.map((item) => (
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
                    ) : null}

                    {paymentItems.length > 0 ? (
                    <div className="mt-8 px-4">
                        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            PAYMENT MANAGEMENT
                        </h3>
                        <nav className="space-y-1">
                            {paymentItems.map((item) => (
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
                    ) : null}

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

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-2 pb-4 pr-1 sidebar-scrollbar">
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

                    {leadsItems.length > 0 ? (
                    <div className="mt-8 px-4">
                        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            LEADS MANAGEMENT
                        </h3>
                        <nav className="space-y-1">
                            {leadsItems.map((item) => (
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
                    ) : null}

                    {paymentItems.length > 0 ? (
                    <div className="mt-8 px-4">
                        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            PAYMENT MANAGEMENT
                        </h3>
                        <nav className="space-y-1">
                            {paymentItems.map((item) => (
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
                    ) : null}

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
