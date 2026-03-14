import { useMemo, useState, useEffect } from "react";
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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

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
      onFilterByStatus(statusGroups[status].studios.map((s) => s.id));
    }
  };

  const statusConfig = [
    {
      key: "available" as StudioStatus,
      label: "AVAIL",
      textColor: "text-emerald-600 dark:text-emerald-400",
      countColor: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-400 dark:border-emerald-500",
      bg: "from-emerald-50 to-green-50 dark:from-emerald-950/60 dark:to-green-950/40",
      glow: "shadow-[0_0_14px_rgba(52,211,153,0.45)] hover:shadow-[0_0_22px_rgba(52,211,153,0.65)]",
      pulse: false,
    },
    {
      key: "in-use" as StudioStatus,
      label: "ON AIR",
      textColor: "text-rose-600 dark:text-rose-400",
      countColor: "text-rose-700 dark:text-rose-300",
      border: "border-rose-400 dark:border-rose-500",
      bg: "from-rose-50 to-red-50 dark:from-rose-950/60 dark:to-red-950/40",
      glow: "shadow-[0_0_14px_rgba(251,113,133,0.45)] hover:shadow-[0_0_22px_rgba(251,113,133,0.65)]",
      pulse: true,
    },
    {
      key: "maintenance" as StudioStatus,
      label: "MAINT",
      textColor: "text-amber-600 dark:text-amber-400",
      countColor: "text-amber-700 dark:text-amber-300",
      border: "border-amber-400 dark:border-amber-500",
      bg: "from-amber-50 to-yellow-50 dark:from-amber-950/60 dark:to-yellow-950/40",
      glow: "shadow-[0_0_14px_rgba(251,191,36,0.4)] hover:shadow-[0_0_22px_rgba(251,191,36,0.6)]",
      pulse: false,
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2">
      {statusConfig.map((config) => {
        const group = statusGroups[config.key];
        const isActive = config.pulse && group.count > 0;

        return (
          <Tooltip key={config.key}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleStatusClick(config.key)}
                className={cn(
                  "relative flex flex-col items-center justify-center",
                  "w-13 h-13 lg:w-15 lg:h-15",
                  "w-[52px] h-[52px] lg:w-[60px] lg:h-[60px]",
                  "rounded-full border-2",
                  "bg-gradient-to-br",
                  config.bg,
                  config.border,
                  config.glow,
                  "transition-all duration-300 cursor-pointer hover:scale-110 active:scale-95",
                )}
                data-testid={`status-badge-${config.key}`}
              >
                {/* Pulsing ring for active on-air studios */}
                {isActive && (
                  <span className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-40" />
                )}

                {/* Outer decorative ring */}
                <span className={cn(
                  "absolute inset-[-4px] rounded-full border opacity-20",
                  config.border
                )} />

                <span className={cn("text-lg lg:text-xl font-black leading-none tracking-tight", config.countColor)}>
                  {group.count}
                </span>
                <span className={cn("text-[7px] font-bold tracking-widest mt-0.5", config.textColor)}>
                  {config.label}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-xl p-3"
              data-testid={`tooltip-${config.key}`}
            >
              <div className="space-y-1">
                <p className={cn("font-semibold text-sm", config.textColor)}>
                  {config.label} ({group.count})
                </p>
                {group.studios.length > 0 ? (
                  <div className="grid grid-cols-4 gap-x-3 gap-y-0.5 text-xs text-gray-600 dark:text-gray-300">
                    {group.studios.map((studio) => (
                      <span key={studio.id} className="truncate">• {studio.name}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">No studios</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
