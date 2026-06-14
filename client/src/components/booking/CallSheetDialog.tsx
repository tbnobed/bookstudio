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
      <DialogContent data-call-sheet-dialog className="sm:max-w-md max-h-[85vh] overflow-y-auto p-0 gap-0 bg-card border-2 border-border shadow-2xl ring-1 ring-black/5 dark:ring-white/15">
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
            html, body { background: white !important; height: auto !important; overflow: visible !important; }
            body * { visibility: hidden !important; }
            #call-sheet-print-root, #call-sheet-print-root * { visibility: visible !important; }
            /* Hide the dialog backdrop so it doesn't paint over the page */
            [data-radix-dialog-overlay] { display: none !important; }
            /* Neutralize the Radix dialog wrapper: it is fixed + transformed +
               overflow-clipped, which makes the print content render blank.
               Reset it so the call sheet flows normally onto the page. */
            [data-call-sheet-dialog] {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              transform: none !important;
              width: 100% !important;
              max-width: 100% !important;
              max-height: none !important;
              height: auto !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              border: 0 !important;
              box-shadow: none !important;
              background: white !important;
            }
            #call-sheet-print-root {
              position: static !important;
              width: 100% !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            #call-sheet-print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          }
        `}</style>
      )}
    </Dialog>
  );
}
