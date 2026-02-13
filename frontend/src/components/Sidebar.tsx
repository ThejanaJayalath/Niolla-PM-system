import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    FolderKanban,
    ListTodo,
    FileText,
    TrendingUp,
    MessageSquare,
    Calendar,
    Settings,
    Users,
    User,
} from 'lucide-react';

const Sidebar = () => {
    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: FolderKanban, label: 'Projects', path: '/projects' },
        { icon: ListTodo, label: 'Tasks', path: '/tasks' },
        { icon: FileText, label: 'Work Logs', path: '/work-logs' },
        { icon: TrendingUp, label: 'Performance', path: '/performance' },
        { icon: MessageSquare, label: 'Inquiries', path: '/inquiries' },
        { icon: FileText, label: 'Proposal', path: '/proposals' },
        { icon: Calendar, label: 'Meetings', path: '/meetings' },
    ];

    const adminItems = [
        { icon: Settings, label: 'Settings', path: '/settings' },
        { icon: Users, label: 'Team Management', path: '/team' },
        { icon: User, label: 'Profile', path: '/profile' },
    ];

    return (
        <div className="w-64 h-screen bg-sidebar border-r border-orange-100 flex flex-col font-sans">
            <div className="px-6 pt-6 pb-2">
                <div className="flex items-center gap-2">
                    <img
                        src="/login/Niollanexa.png"
                        alt="Niolla Desk"
                        className="h-16 w-auto object-contain"
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
    );
};

export default Sidebar;
