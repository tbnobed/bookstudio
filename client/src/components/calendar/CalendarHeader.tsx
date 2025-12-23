import { Header } from "@/components/layout/Header";

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: "day" | "week" | "month" | "timeline";
  onViewChange: (view: "day" | "week" | "month" | "timeline") => void;
  selectedStudioIds: number[];
  onStudioFilterChange: (studioIds: number[]) => void;
  useMondayWeeks?: boolean;
}

export default function CalendarHeader({
  currentDate,
  onDateChange,
  view,
  onViewChange,
  selectedStudioIds,
  onStudioFilterChange,
  useMondayWeeks,
}: CalendarHeaderProps) {
  return (
    <Header
      currentDate={currentDate}
      onDateChange={onDateChange}
      view={view}
      onViewChange={onViewChange}
      onStudioFilterChange={onStudioFilterChange}
      selectedStudioIds={selectedStudioIds}
      useMondayWeeks={useMondayWeeks}
    />
  );
}
