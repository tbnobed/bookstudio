import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import logoPath from "../../assets/logo.png";
import logoDarkPath from "../../assets/logo-dark.png";
import {
  Users,
  ClipboardList,
  Database,
  UsersRound,
  FileCheck2,
  LogOut,
  ChevronDown,
  UserPlus,
  Tv,
} from "lucide-react";
import { useState } from "react";

// ── Custom production-studio icon set ────────────────────────────────────────

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="20" height="17" rx="2"/>
      <path d="M2 10h20"/>
      <path d="M7 3v4M17 3v4"/>
      <rect x="5" y="13" width="3" height="2.5" rx=".6" fill="currentColor" stroke="none"/>
      <rect x="10.5" y="13" width="3" height="2.5" rx=".6" fill="currentColor" stroke="none"/>
      <rect x="5" y="17" width="3" height="2.5" rx=".6" fill="currentColor" stroke="none"/>
      <rect x="10.5" y="17" width="3" height="2.5" rx=".6" fill="currentColor" stroke="none"/>
      <circle cx="18.5" cy="7.5" r="1.6" fill="#ef4444" stroke="none"/>
    </svg>
  );
}

function IconMyBookings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="8" width="20" height="14" rx="2"/>
      <rect x="2" y="3" width="20" height="6" rx="1.5"/>
      <path d="M5.5 3L3.5 9M9.5 3L7.5 9M13.5 3L11.5 9M17.5 3L15.5 9M21.5 3L19.5 9" strokeWidth="1.2" opacity=".55"/>
      <path d="M7.5 16.5l3 2.5 6-6" strokeWidth="1.6"/>
    </svg>
  );
}

function IconTemplates({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="16" height="18" rx="2"/>
      <rect x="3" y="2" width="16" height="18" rx="2"/>
      <rect x="6" y="6.5" width="2" height="2" rx=".4" fill="currentColor" stroke="none"/>
      <rect x="6" y="11" width="2" height="2" rx=".4" fill="currentColor" stroke="none"/>
      <rect x="6" y="15.5" width="2" height="2" rx=".4" fill="currentColor" stroke="none"/>
      <path d="M10 7.5h6M10 12h6M10 16.5h4" strokeWidth="1.2"/>
    </svg>
  );
}

function IconReports({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21h18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".4"/>
      <rect x="3" y="15" width="3.5" height="6" rx="1.75" fill="currentColor"/>
      <rect x="8.25" y="11" width="3.5" height="10" rx="1.75" fill="currentColor"/>
      <rect x="13.5" y="7" width="3.5" height="14" rx="1.75" fill="currentColor"/>
      <rect x="18.5" y="13" width="3" height="8" rx="1.5" fill="currentColor" opacity=".5"/>
      <path d="M12 2v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9.5 3.8Q12 2 14.5 3.8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function IconAssets({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="5.5"/>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
      <path d="M12 6.5L10.2 9.7" strokeWidth=".9" opacity=".6"/>
      <path d="M8.5 8.5L11.8 10.2" strokeWidth=".9" opacity=".6"/>
      <path d="M6.5 12h3.3" strokeWidth=".9" opacity=".6"/>
      <path d="M8.5 15.5L11.8 13.8" strokeWidth=".9" opacity=".6"/>
      <path d="M12 17.5L13.8 14.3" strokeWidth=".9" opacity=".6"/>
      <path d="M15.5 15.5L12.2 13.8" strokeWidth=".9" opacity=".6"/>
      <path d="M17.5 12h-3.3" strokeWidth=".9" opacity=".6"/>
      <path d="M15.5 8.5L12.2 10.2" strokeWidth=".9" opacity=".6"/>
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.5"/>
      <circle cx="12" cy="12" r="3.5"/>
      <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5" strokeWidth="1.4"/>
      <path d="M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M18.1 5.9l-1.5 1.5M7.4 16.6l-1.5 1.5" strokeWidth="1"/>
      <path d="M12 8.5V12.5" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconAdministration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="20" height="15" rx="2"/>
      <path d="M2 10h20" strokeWidth="1" opacity=".4"/>
      <circle cx="5.5" cy="7.5" r="1.1" fill="#ef4444" stroke="none"/>
      <circle cx="9" cy="7.5" r="1.1" fill="#f59e0b" stroke="none"/>
      <circle cx="12.5" cy="7.5" r="1.1" fill="#22c55e" stroke="none"/>
      <rect x="4.5" y="12.5" width="4" height="5" rx="1"/>
      <rect x="10" y="12.5" width="4" height="5" rx="1"/>
      <circle cx="19" cy="15" r="2.5"/>
      <path d="M19 12.5v1" strokeWidth="1.2"/>
    </svg>
  );
}

function IconManagement({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="4" cy="6" r="2"/>
      <circle cx="4" cy="12" r="2"/>
      <circle cx="4" cy="18" r="2"/>
      <circle cx="20" cy="8" r="2"/>
      <circle cx="20" cy="16" r="2"/>
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.5"/>
      <path d="M6 6.5L9.5 10.5" strokeWidth="1.2"/>
      <path d="M6 12H9.5" strokeWidth="1.2"/>
      <path d="M6 17.5L9.5 13.5" strokeWidth="1.2"/>
      <path d="M14.5 10.5L18 8.5" strokeWidth="1.2"/>
      <path d="M14.5 13.5L18 15.5" strokeWidth="1.2"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

type NavItemProps = {
  icon: React.ReactNode;
  label: string;
  path: string;
  isActive: boolean;
  onClick: () => void;
  badge?: string;
};

function NavItem({ icon, label, isActive, onClick, badge }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "sidebar-item w-full text-left",
        isActive ? "sidebar-item-active" : "sidebar-item-inactive"
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 leading-none">
          {badge}
        </span>
      )}
    </button>
  );
}

type NavSectionProps = {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function NavSection({ title, icon, children, defaultOpen = false }: NavSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-neutral-700 dark:hover:text-gray-200 transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon && <span className="opacity-70">{icon}</span>}
          {title}
        </span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 transition-transform duration-200",
          isOpen ? "rotate-0" : "-rotate-90"
        )} />
      </button>
      {isOpen && (
        <div className="space-y-0.5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { siteName } = useSiteSettings();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const iconSize = "h-5 w-5";

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800",
          "transform transition-transform duration-300 ease-out",
          "flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header with Logo */}
        <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-neutral-800">
          <div className="flex flex-col items-center">
            <img
              src={logoPath}
              alt="BookStud.io"
              className="h-28 w-auto object-contain dark:hidden"
              style={{ transform: 'scale(2)' }}
            />
            <img
              src={logoDarkPath}
              alt="BookStud.io"
              className="h-28 w-auto object-contain hidden dark:block"
              style={{ transform: 'scale(2)' }}
            />
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
              {siteName || "BookStud.io"}
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Main Section */}
          <div className="space-y-0.5">
            <NavItem
              icon={<IconCalendar className={iconSize} />}
              label="Calendar"
              path="/calendar"
              isActive={location === "/calendar" || location === "/"}
              onClick={() => handleNavigate("/calendar")}
            />

            <NavItem
              icon={<Tv className={iconSize} />}
              label="Studios"
              path="/studios"
              isActive={location === "/studios"}
              onClick={() => handleNavigate("/studios")}
            />

            {user?.role !== "viewer" && (
              <NavItem
                icon={<IconMyBookings className={iconSize} />}
                label="My Bookings"
                path="/my-bookings"
                isActive={location === "/my-bookings"}
                onClick={() => handleNavigate("/my-bookings")}
              />
            )}

            {user?.role !== "viewer" && (
              <NavItem
                icon={<IconTemplates className={iconSize} />}
                label="Templates"
                path="/templates"
                isActive={location === "/templates"}
                onClick={() => handleNavigate("/templates")}
              />
            )}

            {user?.role !== "producer" && user?.role !== "viewer" && (
              <NavItem
                icon={<IconReports className={iconSize} />}
                label="Reports"
                path="/reports"
                isActive={location === "/reports"}
                onClick={() => handleNavigate("/reports")}
              />
            )}

            {user?.role !== "viewer" && (
              <NavItem
                icon={<IconAssets className={iconSize} />}
                label="Assets"
                path="/assets"
                isActive={location === "/assets"}
                onClick={() => handleNavigate("/assets")}
              />
            )}

            {user?.role !== "viewer" && (
              <NavItem
                icon={<UserPlus className={iconSize} />}
                label="Crew"
                badge="New"
                path="/crew"
                isActive={location === "/crew"}
                onClick={() => handleNavigate("/crew")}
              />
            )}
          </div>

          {/* Admin Section */}
          {user?.role === "admin" && (
            <NavSection
              title="Administration"
              icon={<IconAdministration className="h-3.5 w-3.5" />}
            >
              <NavItem
                icon={<Users className={iconSize} />}
                label="User Management"
                path="/users"
                isActive={location === "/users"}
                onClick={() => handleNavigate("/users")}
              />
              <NavItem
                icon={<ClipboardList className={iconSize} />}
                label="Booking Ownership"
                path="/admin/booking-ownership"
                isActive={location === "/admin/booking-ownership"}
                onClick={() => handleNavigate("/admin/booking-ownership")}
              />
              <NavItem
                icon={<Database className={iconSize} />}
                label="Database Health"
                path="/admin/database-health"
                isActive={location === "/admin/database-health"}
                onClick={() => handleNavigate("/admin/database-health")}
              />
            </NavSection>
          )}

          {/* Management Section */}
          {(user?.role === "admin" || user?.role === "site_manager") && (
            <NavSection
              title="Management"
              icon={<IconManagement className="h-3.5 w-3.5" />}
            >
              <NavItem
                icon={<UsersRound className={iconSize} />}
                label="Teams"
                path="/teams"
                isActive={location === "/teams"}
                onClick={() => handleNavigate("/teams")}
              />
              <NavItem
                icon={<FileCheck2 className={iconSize} />}
                label="Audit Logs"
                path="/audit-logs"
                isActive={location === "/audit-logs"}
                onClick={() => handleNavigate("/audit-logs")}
              />
              {user?.role === "site_manager" && (
                <NavItem
                  icon={<Users className={iconSize} />}
                  label="Producer Management"
                  path="/producer-management"
                  isActive={location === "/producer-management"}
                  onClick={() => handleNavigate("/producer-management")}
                />
              )}
            </NavSection>
          )}

          {/* Settings */}
          <div className="pt-2 border-t border-gray-100 dark:border-neutral-800">
            <NavItem
              icon={<IconSettings className={iconSize} />}
              label="Settings"
              path="/settings"
              isActive={location === "/settings"}
              onClick={() => handleNavigate("/settings")}
            />
          </div>
        </nav>

        {/* User Profile Footer */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-800/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-semibold text-sm shadow-md">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                {user?.name || user?.username || 'User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user?.role?.replace('_', ' ') || 'User'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              title="Sign out"
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
