import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Search, Mail, Phone, DollarSign, Users } from "lucide-react";
import { CrewMember, CrewPosition } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrewPositionsSettings } from "@/components/settings/CrewPositionsSettings";
import { CrewTemplatesSettings } from "@/components/settings/CrewTemplatesSettings";

type EnrichedMember = CrewMember & { positions: CrewPosition[] };

function dollars(cents: number) { return `$${((cents || 0) / 100).toFixed(2)}`; }

export default function CrewRoster() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "site_manager";
  const [editing, setEditing] = useState<EnrichedMember | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<EnrichedMember | null>(null);
  const [search, setSearch] = useState("");

  const { data: members = [], isLoading } = useQuery<EnrichedMember[]>({ queryKey: ["/api/crew/members"] });
  const { data: positions = [] } = useQuery<CrewPosition[]>({ queryKey: ["/api/crew/positions"] });

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) ||
      m.positions.some(p => p.name.toLowerCase().includes(q));
  });

  const delMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crew/members/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crew/members"] });
      toast({ title: "Crew member removed" });
      setDeleting(null);
    },
    onError: (e: any) => toast({ title: "Failed to remove", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="h-7 w-7" /> Crew</h1>
        <p className="text-muted-foreground mt-1">Freelance crew for productions — TDs, camera ops, A1/A2, and more.</p>
      </div>

      <Tabs defaultValue="roster" className="space-y-6">
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="positions">Crew Positions</TabsTrigger>
          <TabsTrigger value="templates">Crew Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-0">
          <div className="flex items-center justify-end mb-4">
            <Button onClick={() => setCreating(true)} data-testid="button-add-crew-member">
              <Plus className="h-4 w-4 mr-2" /> Add Crew Member
            </Button>
          </div>

          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Search by name, email, or position…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              {members.length === 0 ? "No crew yet — add your first freelancer above." : "No matches."}
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map(m => (
            <Card key={m.id} className={m.isActive ? "" : "opacity-60"}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{m.name}</CardTitle>
                    {!m.isActive && <Badge variant="secondary" className="mt-1">Inactive</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(m)} data-testid={`button-edit-${m.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(m)} data-testid={`button-delete-${m.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {m.email}</div>
                {m.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {m.phone}</div>}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>Day: <strong>{dollars(m.dayRateCents)}</strong></span>
                  <span className="text-xs">/ Half: <strong>{dollars(m.halfDayRateCents)}</strong></span>
                </div>
                <div className="flex flex-wrap gap-1 pt-2">
                  {m.positions.length === 0
                    ? <span className="text-xs text-muted-foreground italic">No positions set</span>
                    : m.positions.map(p => <Badge key={p.id} variant="outline" className="text-xs">{p.name}</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="positions" className="mt-0">
          <CrewPositionsSettings />
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          <CrewTemplatesSettings />
        </TabsContent>
      </Tabs>

      {(creating || editing) && (
        <CrewMemberDialog
          member={editing}
          positions={positions}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the crew member from the roster. Their past booking assignments stay intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && delMutation.mutate(deleting.id)} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CrewMemberDialog({ member, positions, onClose }: { member: EnrichedMember | null; positions: CrewPosition[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(member?.name || "");
  const [email, setEmail] = useState(member?.email || "");
  const [phone, setPhone] = useState(member?.phone || "");
  const [dayRate, setDayRate] = useState(member ? (member.dayRateCents / 100).toFixed(2) : "");
  const [halfRate, setHalfRate] = useState(member ? (member.halfDayRateCents / 100).toFixed(2) : "");
  const [notes, setNotes] = useState(member?.notes || "");
  const [isActive, setIsActive] = useState(member?.isActive ?? true);
  const [positionIds, setPositionIds] = useState<number[]>(member?.positions.map(p => p.id) || []);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name, email, phone: phone || null,
        dayRateCents: Math.round(parseFloat(dayRate || "0") * 100),
        halfDayRateCents: Math.round(parseFloat(halfRate || "0") * 100),
        notes: notes || null, isActive, positionIds,
      };
      if (member) return apiRequest("PATCH", `/api/crew/members/${member.id}`, payload);
      return apiRequest("POST", "/api/crew/members", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crew/members"] });
      toast({ title: member ? "Crew member updated" : "Crew member added" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const togglePos = (id: number) => setPositionIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  // group positions by category
  const grouped = positions.reduce<Record<string, CrewPosition[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p); return acc;
  }, {});

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{member ? "Edit Crew Member" : "Add Crew Member"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} data-testid="input-crew-name" /></div>
            <div><Label>Email *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-crew-email" /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div className="flex items-end gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
              <Label htmlFor="active">Active</Label>
            </div>
            <div><Label>Day Rate (USD)</Label><Input type="number" step="0.01" value={dayRate} onChange={e => setDayRate(e.target.value)} data-testid="input-crew-day-rate" /></div>
            <div><Label>Half-Day Rate (USD)</Label><Input type="number" step="0.01" value={halfRate} onChange={e => setHalfRate(e.target.value)} data-testid="input-crew-half-rate" /></div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="mb-2 block">Qualified Positions</Label>
            <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-3">
              {Object.entries(grouped).map(([cat, list]) => (
                <div key={cat}>
                  <div className="text-xs uppercase text-muted-foreground font-semibold mb-1">{cat}</div>
                  <div className="grid grid-cols-2 gap-1">
                    {list.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={positionIds.includes(p.id)} onCheckedChange={() => togglePos(p.id)} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {positions.length === 0 && <p className="text-sm text-muted-foreground">No positions defined yet. Add them in Settings → Crew Positions.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name || !email} data-testid="button-save-crew">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
