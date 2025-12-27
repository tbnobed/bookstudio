import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import logoPath from "../../assets/logo.png";
import logoDarkPath from "../../assets/logo-dark.png";
import { 
  Calendar, 
  ClipboardCheck, 
  FileText, 
  BarChart3, 
  Users, 
  ClipboardList,
  Database,
  UsersRound,
  FileCheck2,
  Settings,
  LogOut,
  ChevronDown,
  Wrench
} from "lucide-react";
import { useState } from "react";

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
};

function NavItem({ icon, label, isActive, onClick }: NavItemProps) {
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
    </button>
  );
}

type NavSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function NavSection({ title, children, defaultOpen = false }: NavSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="space-y-1">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <span>{title}</span>
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
          "fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800",
          "transform transition-transform duration-300 ease-out",
          "flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header with Logo */}
        <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-gray-800">
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
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
              {siteName || "BookStud.io"}
            </h1>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Main Section */}
          <div className="space-y-0.5">
            <NavItem
              icon={<Calendar className={iconSize} />}
              label="Calendar"
              path="/calendar"
              isActive={location === "/calendar" || location === "/"}
              onClick={() => handleNavigate("/calendar")}
            />
            
            {user?.role !== "viewer" && (
              <NavItem
                icon={<ClipboardCheck className={iconSize} />}
                label="My Bookings"
                path="/my-bookings"
                isActive={location === "/my-bookings"}
                onClick={() => handleNavigate("/my-bookings")}
              />
            )}
            
            {user?.role !== "viewer" && (
              <NavItem
                icon={<FileText className={iconSize} />}
                label="Templates"
                path="/templates"
                isActive={location === "/templates"}
                onClick={() => handleNavigate("/templates")}
              />
            )}
            
            {user?.role !== "producer" && user?.role !== "viewer" && (
              <NavItem
                icon={<BarChart3 className={iconSize} />}
                label="Reports"
                path="/reports"
                isActive={location === "/reports"}
                onClick={() => handleNavigate("/reports")}
              />
            )}
          </div>
          
          {/* Admin Section */}
          {user?.role === "admin" && (
            <NavSection title="Administration">
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

          {/* Management Section - Admin & Site Manager */}
          {(user?.role === "admin" || user?.role === "site_manager") && (
            <NavSection title="Management">
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
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <NavItem
              icon={<Settings className={iconSize} />}
              label="Settings"
              path="/settings"
              isActive={location === "/settings"}
              onClick={() => handleNavigate("/settings")}
            />
          </div>
        </nav>
        
        {/* User Profile Footer */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-semibold text-sm shadow-md">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.name || user?.username || 'User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user?.role?.replace('_', ' ') || 'User'}
              </p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
