import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { CallSheetView } from "./CallSheetView";

interface Props {
  bookingId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallSheetDialog({ bookingId, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto p-0 gap-0 bg-card border-2 border-border shadow-2xl ring-1 ring-black/5 dark:ring-white/15">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3 print:hidden">
          <DialogTitle>Call Sheet</DialogTitle>
          <Button size="sm" className="mr-8" onClick={() => window.print()} data-testid="button-print-call-sheet">
            <Printer className="h-4 w-4 mr-1.5" /> Print / Save PDF
          </Button>
        </DialogHeader>
        <div id="call-sheet-print-root" className="p-4">
          {open && <CallSheetView bookingId={bookingId} />}
        </div>
      </DialogContent>
      {open && (
        <style>{`
          @media print {
            @page { size: letter portrait; margin: 0.5in; }
            html, body { background: white !important; }
            body * { visibility: hidden !important; }
            #call-sheet-print-root, #call-sheet-print-root * { visibility: visible !important; }
            #call-sheet-print-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              padding: 0 !important;
            }
            #call-sheet-print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          }
        `}</style>
      )}
    </Dialog>
  );
}
