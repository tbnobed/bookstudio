import { useState } from "react";
import { useLocation } from "wouter";
import { Calendar, BookOpen, ListTodo, Settings, Menu, PlusCircle, Bell, BarChart, Tv, Users, LogOut, Moon, Sun, Package } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import SimpleMobileFormNew from "@/components/booking/SimpleMobileForm-new";
import AlertModal from "@/components/alerts/AlertModal";
import { useCalendarContext } from "@/contexts/CalendarContext";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

export default function MobileNavbar() {
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewAlertModalOpen, setIsNewAlertModalOpen] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const { selectedDate } = useCalendarContext();
  const { theme, setTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getUserInitials = () => {
    if (!user?.name) return "U";
    const nameParts = user.name.split(" ");
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  };

  const navigateTo = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(path);
  };

  const NavButton = ({ path, icon: Icon, label, isCenter = false }: { path: string; icon: typeof Calendar; label: string; isCenter?: boolean }) => {
    const isActive = location === path;
    return (
      <button 
        onClick={navigateTo(path)}
        className={cn(
          "flex flex-col items-center justify-center flex-1 h-full transition-colors",
          isActive 
            ? "text-primary" 
            : "text-gray-500 dark:text-gray-400"
        )}
        data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
      >
        <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
        <span className={cn(
          "text-[10px] mt-1 font-medium",
          isActive && "text-primary"
        )}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 z-50 safe-area-inset-bottom">
        <div className="flex items-center h-16">
          <NavButton path="/calendar" icon={Calendar} label="Calendar" />
          <NavButton path="/my-bookings" icon={BookOpen} label="Bookings" />
          
          {/* Center Add Button */}
          <div className="flex flex-col items-center justify-center flex-1 h-full -mt-4">
            <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
              <SheetTrigger asChild>
                <button 
                  className="rounded-full bg-gradient-to-r from-blue-700 to-indigo-700 p-3.5 text-white shadow-lg hover:shadow-xl transition-all active:scale-95"
                  data-testid="button-create-new"
                >
                  <PlusCircle className="h-6 w-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto rounded-t-2xl">
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-lg">Create New</SheetTitle>
                </SheetHeader>
                
                <div className="grid grid-cols-1 gap-3 pb-6">
                  <button
                    onClick={() => {
                      setIsNewBookingModalOpen(true);
                      setIsCreateSheetOpen(false);
                    }}
                    className="flex items-center p-4 rounded-xl border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 w-full text-left transition-colors"
                    data-testid="button-create-booking"
                  >
                    <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-lg mr-4">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-white">Create Booking</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Schedule studio time</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsNewAlertModalOpen(true);
                      setIsCreateSheetOpen(false);
                    }}
                    className="flex items-center p-4 rounded-xl border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 w-full text-left transition-colors"
                    data-testid="button-create-alert"
                  >
                    <div className="flex-shrink-0 bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-lg mr-4">
                      <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-white">Create Alert</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Facility maintenance or notification</div>
                    </div>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          <NavButton path="/" icon={Tv} label="Studios" />
          
          {/* Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <button 
                className="flex flex-col items-center justify-center flex-1 h-full text-gray-500 dark:text-gray-400"
                data-testid="button-menu"
              >
                <Menu className="h-5 w-5" />
                <span className="text-[10px] mt-1 font-medium">Menu</span>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-lg">Menu</SheetTitle>
              </SheetHeader>
              
              {/* User Info */}
              {user && (
                <div className="flex items-center p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl mb-6">
                  <Avatar className="h-11 w-11 mr-3">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 dark:text-white truncate">{user.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user.role?.replace('_', ' ')}</div>
                  </div>
                </div>
              )}
              
              <Separator className="mb-4" />
              
              {/* Navigation Links */}
              <nav className="flex flex-col space-y-1">
                {[
                  { path: "/", icon: Calendar, label: "Calendar" },
                  { path: "/my-bookings", icon: BookOpen, label: "My Bookings" },
                  { path: "/templates", icon: ListTodo, label: "Templates" },
                  { path: "/studios", icon: Tv, label: "Studios" },
                  { path: "/mobile/assets", icon: Package, label: "Assets", badge: "Beta" },
                ].map((item) => (
                  <button 
                    key={item.path}
                    onClick={navigateTo(item.path)}
                    className={cn(
                      "flex items-center p-3 rounded-lg w-full text-left transition-colors",
                      location === item.path 
                        ? "bg-primary/10 text-primary" 
                        : "text-neutral-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                    )}
                    data-testid={`menu-${item.label.toLowerCase().replace(' ', '-')}`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                    {'badge' in item && item.badge && (
                      <span className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 leading-none">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
                
                {user?.role !== "producer" && (
                  <button 
                    onClick={navigateTo("/reports")}
                    className="flex items-center p-3 rounded-lg w-full text-left text-neutral-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    data-testid="menu-reports"
                  >
                    <BarChart className="mr-3 h-5 w-5" />
                    <span className="font-medium">Reports</span>
                  </button>
                )}
                
                {user?.role === "admin" && (
                  <button 
                    onClick={navigateTo("/users")}
                    className="flex items-center p-3 rounded-lg w-full text-left text-neutral-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    data-testid="menu-users"
                  >
                    <Users className="mr-3 h-5 w-5" />
                    <span className="font-medium">Users</span>
                  </button>
                )}
                
                {user?.role === "site_manager" && (
                  <button 
                    onClick={navigateTo("/producer-management")}
                    className="flex items-center p-3 rounded-lg w-full text-left text-neutral-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    data-testid="menu-producers"
                  >
                    <Users className="mr-3 h-5 w-5" />
                    <span className="font-medium">Producers</span>
                  </button>
                )}
                
                <button 
                  onClick={navigateTo("/settings")}
                  className="flex items-center p-3 rounded-lg w-full text-left text-neutral-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  data-testid="menu-settings"
                >
                  <Settings className="mr-3 h-5 w-5" />
                  <span className="font-medium">Settings</span>
                </button>
              </nav>
              
              <Separator className="my-4" />
              
              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className="flex items-center justify-between p-3 rounded-lg w-full text-left text-neutral-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors mb-2"
                data-testid="button-theme-toggle"
              >
                <div className="flex items-center">
                  {theme === "dark" ? (
                    <Moon className="mr-3 h-5 w-5" />
                  ) : (
                    <Sun className="mr-3 h-5 w-5" />
                  )}
                  <span className="font-medium">Theme</span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {theme === "dark" ? "Dark" : "Light"}
                </span>
              </button>
              
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  className="w-full gap-2" 
                  onClick={handleLogout}
                  data-testid="button-signout"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {/* Modals */}
      <SimpleMobileFormNew
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        onSubmit={() => setIsNewBookingModalOpen(false)}
        selectedDate={selectedDate || new Date()}
      />
      
      <AlertModal
        isOpen={isNewAlertModalOpen}
        onClose={() => setIsNewAlertModalOpen(false)}
        selectedDate={selectedDate || new Date()}
      />
    </>
  );
}
