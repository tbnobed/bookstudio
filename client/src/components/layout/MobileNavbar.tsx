import { useState } from "react";
import { useLocation } from "wouter";
import { Calendar, BookOpen, ListTodo, Settings, Menu, X, PlusCircle, Bell, BarChart, Tv } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import SimpleMobileFormNew from "@/components/booking/SimpleMobileForm-new";
import AlertModal from "@/components/alerts/AlertModal";
import { useCalendarContext } from "@/contexts/CalendarContext";

export default function MobileNavbar() {
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewAlertModalOpen, setIsNewAlertModalOpen] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const { selectedDate } = useCalendarContext();
  
  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return "U";
    const nameParts = user.name.split(" ");
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  };

  // Fix for the DOM nesting issue with <a> tags inside <a> tags
  const navigateTo = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex items-center justify-around h-16">
          {/* Calendar Link */}
          <button 
            onClick={navigateTo("/calendar")}
            className={`flex flex-col items-center justify-center w-full h-full ${location === "/calendar" ? "text-blue-600" : "text-gray-600"}`}
          >
            <Calendar size={20} />
            <span className="text-xs mt-1">Calendar</span>
          </button>
          
          {/* My Bookings Link */}
          <button 
            onClick={navigateTo("/my-bookings")}
            className={`flex flex-col items-center justify-center w-full h-full ${location === "/my-bookings" ? "text-blue-600" : "text-gray-600"}`}
          >
            <BookOpen size={20} />
            <span className="text-xs mt-1">My Bookings</span>
          </button>
          
          {/* Add Button with Options */}
          <div className="flex flex-col items-center justify-center w-full h-full">
            <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
              <SheetTrigger asChild>
                <button className="rounded-full bg-blue-600 p-3 text-white shadow-md">
                  <PlusCircle size={24} />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>Create New</SheetTitle>
                </SheetHeader>
                
                <div className="grid grid-cols-1 gap-4 pb-4">
                  <button
                    onClick={() => {
                      setIsNewBookingModalOpen(true);
                      setIsCreateSheetOpen(false);
                    }}
                    className="flex items-center p-4 rounded-lg border border-gray-200 hover:bg-gray-50 w-full text-left"
                  >
                    <Calendar className="mr-3 h-6 w-6 text-blue-600" />
                    <div>
                      <div className="font-medium">Create Booking</div>
                      <div className="text-sm text-gray-500">Schedule studio time</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsNewAlertModalOpen(true);
                      setIsCreateSheetOpen(false);
                    }}
                    className="flex items-center p-4 rounded-lg border border-gray-200 hover:bg-gray-50 w-full text-left"
                  >
                    <Bell className="mr-3 h-6 w-6 text-orange-600" />
                    <div>
                      <div className="font-medium">Create Alert</div>
                      <div className="text-sm text-gray-500">Facility maintenance or notification</div>
                    </div>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          {/* Studios */}
          <button 
            onClick={navigateTo("/")}
            className={`flex flex-col items-center justify-center w-full h-full ${location === "/" ? "text-blue-600" : "text-gray-600"}`}
          >
            <Tv size={20} />
            <span className="text-xs mt-1">Studios</span>
          </button>
          
          {/* Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center w-full h-full text-gray-600">
                <Menu size={20} />
                <span className="text-xs mt-1">Menu</span>
              </button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader className="mb-4">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              
              {/* User Info */}
              {user && (
                <div className="flex items-center mb-6">
                  <Avatar className="h-10 w-10 mr-3">
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.role}</div>
                  </div>
                </div>
              )}
              
              <Separator className="mb-4" />
              
              {/* Navigation Links - using buttons instead of nested <a> tags */}
              <nav className="flex flex-col space-y-4">
                <button 
                  onClick={navigateTo("/")}
                  className="flex items-center p-2 rounded-md hover:bg-gray-100 w-full text-left"
                >
                  <Calendar className="mr-2 h-5 w-5" />
                  <span>Calendar</span>
                </button>
                
                <button 
                  onClick={navigateTo("/my-bookings")}
                  className="flex items-center p-2 rounded-md hover:bg-gray-100 w-full text-left"
                >
                  <BookOpen className="mr-2 h-5 w-5" />
                  <span>My Bookings</span>
                </button>
                
                <button 
                  onClick={navigateTo("/templates")}
                  className="flex items-center p-2 rounded-md hover:bg-gray-100 w-full text-left"
                >
                  <ListTodo className="mr-2 h-5 w-5" />
                  <span>Templates</span>
                </button>
                
                <button 
                  onClick={navigateTo("/studios")}
                  className="flex items-center p-2 rounded-md hover:bg-gray-100 w-full text-left"
                >
                  <Tv className="mr-2 h-5 w-5" />
                  <span>Studios</span>
                </button>
                
                {/* Reports - only shown to non-producers */}
                {user?.role !== "producer" && (
                  <button 
                    onClick={navigateTo("/reports")}
                    className="flex items-center p-2 rounded-md hover:bg-gray-100 w-full text-left"
                  >
                    <BarChart className="mr-2 h-5 w-5" />
                    <span>Reports</span>
                  </button>
                )}
                
                {/* Users - only shown to admins */}
                {user?.role === "admin" && (
                  <button 
                    onClick={navigateTo("/users")}
                    className="flex items-center p-2 rounded-md hover:bg-gray-100 w-full text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>Users</span>
                  </button>
                )}
                
                {/* Producer Management - only shown to site_managers */}
                {user?.role === "site_manager" && (
                  <button 
                    onClick={navigateTo("/producer-management")}
                    className="flex items-center p-2 rounded-md hover:bg-gray-100 w-full text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                    <span>Producers</span>
                  </button>
                )}
                

                
                <button 
                  onClick={navigateTo("/settings")}
                  className="flex items-center p-2 rounded-md hover:bg-gray-100 w-full text-left"
                >
                  <Settings className="mr-2 h-5 w-5" />
                  <span>Settings</span>
                </button>
              </nav>
              
              <div className="mt-auto pt-6">
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleLogout}
                >
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