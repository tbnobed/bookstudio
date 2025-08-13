import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import logoPath from "../../assets/logo.png";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { siteName } = useSiteSettings();
  
  // Debug log to track user changes in sidebar
  console.log("Sidebar rendering with user:", user);
  
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      // Force a direct location change instead of using router
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div 
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      <div className="flex flex-col h-full">
        <div className="p-1 border-b">
          <div className="flex items-center justify-center flex-col">
            <img src={logoPath} alt="BookStud.io logo" className="h-36 w-auto" />
            <h1 className="text-xl font-semibold text-gray-800 mb-2">{siteName || "BookStud.io"}</h1>
          </div>
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          <div 
            className={cn(
              "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
              location === "/calendar" || location === "/" 
                ? "text-white bg-primary" 
                : "text-gray-700 hover:bg-gray-100"
            )}
            onClick={() => handleNavigate("/calendar")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Calendar</span>
          </div>
          
          {/* Hide My Bookings for viewers */}
          {user?.role !== "viewer" && (
            <div 
              className={cn(
                "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
                location === "/my-bookings" 
                  ? "text-white bg-primary" 
                  : "text-gray-700 hover:bg-gray-100"
              )}
              onClick={() => handleNavigate("/my-bookings")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                <path d="M9 14l2 2 4-4"></path>
              </svg>
              <span>My Bookings</span>
            </div>
          )}
          
          {/* Hide Templates for viewers */}
          {user?.role !== "viewer" && (
            <div 
              className={cn(
                "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
                location === "/templates" 
                  ? "text-white bg-primary" 
                  : "text-gray-700 hover:bg-gray-100"
              )}
              onClick={() => handleNavigate("/templates")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span>Templates</span>
            </div>
          )}
          
          {/* Hide Reports for producers and viewers */}
          {user?.role !== "producer" && user?.role !== "viewer" && (
            <div 
              className={cn(
                "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
                location === "/reports" 
                  ? "text-white bg-primary" 
                  : "text-gray-700 hover:bg-gray-100"
              )}
              onClick={() => handleNavigate("/reports")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
                <line x1="3" y1="20" x2="21" y2="20"></line>
              </svg>
              <span>Reports</span>
            </div>
          )}
          

          
          {/* Admin section - only shown to admins */}
          {user?.role === "admin" && (
            <>
              <div className="pt-4 pb-2">
                <div className="flex items-center px-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</h3>
                </div>
              </div>
              
              <div 
                className={cn(
                  "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
                  location === "/users" 
                    ? "text-white bg-primary" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => handleNavigate("/users")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                <span>User Management</span>
              </div>
              
              <div 
                className={cn(
                  "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
                  location === "/admin/booking-ownership" 
                    ? "text-white bg-primary" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => handleNavigate("/admin/booking-ownership")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2m4-2h4a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"></path>
                  <path d="M12 11l2 2 4-4"></path>
                </svg>
                <span>Booking Ownership</span>
              </div>
              
              <div 
                className={cn(
                  "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
                  location === "/admin/database-health" 
                    ? "text-white bg-primary" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => handleNavigate("/admin/database-health")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7"></path>
                  <ellipse cx="12" cy="7" rx="8" ry="4"></ellipse>
                  <path d="M12 17v-5"></path>
                  <path d="M8 12l2 2 4-4"></path>
                </svg>
                <span>Database Health</span>
              </div>
            </>
          )}

          {/* Admin and Site Manager sections */}
          {(user?.role === "admin" || user?.role === "site_manager") && (
            <>
              <div 
                className={cn(
                  "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
                  location === "/teams" 
                    ? "text-white bg-primary" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => handleNavigate("/teams")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M9 21v-2a4 4 0 0 1 3-3.87"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                  <path d="M5 17a2 2 0 0 1 2-2h2"></path>
                  <path d="M15 17a2 2 0 0 0-2-2h-2"></path>
                </svg>
                <span>Teams</span>
              </div>
              
              <div 
                className={cn(
                  "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
                  location === "/audit-logs" 
                    ? "text-white bg-primary" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => handleNavigate("/audit-logs")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <path d="M16 10l-4 4-2-2"></path>
                </svg>
                <span>Audit Logs</span>
              </div>
            </>
          )}
          
          {/* Site Manager section - only shown to site managers */}
          {user?.role === "site_manager" && (
            <>
              <div className="pt-4 pb-2">
                <div className="flex items-center px-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Site Manager</h3>
                </div>
              </div>
              
              <div 
                className={cn(
                  "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
                  location === "/producer-management" 
                    ? "text-white bg-primary" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => handleNavigate("/producer-management")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                <span>Producer Management</span>
              </div>
            </>
          )}
          
          <div 
            className={cn(
              "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
              location === "/settings" 
                ? "text-white bg-primary" 
                : "text-gray-700 hover:bg-gray-100"
            )}
            onClick={() => handleNavigate("/settings")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Settings</span>
          </div>
        </nav>
        
        <div className="p-4 border-t">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">{user?.name || user?.username || 'User'}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role || 'User'}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="ml-auto p-1 text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
