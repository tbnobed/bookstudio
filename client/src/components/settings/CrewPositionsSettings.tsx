import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { CrewPosition } from "@shared/schema";

const CATEGORIES = ["direction", "camera", "technical", "audio", "lighting", "graphics", "talent", "other"];
const PAGE_SIZE = 12;

export function CrewPositionsSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CrewPosition | null>(null);
  const [creating, setCreating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { data: positions = [] } = useQuery<CrewPosition[]>({ queryKey: ["/api/crew/positions"] });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crew/positions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crew/positions"] }); setCurrentPage(1); toast({ title: "Position removed" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const sorted = [...positions].sort((a, b) => {
    const ca = CATEGORIES.indexOf(a.category), cb = CATEGORIES.indexOf(b.category);
    if (ca !== cb) return (ca === -1 ? 999 : ca) - (cb === -1 ? 999 : cb);
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const grouped = pageItems.reduce<Record<string, CrewPosition[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p); return acc;
  }, {});

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Crew position types used across the roster and templates.</p>
        <Button onClick={() => setCreating(true)} size="sm" data-testid="button-add-position"><Plus className="h-4 w-4 mr-1" /> Add Position</Button>
      </div>
      {positions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No positions defined yet. Add your first one above.</p>
      ) : (
        <div className="space-y-4 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <h4 className="text-sm uppercase font-semibold text-muted-foreground mb-2">{cat}</h4>
              <div className="grid gap-1.5">
                {list.map(p => (
                  <div key={p.id} className="flex items-center justify-between border rounded px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {!p.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} positions
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(1)} disabled={page === 1}>«</Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "...")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <Button key={item} variant={page === item ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setCurrentPage(item as number)}>{item}</Button>
                )
              )}
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(totalPages)} disabled={page === totalPages}>»</Button>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <PositionDialog position={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
    </div>
  );
}

function PositionDialog({ position, onClose }: { position: CrewPosition | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(position?.name || "");
  const [category, setCategory] = useState(position?.category || "other");
  const [sortOrder, setSortOrder] = useState(position?.sortOrder?.toString() || "0");
  const [isActive, setIsActive] = useState(position?.isActive ?? true);

  const save = useMutation({
    mutationFn: () => {
      const payload = { name, category, sortOrder: parseInt(sortOrder || "0"), isActive };
      if (position) return apiRequest("PATCH", `/api/crew/positions/${position.id}`, payload);
      return apiRequest("POST", "/api/crew/positions", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crew/positions"] });
      toast({ title: position ? "Position updated" : "Position created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{position ? "Edit Position" : "Add Position"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} data-testid="input-position-name" /></div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Sort Order</Label><Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} /></div>
          <div className="flex items-center gap-2">
            <input id="active" type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            <Label htmlFor="active">Active</Label>
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
