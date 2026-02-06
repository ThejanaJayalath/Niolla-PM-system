import React from 'react';
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
            <div className="p-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center bg-gray-900 rounded-sm">
                        <div className="w-4 h-4 border-2 border-primary rotate-45 transform"></div>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-none">NIOLLA</h1>
                        <p className="text-xs font-bold text-primary tracking-widest leading-none">DESK</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 no-scrollbar">
                <nav className="px-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.label}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                    ? 'bg-white text-gray-900 shadow-sm'
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
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:bg-orange-50 hover:text-gray-900'
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
