import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Studio, Booking, BookingStudio } from "@shared/schema";
import { calculateStudioStatus } from "@/lib/studioUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StudioStatusSummaryProps {
  studios: Studio[];
  bookings: Booking[];
  bookingStudioLinks: BookingStudio[];
  currentDate: Date;
  onFilterByStatus?: (studioIds: number[]) => void;
}

type StudioStatus = "available" | "in-use" | "maintenance";

interface StatusGroup {
  count: number;
  studios: Studio[];
}

export default function StudioStatusSummary({
  studios,
  bookings,
  bookingStudioLinks,
  currentDate,
  onFilterByStatus,
}: StudioStatusSummaryProps) {
  // Use actual current time for real-time status display, not the calendar viewing date
  const now = useMemo(() => new Date(), []);
  
  const statusGroups = useMemo(() => {
    const groups: Record<StudioStatus, StatusGroup> = {
      available: { count: 0, studios: [] },
      "in-use": { count: 0, studios: [] },
      maintenance: { count: 0, studios: [] },
    };

    studios.forEach((studio) => {
      const status = calculateStudioStatus(studio, bookings, now, bookingStudioLinks);
      if (status === "available") {
        groups.available.count++;
        groups.available.studios.push(studio);
      } else if (status === "in-use") {
        groups["in-use"].count++;
        groups["in-use"].studios.push(studio);
      } else if (status === "maintenance") {
        groups.maintenance.count++;
        groups.maintenance.studios.push(studio);
      }
    });

    return groups;
  }, [studios, bookings, bookingStudioLinks, now]);

  const handleStatusClick = (status: StudioStatus) => {
    if (onFilterByStatus) {
      const studioIds = statusGroups[status].studios.map((s) => s.id);
      onFilterByStatus(studioIds);
    }
  };

  const statusConfig = [
    {
      key: "available" as StudioStatus,
      label: "AVAILABLE",
      ringColor: "ring-emerald-400",
      bgHover: "hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
      textColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "in-use" as StudioStatus,
      label: "IN-USE",
      ringColor: "ring-rose-400",
      bgHover: "hover:bg-rose-50 dark:hover:bg-rose-950/30",
      textColor: "text-rose-600 dark:text-rose-400",
    },
    {
      key: "maintenance" as StudioStatus,
      label: "MAINT.",
      ringColor: "ring-amber-400",
      bgHover: "hover:bg-amber-50 dark:hover:bg-amber-950/30",
      textColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="flex items-center justify-center gap-3">
      {statusConfig.map((config) => {
        const group = statusGroups[config.key];
        
        return (
          <Tooltip key={config.key}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleStatusClick(config.key)}
                className={cn(
                  "flex flex-col items-center justify-center",
                  "w-12 h-12 lg:w-14 lg:h-14",
                  "rounded-full bg-white dark:bg-gray-800",
                  "ring-2 ring-offset-1 ring-offset-white dark:ring-offset-gray-900",
                  config.ringColor,
                  config.bgHover,
                  "transition-all duration-200 cursor-pointer",
                  "shadow-sm hover:shadow-md"
                )}
                data-testid={`status-badge-${config.key}`}
              >
                <span className="text-base lg:text-lg font-bold text-gray-800 dark:text-white">
                  {group.count}
                </span>
                <span className={cn("text-[7px] lg:text-[8px] font-semibold tracking-wide", config.textColor)}>
                  {config.label}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent 
              side="bottom" 
              className="max-w-xs p-3"
              data-testid={`tooltip-${config.key}`}
            >
              <div className="space-y-1">
                <p className={cn("font-semibold text-sm", config.textColor)}>
                  {config.label} ({group.count})
                </p>
                {group.studios.length > 0 ? (
                  <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5 max-h-40 overflow-y-auto">
                    {group.studios.map((studio) => (
                      <li key={studio.id} className="truncate">
                        • {studio.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    No studios
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
