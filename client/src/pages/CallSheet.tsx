import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { CallSheetView } from "@/components/booking/CallSheetView";

export default function CallSheet() {
  const [, params] = useRoute<{ id: string }>("/bookings/:id/call-sheet");
  const bookingId = params ? parseInt(params.id) : NaN;

  if (!bookingId) {
    return <div className="p-8 text-center text-destructive">Booking not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white py-6 print:py-0">
      {/* Toolbar (hidden in print) */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between px-4 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button size="sm" onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
        </Button>
      </div>

      <div className="max-w-3xl mx-auto">
        <CallSheetView bookingId={bookingId} />
      </div>

      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          html, body { background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
