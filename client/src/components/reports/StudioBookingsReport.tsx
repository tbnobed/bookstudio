import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking, Studio, BookingStudio } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import {
  formatDate,
  formatTimeRange,
  formatDateForForm,
  createFacilityDate,
} from "@/lib/dateUtils";

const PAGE_SIZE = 25;

function toFacilityRange(dateStr: string, endOfDay: boolean): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return endOfDay
    ? createFacilityDate(y, m - 1, d, 23, 59, 59)
    : createFacilityDate(y, m - 1, d, 0, 0, 0);
}

function formatBookingType(type: string) {
  return type
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function StudioBookingsReport() {
  const now = new Date();
  const defaultStart = formatDateForForm(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const defaultEnd = formatDateForForm(now);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [selectedStudioIds, setSelectedStudioIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);

  const [applied, setApplied] = useState<{
    start: string;
    end: string;
    studioIds: number[];
  } | null>(null);

  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  const { data: bookingStudios = [] } = useQuery<BookingStudio[]>({
    queryKey: ["/api/booking-studios"],
  });

  const rangeStartISO = applied ? toFacilityRange(applied.start, false).toISOString() : "";
  const rangeEndISO = applied ? toFacilityRange(applied.end, true).toISOString() : "";

  const { data: bookings = [], isFetching } = useQuery<Booking[]>({
    queryKey: [`/api/bookings?start=${rangeStartISO}&end=${rangeEndISO}`],
    enabled: !!applied,
  });

  const studioNameById = useMemo(() => {
    const map: Record<number, string> = {};
    studios.forEach((s) => (map[s.id] = s.name));
    return map;
  }, [studios]);

  // booking id -> studio ids (junction + legacy single studio)
  const studioIdsByBooking = useMemo(() => {
    const map: Record<number, number[]> = {};
    bookingStudios.forEach((bs) => {
      if (!map[bs.bookingId]) map[bs.bookingId] = [];
      if (!map[bs.bookingId].includes(bs.studioId)) map[bs.bookingId].push(bs.studioId);
    });
    return map;
  }, [bookingStudios]);

  const getBookingStudioIds = (b: Booking): number[] => {
    const fromJunction = studioIdsByBooking[b.id] || [];
    if (fromJunction.length > 0) return fromJunction;
    return b.studioId ? [b.studioId] : [];
  };

  const filtered = useMemo(() => {
    if (!applied) return [];
    const selected = new Set(applied.studioIds);
    const rows = bookings.filter((b) => {
      if (selected.size === 0) return false;
      return getBookingStudioIds(b).some((id) => selected.has(id));
    });
    return rows.sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, applied, studioIdsByBooking]);

  // studio-hours across the selected studios only
  const totalStudioHours = useMemo(() => {
    if (!applied) return 0;
    const selected = new Set(applied.studioIds);
    return filtered.reduce((total, b) => {
      const hrs =
        (new Date(b.end).getTime() - new Date(b.start).getTime()) /
        (1000 * 60 * 60);
      const matches = getBookingStudioIds(b).filter((id) => selected.has(id)).length;
      return total + hrs * matches;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, applied]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedStudioLabel = (b: Booking) => {
    const selected = applied ? new Set(applied.studioIds) : new Set<number>();
    return getBookingStudioIds(b)
      .filter((id) => selected.has(id))
      .map((id) => studioNameById[id] || `Studio ${id}`)
      .join(", ");
  };

  const runReport = () => {
    setApplied({ start: startDate, end: endDate, studioIds: [...selectedStudioIds] });
    setPage(1);
  };

  const toggleStudio = (id: number, checked: boolean) => {
    setSelectedStudioIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const exportCsv = () => {
    if (!applied || filtered.length === 0) return;
    const header = ["Title", "Type", "Studio(s)", "Date", "Time", "Status"];
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = filtered.map((b) =>
      [
        b.title,
        formatBookingType(b.type),
        selectedStudioLabel(b),
        formatDate(b.start),
        formatTimeRange(b.start, b.end),
        b.status || "confirmed",
      ]
        .map(escape)
        .join(",")
    );
    const csv = [header.map(escape).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studio-bookings_${applied.start}_to_${applied.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const validRange = startDate <= endDate;
  const canRun = selectedStudioIds.length > 0 && validRange;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5" /> Studio Bookings by Date Range
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="report-start">Start date</Label>
              <Input
                id="report-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-end">End date</Label>
              <Input
                id="report-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {!validRange && (
            <p className="text-sm text-red-600">End date must be on or after the start date.</p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Studios</Label>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setSelectedStudioIds(studios.map((s) => s.id))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={() => setSelectedStudioIds([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-md border p-3 max-h-48 overflow-auto">
              {studios.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedStudioIds.includes(s.id)}
                    onCheckedChange={(c) => toggleStudio(s.id, c === true)}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
              {studios.length === 0 && (
                <span className="text-sm text-muted-foreground">No studios found.</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={runReport} disabled={!canRun}>
              {isFetching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…
                </>
              ) : (
                "Run report"
              )}
            </Button>
            {applied && filtered.length > 0 && (
              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {applied && (
        <Card>
          <CardHeader>
            <CardTitle>
              Results
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {filtered.length} booking{filtered.length === 1 ? "" : "s"} ·{" "}
                {totalStudioHours.toFixed(1)} studio hours
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isFetching ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading bookings…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No bookings found for the selected studios and date range.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-auto max-h-[55vh] rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-card">
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Title</th>
                        <th className="text-left py-3 px-4 font-medium">Type</th>
                        <th className="text-left py-3 px-4 font-medium">Studio(s)</th>
                        <th className="text-left py-3 px-4 font-medium">Date</th>
                        <th className="text-left py-3 px-4 font-medium">Time</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((b) => (
                        <tr
                          key={b.id}
                          className="border-b hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-4">{b.title}</td>
                          <td className="py-3 px-4">{formatBookingType(b.type)}</td>
                          <td className="py-3 px-4">{selectedStudioLabel(b)}</td>
                          <td className="py-3 px-4">{formatDate(b.start)}</td>
                          <td className="py-3 px-4">{formatTimeRange(b.start, b.end)}</td>
                          <td className="py-3 px-4 capitalize">{b.status || "confirmed"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Showing {(safePage - 1) * PAGE_SIZE + 1}–
                      {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
                      {filtered.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-muted-foreground">
                        Page {safePage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
