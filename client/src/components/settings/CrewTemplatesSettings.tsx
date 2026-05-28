import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import type { CrewPosition, CrewTemplate, BookingType } from "@shared/schema";

type Slot = { positionId: number; quantity: number };
type EnrichedTemplate = CrewTemplate & { slots: Slot[] };

export function CrewTemplatesSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<EnrichedTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: templates = [] } = useQuery<EnrichedTemplate[]>({ queryKey: ["/api/crew/templates"] });
  const { data: positions = [] } = useQuery<CrewPosition[]>({ queryKey: ["/api/crew/positions"] });
  const { data: bookingTypes = [] } = useQuery<BookingType[]>({ queryKey: ["/api/booking-types"] });

  const positionName = (id: number) => positions.find(p => p.id === id)?.name || "?";
  const typeName = (id?: number | null) => id ? bookingTypes.find(t => t.id === id)?.name : null;

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crew/templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crew/templates"] }); toast({ title: "Template removed" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Reusable crew packages applied to bookings in one click.</p>
        <Button onClick={() => setCreating(true)} size="sm" data-testid="button-add-template"><Plus className="h-4 w-4 mr-1" /> Add Template</Button>
      </div>

      {templates.length === 0
        ? <p className="text-center py-8 text-muted-foreground">No templates yet.</p>
        : <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="border rounded-md p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
                  {typeName(t.bookingTypeId) && <Badge variant="outline" className="mt-1 text-xs">For: {typeName(t.bookingTypeId)}</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.slots.map((s, i) => (
                  <Badge key={i} variant="secondary">{s.quantity}× {positionName(s.positionId)}</Badge>
                ))}
                {t.slots.length === 0 && <span className="text-xs text-muted-foreground">No slots</span>}
              </div>
            </div>
          ))}
        </div>}

      {(creating || editing) && (
        <TemplateDialog template={editing} positions={positions} bookingTypes={bookingTypes} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
    </div>
  );
}

function TemplateDialog({ template, positions, bookingTypes, onClose }: {
  template: EnrichedTemplate | null; positions: CrewPosition[]; bookingTypes: BookingType[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [bookingTypeId, setBookingTypeId] = useState<string>(template?.bookingTypeId?.toString() || "none");
  const [slots, setSlots] = useState<Slot[]>(template?.slots || []);
  const [newPosId, setNewPosId] = useState<string>("");

  const addSlot = () => {
    if (!newPosId) return;
    const pid = parseInt(newPosId);
    if (slots.some(s => s.positionId === pid)) {
      setSlots(slots.map(s => s.positionId === pid ? { ...s, quantity: s.quantity + 1 } : s));
    } else {
      setSlots([...slots, { positionId: pid, quantity: 1 }]);
    }
    setNewPosId("");
  };

  const save = useMutation({
    mutationFn: () => {
      const payload: any = {
        name, description: description || null,
        bookingTypeId: bookingTypeId === "none" ? null : parseInt(bookingTypeId),
        slots,
      };
      if (template) return apiRequest("PATCH", `/api/crew/templates/${template.id}`, payload);
      return apiRequest("POST", "/api/crew/templates", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crew/templates"] });
      toast({ title: template ? "Template updated" : "Template created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{template ? "Edit Template" : "Add Crew Template"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} data-testid="input-template-name" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
          <div>
            <Label>Tied to Booking Type (optional)</Label>
            <Select value={bookingTypeId} onValueChange={setBookingTypeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None (general) —</SelectItem>
                {bookingTypes.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="border-t pt-3">
            <Label className="mb-2 block">Position Slots</Label>
            <div className="space-y-1.5 mb-2">
              {slots.map((s, i) => (
                <div key={i} className="flex items-center gap-2 border rounded px-2 py-1">
                  <Input type="number" min={1} value={s.quantity} onChange={e => {
                    const q = parseInt(e.target.value) || 1;
                    setSlots(slots.map((x, j) => j === i ? { ...x, quantity: q } : x));
                  }} className="w-16" />
                  <span className="flex-1">{positions.find(p => p.id === s.positionId)?.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => setSlots(slots.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {slots.length === 0 && <p className="text-xs text-muted-foreground">No slots yet.</p>}
            </div>
            <div className="flex gap-2">
              <Select value={newPosId} onValueChange={setNewPosId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Add a position…" /></SelectTrigger>
                <SelectContent>
                  {positions.filter(p => p.isActive).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addSlot} disabled={!newPosId}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
