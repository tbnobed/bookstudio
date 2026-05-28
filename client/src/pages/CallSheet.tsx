import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

interface Studio { id: number; name: string }
interface PcrRoom { id: number; name: string }

function fmtTime(d: Date, tz: string) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).toLowerCase().replace(" ", "");
}
function fmtDate(d: Date, tz: string) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz });
}

export default function CallSheet() {
  const params = useParams<{ id: string }>();
  const bookingId = parseInt(params.id);
  const tz = (import.meta.env.VITE_FACILITY_TIMEZONE as string) || "America/Chicago";

  const { data: booking, isLoading: bookingLoading, isError: bookingError } = useQuery<any>({
    queryKey: ["call-sheet-booking", bookingId],
    queryFn: async () => {
      const r = await fetch(`/api/bookings/${bookingId}`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    enabled: !!bookingId,
  });
  const { data: crewData, isLoading: crewLoading } = useQuery<any>({ queryKey: ["/api/bookings", bookingId, "crew"], queryFn: () => fetch(`/api/bookings/${bookingId}/crew`, { credentials: "include" }).then(r => r.json()), enabled: !!bookingId });
  const { data: bookingStudios = [] } = useQuery<Studio[]>({ queryKey: [`/api/bookings/${bookingId}/studios`], enabled: !!bookingId });
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({ queryKey: ["/api/pcr-rooms"] });
  const { data: siteName } = useQuery<{ siteName: string }>({ queryKey: ["/api/system/site-name"] });

  if (bookingLoading || crewLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading call sheet…</div>;
  }
  if (bookingError || !booking) {
    return <div className="p-8 text-center text-destructive">Booking not found.</div>;
  }
  if (!crewData) {
    return <div className="p-8 text-center text-destructive">Could not load crew.</div>;
  }

  const start = new Date(booking.start);
  const end = new Date(booking.end);
  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  const isHalfDay = hours <= 5;
  const billing = isHalfDay
    ? "BILLING IS A HALF DAY RATE FOR ALL CREW"
    : "BILLING IS A FULL DAY RATE FOR ALL CREW";

  const studioName = bookingStudios.map(s => s.name).join(" + ") || "—";
  const pcr = booking.pcrRoomId ? pcrRooms.find(p => p.id === booking.pcrRoomId) : null;
  const locationLine = `${siteName?.siteName || "Studio"} - ${studioName.toUpperCase()}${pcr ? ` (${pcr.name})` : ""}`;

  const slots = (crewData.slots || []).filter((s: any) => s.crewMemberId && s.status !== "declined");

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white py-6 print:py-0">
      {/* Toolbar (hidden in print) */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between px-4 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="text-sm text-muted-foreground">{fmtDate(start, tz)}</div>
        <Button size="sm" onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
        </Button>
      </div>

      {/* Sheet */}
      <div className="max-w-3xl mx-auto bg-white shadow-md print:shadow-none border border-gray-300 print:border-0 overflow-hidden">
        {/* Header */}
        <div className="bg-[#1e3a5f] text-white text-center py-4 px-4">
          <div className="text-2xl font-bold tracking-wide">{booking.title}</div>
        </div>
        <div className="bg-[#b6cfe6] text-[#1e3a5f] text-center py-2 px-4 font-semibold">
          {locationLine}
        </div>
        <div className="bg-[#d6e4f0] text-[#1e3a5f] flex justify-around py-2 px-4 font-semibold border-b border-gray-300">
          <div>Call Time: <span className="font-bold">{fmtTime(start, tz)}</span></div>
          <div>Wrap Time: <span className="font-bold">{fmtTime(end, tz)}</span></div>
        </div>
        <div className="bg-[#fef9e7] text-center py-2 px-4 text-sm font-bold border-b border-gray-300">
          {billing}
        </div>

        {/* Table */}
        <table className="w-full">
          <thead>
            <tr className="bg-[#cfe2c9] text-left">
              <th className="px-4 py-2 font-bold text-sm border-b border-gray-300 w-1/2">POSITION</th>
              <th className="px-4 py-2 font-bold text-sm border-b border-gray-300">NAME</th>
            </tr>
          </thead>
          <tbody>
            {slots.length === 0 ? (
              <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500">No crew assigned.</td></tr>
            ) : slots.map((s: any, idx: number) => (
              <tr key={s.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#f4f8f3]"}>
                <td className="px-4 py-2 text-sm border-b border-gray-200">{s.position?.name || "—"}</td>
                <td className="px-4 py-2 text-sm border-b border-gray-200">{s.member?.name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer (screen only) */}
        <div className="px-4 py-3 text-xs text-gray-500 border-t border-gray-200 flex justify-between print:hidden">
          <span>{slots.length} crew on call</span>
          <span>Generated {new Date().toLocaleString("en-US", { timeZone: tz })}</span>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
