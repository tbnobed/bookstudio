import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Calendar, BookOpen, ListTodo, Settings, Menu, X, PlusCircle, Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import BookingModal from "@/components/booking/BookingModal";
import AlertModal from "@/components/alerts/AlertModal";

export default function MobileNavbar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewAlertModalOpen, setIsNewAlertModalOpen] = useState(false);
  
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

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex items-center justify-around h-16">
          {/* Calendar Link */}
          <Link href="/">
            <a className={`flex flex-col items-center justify-center w-full h-full ${location === "/" ? "text-blue-600" : "text-gray-600"}`}>
              <Calendar size={20} />
              <span className="text-xs mt-1">Calendar</span>
            </a>
          </Link>
          
          {/* My Bookings Link */}
          <Link href="/my-bookings">
            <a className={`flex flex-col items-center justify-center w-full h-full ${location === "/my-bookings" ? "text-blue-600" : "text-gray-600"}`}>
              <BookOpen size={20} />
              <span className="text-xs mt-1">My Bookings</span>
            </a>
          </Link>
          
          {/* Add Booking Button */}
          <div className="flex flex-col items-center justify-center w-full h-full">
            <button 
              onClick={() => setIsNewBookingModalOpen(true)}
              className="rounded-full bg-blue-600 p-3 text-white shadow-md"
            >
              <PlusCircle size={24} />
            </button>
          </div>
          
          {/* Add Alert */}
          <div className="flex flex-col items-center justify-center w-full h-full">
            <button 
              onClick={() => setIsNewAlertModalOpen(true)}
              className="flex flex-col items-center justify-center text-gray-600"
            >
              <Bell size={20} />
              <span className="text-xs mt-1">Alert</span>
            </button>
          </div>
          
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
              
              {/* Navigation Links */}
              <nav className="flex flex-col space-y-4">
                <Link href="/">
                  <a className="flex items-center p-2 rounded-md hover:bg-gray-100">
                    <Calendar className="mr-2 h-5 w-5" />
                    <span>Calendar</span>
                  </a>
                </Link>
                <Link href="/my-bookings">
                  <a className="flex items-center p-2 rounded-md hover:bg-gray-100">
                    <BookOpen className="mr-2 h-5 w-5" />
                    <span>My Bookings</span>
                  </a>
                </Link>
                <Link href="/templates">
                  <a className="flex items-center p-2 rounded-md hover:bg-gray-100">
                    <ListTodo className="mr-2 h-5 w-5" />
                    <span>Templates</span>
                  </a>
                </Link>
                {user?.role === "admin" && (
                  <Link href="/users">
                    <a className="flex items-center p-2 rounded-md hover:bg-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span>Users</span>
                    </a>
                  </Link>
                )}
                <Link href="/settings">
                  <a className="flex items-center p-2 rounded-md hover:bg-gray-100">
                    <Settings className="mr-2 h-5 w-5" />
                    <span>Settings</span>
                  </a>
                </Link>
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
      <BookingModal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        selectedDate={new Date()}
      />
      
      <AlertModal
        isOpen={isNewAlertModalOpen}
        onClose={() => setIsNewAlertModalOpen(false)}
        selectedDate={new Date()}
      />
    </>
  );
}