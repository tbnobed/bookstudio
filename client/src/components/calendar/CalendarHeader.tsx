import { Header } from "@/components/layout/Header";

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: "day" | "week" | "month";
  onViewChange: (view: "day" | "week" | "month") => void;
  selectedStudioIds: number[];
  onStudioFilterChange: (studioIds: number[]) => void;
}

export default function CalendarHeader({
  currentDate,
  onDateChange,
  view,
  onViewChange,
  selectedStudioIds,
  onStudioFilterChange,
}: CalendarHeaderProps) {
  return (
    <Header
      currentDate={currentDate}
      onDateChange={onDateChange}
      view={view}
      onViewChange={onViewChange}
      onStudioFilterChange={onStudioFilterChange}
      selectedStudioIds={selectedStudioIds}
    />
  );
}
