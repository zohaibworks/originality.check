import React from 'react';
import { useApp } from '../context/AppContext';
import { OriginalityCheckLogo } from './OriginalityCheckLogo';
import {
  LayoutDashboard,
  FileText,
  Ticket,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export const ClientSidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isSidebarOpen,
    toggleSidebar,
  } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports',   label: 'Reports',   icon: FileText },
    { id: 'redeem',    label: 'Redeem Code', icon: Ticket },
  ] as const;

  return (
    <aside
      className={`bg-[#0d1526] border-b md:border-b-0 md:border-r border-white/[0.06] flex flex-col justify-start shrink-0 select-none md:sticky md:top-0 transition-all duration-200 z-20 w-full md:min-h-screen ${
        isSidebarOpen ? 'md:w-64' : 'md:w-[72px]'
      }`}
      id="client-sidebar"
    >
      {/* Logo & Toggle */}
      <div
        className={`border-b border-white/[0.06] flex items-center transition-all duration-200 ${
          isSidebarOpen ? 'px-4 py-4 justify-between gap-2' : 'px-3 py-4 flex-col gap-3 justify-center'
        }`}
      >
        {isSidebarOpen ? (
          <>
            <OriginalityCheckLogo size="sm" showSubtitle={true} subtitle="Academic Integrity" variant="dark" />
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.07] transition shrink-0"
              title="Collapse sidebar"
              id="btn-sidebar-toggle-close"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <OriginalityCheckLogo size="sm" iconOnly={true} variant="dark" />
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition"
              title="Expand sidebar"
              id="btn-sidebar-toggle-open"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={`flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible scrollbar-hide transition-all duration-200 ${
          isSidebarOpen ? 'p-3' : 'p-2'
        }`}
        id="sidebar-nav"
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              title={!isSidebarOpen ? item.label : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-150 ${
                isSidebarOpen ? 'gap-3 px-3.5 py-2.5' : 'justify-center p-2.5'
              } ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 ring-1 ring-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] shrink-0 ${
                  isActive ? 'text-indigo-400' : 'text-slate-500'
                }`}
              />
              {isSidebarOpen && <span>{item.label}</span>}
              {isSidebarOpen && isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
