import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, Moon, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import styles from './Header.module.css';

interface HeaderProps {
    onMenuClick?: () => void;
}

interface UserProfile {
    profilePhoto?: string;
    name: string;
    email: string;
    role: string;
}

const Header = ({ onMenuClick }: HeaderProps) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get<UserProfile>('/auth/me');
                if (res.success && res.data?.profilePhoto) {
                    setProfilePhoto(res.data.profilePhoto);
                }
            } catch (err) {
                console.error('Failed to fetch profile photo:', err);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };

        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleProfileClick = () => {
        navigate('/profile');
        setDropdownOpen(false);
    };

    const handleSettingsClick = () => {
        navigate('/settings');
        setDropdownOpen(false);
    };

    return (
        <header className="h-16 px-4 md:px-6 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4 flex-1">
                <button
                    onClick={onMenuClick}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 lg:hidden"
                    aria-label="Toggle menu"
                >
                    <Menu size={20} />
                </button>

                <div className="relative w-96 hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search or type command"
                        className="w-full pl-10 pr-12 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">⌘ K</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
                    <Moon size={20} />
                </button>

                <div className="relative">
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
                        <Bell size={20} />
                    </button>
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white"></span>
                </div>

                <div className="h-8 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>

                <div className={styles.userMenu} ref={dropdownRef}>
                    <button 
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className={styles.userButton}
                    >
                        <div className={styles.avatar}>
                            {profilePhoto ? (
                                <img src={profilePhoto} alt={user?.name || 'User'} className={styles.avatarImage} />
                            ) : (
                                <User size={16} className={styles.avatarIcon} />
                            )}
                        </div>
                        <span className="text-sm font-medium text-gray-700 hidden md:block">
                            {user?.name || 'Admin'}
                        </span>
                        <ChevronDown 
                            size={16} 
                            className={`${styles.chevron} ${dropdownOpen ? styles.chevronOpen : ''}`}
                        />
                    </button>

                    {dropdownOpen && (
                        <div className={styles.dropdown}>
                            <div className={styles.dropdownHeader}>
                                <div className={styles.dropdownAvatar}>
                                    {profilePhoto ? (
                                        <img src={profilePhoto} alt={user?.name || 'User'} className={styles.dropdownAvatarImage} />
                                    ) : (
                                        <User size={20} className={styles.dropdownAvatarIcon} />
                                    )}
                                </div>
                                <div className={styles.dropdownUserInfo}>
                                    <div className={styles.dropdownUserName}>{user?.name || 'Admin'}</div>
                                    <div className={styles.dropdownUserEmail}>{user?.email || ''}</div>
                                </div>
                            </div>
                            <div className={styles.dropdownDivider}></div>
                            <button onClick={handleProfileClick} className={styles.dropdownItem}>
                                <User size={18} />
                                <span>Profile</span>
                            </button>
                            <button onClick={handleSettingsClick} className={styles.dropdownItem}>
                                <Settings size={18} />
                                <span>Settings</span>
                            </button>
                            <div className={styles.dropdownDivider}></div>
                            <button onClick={handleLogout} className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}>
                                <LogOut size={18} />
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
