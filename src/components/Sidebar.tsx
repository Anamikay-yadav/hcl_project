import React from 'react';
import { LayoutDashboard, LineChart, MessageSquareText, FileText, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type TabId = 'dashboard' | 'analysis' | 'reviews' | 'reports';

const ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analysis', label: 'Sentiment Analysis', icon: LineChart },
  { id: 'reviews', label: 'Customer Reviews', icon: MessageSquareText },
  { id: 'reports', label: 'Reports', icon: FileText },
];

interface SidebarProps {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelect, isOpen, onClose }) => {
  const { user, logout } = useAuth();

  return (
    <>
      {isOpen && <div onClick={onClose} className="fixed inset-0 bg-navy-950/50 z-40 lg:hidden" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-navy-900 text-white flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">Bank Muscat</div>
            <div className="text-xs text-blue-200/80">Sentiment Analytics</div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 text-blue-200 hover:text-white" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  onSelect(id);
                  onClose();
                }}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 h-10 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-white/10 text-white font-medium shadow-[inset_3px_0_0_0_#6fa3dc]'
                    : 'text-blue-100/75 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="min-w-0 leading-tight">
            <div className="text-sm truncate">{user?.fullName || user?.username}</div>
            <div className="text-xs text-blue-200/70 truncate">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="p-2 rounded-md text-blue-200/80 hover:text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};
