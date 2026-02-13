import { Search, Bell, Menu, Moon } from 'lucide-react';

const Header = () => {
    return (
        <header className="h-16 px-6 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4 flex-1">
                <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 lg:hidden">
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

            <div className="flex items-center gap-4">
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
                    <Moon size={20} />
                </button>

                <div className="relative">
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
                        <Bell size={20} />
                    </button>
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white"></span>
                </div>

                <div className="h-8 w-[1px] bg-gray-200 mx-1"></div>

                <button className="flex items-center gap-3 pl-2 pr-1 py-1 hover:bg-gray-50 rounded-full transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-100">
                        <UserIcon />
                    </div>
                    <span className="text-sm font-medium text-gray-700 hidden sm:block">Admin</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
        </header>
    );
};

const UserIcon = () => (
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
)

export default Header;
