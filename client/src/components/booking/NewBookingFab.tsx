import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDevice } from "@/hooks/use-mobile";
import ResponsiveBookingModal from "./ResponsiveBookingModal";
import { useCalendarContext } from "@/contexts/CalendarContext";

interface NewBookingFabProps {
  className?: string;
}

export default function NewBookingFab({ className }: NewBookingFabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isSmallScreen } = useDevice();
  const { selectedDate } = useCalendarContext();

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "fixed z-40 flex items-center gap-2 rounded-full shadow-xl transition-all duration-300",
          "bg-gradient-to-r from-blue-700 to-indigo-700 text-white",
          "hover:from-blue-800 hover:to-indigo-800 hover:shadow-2xl hover:scale-105",
          "active:scale-95",
          "focus:outline-none focus:ring-4 focus:ring-blue-500/30",
          isSmallScreen 
            ? "bottom-24 right-4 p-4" 
            : "bottom-8 right-8 px-5 py-3.5",
          className
        )}
        aria-label="Create new booking"
        data-testid="fab-new-booking"
      >
        <Plus className={cn("flex-shrink-0", isSmallScreen ? "h-6 w-6" : "h-5 w-5")} />
        {!isSmallScreen && (
          <span className="font-semibold text-sm whitespace-nowrap">New Booking</span>
        )}
      </button>

      <ResponsiveBookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate || new Date()}
      />
    </>
  );
}
