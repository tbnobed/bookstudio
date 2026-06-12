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
import { Plus, Pencil, Trash2, Search, Mail, Phone, DollarSign, Users, Calendar, ChevronDown, CheckCircle2, Clock, XCircle, CircleDashed } from "lucide-react";
import { CrewMember, CrewPosition, Studio } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrewPositionsSettings } from "@/components/settings/CrewPositionsSettings";
import { CrewTemplatesSettings } from "@/components/settings/CrewTemplatesSettings";
import { formatDateTimeRange } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { useLocation } from "wouter";

type EnrichedMember = CrewMember & { positions: CrewPosition[] };

type AssignmentSlot = {
  id: number;
  positionId: number;
  positionName: string;
  category: string;
  crewMemberId: number | null;
  memberName: string | null;
  status: "unfilled" | "pending" | "confirmed" | "declined";
  invitedAt: string | null;
  respondedAt: string | null;
  declineReason: string | null;
};
type AssignmentBooking = {
  booking: { id: number; title: string; start: string; end: string; studioId: number | null; type: string; status: string };
  slots: AssignmentSlot[];
  counts: { required: number; unfilled: number; pending: number; confirmed: number; declined: number };
};

function dollars(cents: number) { return `$${((cents || 0) / 100).toFixed(2)}`; }

export default function CrewRoster() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "site_manager";
  const canSeeRates = ["admin", "site_manager", "production_coordinator"].includes(user?.role ?? "");
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
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
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
                {canSeeRates && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>Day: <strong>{dollars(m.dayRateCents)}</strong></span>
                    <span className="text-xs">/ Half: <strong>{dollars(m.halfDayRateCents)}</strong></span>
                  </div>
                )}
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

        <TabsContent value="assignments" className="mt-0">
          <CrewAssignments />
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
          canSeeRates={canSeeRates}
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

function CrewMemberDialog({ member, positions, canSeeRates, onClose }: { member: EnrichedMember | null; positions: CrewPosition[]; canSeeRates: boolean; onClose: () => void }) {
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
      const payload: any = {
        name, email, phone: phone || null,
        notes: notes || null, isActive, positionIds,
      };
      if (canSeeRates) {
        payload.dayRateCents = Math.round(parseFloat(dayRate || "0") * 100);
        payload.halfDayRateCents = Math.round(parseFloat(halfRate || "0") * 100);
      }
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
            {canSeeRates && (
              <>
                <div><Label>Day Rate (USD)</Label><Input type="number" step="0.01" value={dayRate} onChange={e => setDayRate(e.target.value)} data-testid="input-crew-day-rate" /></div>
                <div><Label>Half-Day Rate (USD)</Label><Input type="number" step="0.01" value={halfRate} onChange={e => setHalfRate(e.target.value)} data-testid="input-crew-half-rate" /></div>
              </>
            )}
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

const SLOT_STATUS_META: Record<AssignmentSlot["status"], { label: string; icon: typeof Clock; className: string; dot: string }> = {
  unfilled: { label: "Unfilled", icon: CircleDashed, className: "text-muted-foreground", dot: "bg-gray-400" },
  pending: { label: "Invited", icon: Clock, className: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, className: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
  declined: { label: "Declined", icon: XCircle, className: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
};

type AssignmentFilter = "all" | "needs_crew" | "awaiting" | "staffed";

function CrewAssignments() {
  const [filter, setFilter] = useState<AssignmentFilter>("all");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const [, setLocation] = useLocation();

  const { data: assignments = [], isLoading } = useQuery<AssignmentBooking[]>({ queryKey: ["/api/crew/assignments"] });
  const { data: studios = [] } = useQuery<Studio[]>({ queryKey: ["/api/studios"] });
  const studioName = (id: number | null) => studios.find(s => s.id === id)?.name ?? "—";

  const isFullyStaffed = (a: AssignmentBooking) => a.counts.required > 0 && a.counts.confirmed === a.counts.required;

  const filtered = assignments.filter(a => {
    if (filter === "needs_crew") return a.counts.unfilled > 0 || a.counts.declined > 0;
    if (filter === "awaiting") return a.counts.pending > 0;
    if (filter === "staffed") return isFullyStaffed(a);
    return true;
  });

  const totals = {
    all: assignments.length,
    needs_crew: assignments.filter(a => a.counts.unfilled > 0 || a.counts.declined > 0).length,
    awaiting: assignments.filter(a => a.counts.pending > 0).length,
    staffed: assignments.filter(isFullyStaffed).length,
  };

  const FILTERS: { key: AssignmentFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "needs_crew", label: "Needs crew" },
    { key: "awaiting", label: "Awaiting response" },
    { key: "staffed", label: "Fully staffed" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map(f => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
            data-testid={`filter-assignments-${f.key}`}
          >
            {f.label}
            <Badge variant="secondary" className="ml-2">{totals[f.key]}</Badge>
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {assignments.length === 0
            ? "No upcoming bookings have crew slots yet. Add crew to a booking from its Crew tab."
            : "No bookings match this filter."}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const open = !!expanded[a.booking.id];
            const fullyStaffed = isFullyStaffed(a);
            return (
              <Card key={a.booking.id} data-testid={`assignment-${a.booking.id}`}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => setExpanded(prev => ({ ...prev, [a.booking.id]: !open }))}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(prev => ({ ...prev, [a.booking.id]: !open })); }
                  }}
                  className="w-full text-left cursor-pointer"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{a.booking.title}</CardTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDateTimeRange(a.booking.start, a.booking.end)}</span>
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {studioName(a.booking.studioId)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setLocation(`/bookings/${a.booking.id}/call-sheet`); }}
                          onKeyDown={(e) => e.stopPropagation()}
                          data-testid={`button-call-sheet-${a.booking.id}`}
                        >
                          <FileText className="h-4 w-4 mr-1.5" /> Call Sheet
                        </Button>
                        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", open && "rotate-180")} />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={cn(
                        "text-sm font-medium",
                        fullyStaffed ? "text-green-600 dark:text-green-400" : "text-foreground",
                      )}>
                        {a.counts.confirmed}/{a.counts.required} confirmed
                      </span>
                      {a.counts.unfilled > 0 && <StatusPill status="unfilled" count={a.counts.unfilled} />}
                      {a.counts.pending > 0 && <StatusPill status="pending" count={a.counts.pending} />}
                      {a.counts.confirmed > 0 && <StatusPill status="confirmed" count={a.counts.confirmed} />}
                      {a.counts.declined > 0 && <StatusPill status="declined" count={a.counts.declined} />}
                    </div>
                  </CardHeader>
                </div>

                {open && (
                  <CardContent className="pt-0">
                    <div className="border-t pt-3 space-y-2">
                      {a.slots.map(s => {
                        const meta = SLOT_STATUS_META[s.status];
                        const Icon = meta.icon;
                        return (
                          <div key={s.id} className="flex items-start justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{s.positionName}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {s.memberName ?? <span className="italic">No one assigned</span>}
                                {s.status === "declined" && s.declineReason && (
                                  <span className="text-red-600 dark:text-red-400"> — {s.declineReason}</span>
                                )}
                              </div>
                            </div>
                            <span className={cn("flex shrink-0 items-center gap-1.5 text-xs font-medium", meta.className)}>
                              <Icon className="h-3.5 w-3.5" /> {meta.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, count }: { status: AssignmentSlot["status"]; count: number }) {
  const meta = SLOT_STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
      {count} {meta.label.toLowerCase()}
    </span>
  );
}
