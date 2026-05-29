import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Mail, AlertTriangle, CheckCircle2, XCircle, Clock, UserPlus, FileText, DollarSign, Printer } from "lucide-react";
import type { CrewMember, CrewPosition, CrewTemplate } from "@shared/schema";

function dollars(c: number) { return `$${((c || 0) / 100).toFixed(2)}`; }

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  unfilled:  { label: "Unfilled",  icon: UserPlus,     cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600" },
  pending:   { label: "Invited",   icon: Clock,        cls: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" },
  declined:  { label: "Declined",  icon: XCircle,      cls: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30" },
};

interface Props { booking: any; }

export function BookingCrewTab({ booking }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const bookingId = booking?.id;

  const { data: crewData = { slots: [], totals: { cents: 0, defaultRateType: "day", hours: 0 } } } = useQuery<any>({
    queryKey: ["/api/bookings", bookingId, "crew"],
    queryFn: () => fetch(`/api/bookings/${bookingId}/crew`, { credentials: "include" }).then(r => r.json()),
    enabled: !!bookingId,
  });
  const { data: positions = [] } = useQuery<CrewPosition[]>({ queryKey: ["/api/crew/positions"] });
  const { data: members = [] } = useQuery<(CrewMember & { positions: CrewPosition[] })[]>({ queryKey: ["/api/crew/members"] });
  const { data: templates = [] } = useQuery<(CrewTemplate & { slots: any[] })[]>({ queryKey: ["/api/crew/templates"] });

  const [addPosId, setAddPosId] = useState<string>("");
  const [applyTplId, setApplyTplId] = useState<string>("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/bookings", bookingId, "crew"] });

  const addSlot = useMutation({
    mutationFn: () => apiRequest("POST", `/api/bookings/${bookingId}/crew`, { positionId: parseInt(addPosId) }),
    onSuccess: () => { invalidate(); setAddPosId(""); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const applyTemplate = useMutation({
    mutationFn: () => apiRequest("POST", `/api/bookings/${bookingId}/crew/apply-template`, { templateId: parseInt(applyTplId) }),
    onSuccess: (data: any) => {
      invalidate(); setApplyTplId("");
      toast({ title: `Added ${data.created} crew slot${data.created === 1 ? "" : "s"}` });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const assignCrew = useMutation({
    mutationFn: (vars: { slotId: number; crewMemberId: number | null }) =>
      apiRequest("PATCH", `/api/bookings/${bookingId}/crew/${vars.slotId}`, { crewMemberId: vars.crewMemberId }),
    onSuccess: () => invalidate(),
    onError: (e: any) => {
      let msg = e.message;
      try { const data = JSON.parse(e.message.split("|").pop()); if (data?.message) msg = data.message; } catch {}
      toast({ title: "Conflict", description: msg, variant: "destructive" });
    },
  });

  const sendInvite = useMutation({
    mutationFn: (slotId: number) => apiRequest("POST", `/api/bookings/${bookingId}/crew/${slotId}/invite`),
    onSuccess: () => { invalidate(); toast({ title: "Invite sent" }); },
    onError: (e: any) => toast({ title: "Failed to send invite", description: e.message, variant: "destructive" }),
  });

  const deleteSlot = useMutation({
    mutationFn: (slotId: number) => apiRequest("DELETE", `/api/bookings/${bookingId}/crew/${slotId}`),
    onSuccess: () => invalidate(),
  });

  if (!bookingId) {
    return <div className="text-center py-8 text-muted-foreground">Save the booking first, then add crew.</div>;
  }

  const slots = crewData.slots || [];
  const totals = crewData.totals || { cents: 0, hours: 0, defaultRateType: "day" };

  const filledCount = slots.filter((s: any) => s.status === "confirmed").length;

  return (
    <div className="space-y-5">
      {/* Cost rollup */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-muted/60 to-muted/20 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated crew cost</div>
            <div className="flex items-baseline gap-2">
              <DollarSign className="h-6 w-6 self-center text-emerald-500" />
              <span className="text-3xl font-bold tabular-nums text-foreground" data-testid="text-crew-total">{dollars(totals.cents)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Production length <strong className="text-foreground">{totals.hours.toFixed(1)}h</strong></span>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1">
                auto rate
                <Badge variant="secondary" className="font-medium">{totals.defaultRateType === "half-day" ? "Half-day" : "Day"}</Badge>
              </span>
              {slots.length > 0 && (
                <>
                  <span className="text-border">•</span>
                  <span><strong className="text-foreground">{filledCount}</strong>/{slots.length} confirmed</span>
                </>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={() => window.open(`/bookings/${bookingId}/call-sheet`, "_blank")} data-testid="button-call-sheet">
            <Printer className="h-4 w-4 mr-2" /> Call Sheet
          </Button>
        </div>
      </div>

      {/* Add slot + apply template controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Add position</label>
          <div className="flex gap-2">
            <Select value={addPosId} onValueChange={setAddPosId}>
              <SelectTrigger className="flex-1" data-testid="select-add-position"><SelectValue placeholder="Choose position…" /></SelectTrigger>
              <SelectContent>
                {positions.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button disabled={!addPosId || addSlot.isPending} onClick={() => addSlot.mutate()} data-testid="button-add-slot">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Apply template</label>
          <div className="flex gap-2">
            <Select value={applyTplId} onValueChange={setApplyTplId}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Choose template…" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={!applyTplId || applyTemplate.isPending} onClick={() => applyTemplate.mutate()}>
              <FileText className="h-4 w-4 mr-1" /> Apply
            </Button>
          </div>
        </div>
      </div>

      {/* Slot list */}
      {slots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <UserPlus className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">No crew assigned yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add a position above or apply a template to get started.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {slots.map((s: any) => {
            const meta = STATUS_META[s.status] || STATUS_META.unfilled;
            const StatusIcon = meta.icon;
            const candidates = members.filter(m =>
              m.isActive && m.positions.some(p => p.id === s.positionId)
            );
            return (
              <div key={s.id} className="group rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-foreground/20">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                  <div className="flex items-center gap-2.5 w-44 shrink-0">
                    <span className="h-8 w-1 rounded-full bg-primary/60" />
                    <span className="font-semibold leading-tight text-foreground">{s.position?.name || "?"}</span>
                  </div>

                  <Select
                    value={s.crewMemberId ? s.crewMemberId.toString() : "__unassigned"}
                    onValueChange={(v) => assignCrew.mutate({
                      slotId: s.id,
                      crewMemberId: v === "__unassigned" ? null : parseInt(v),
                    })}
                  >
                    <SelectTrigger className="w-60" data-testid={`select-crew-${s.id}`}>
                      <SelectValue placeholder="— Unassigned —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned">— Unassigned —</SelectItem>
                      {candidates.length === 0 && (
                        <div className="px-2 py-1 text-xs text-muted-foreground">No qualified crew. Add some to the roster.</div>
                      )}
                      {candidates.map(m => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.name} — {dollars(m.dayRateCents)}/{dollars(m.halfDayRateCents)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
                    <StatusIcon className="h-3.5 w-3.5" /> {meta.label}
                  </div>

                  {s.rateSnapshotCents > 0 && (
                    <div className="text-sm font-medium tabular-nums text-foreground">
                      {dollars(s.rateSnapshotCents)} <span className="text-xs font-normal text-muted-foreground">({s.rateType})</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 ml-auto">
                    {s.crewMemberId && (s.status === "unfilled" || s.status === "declined") && (
                      <Button size="sm" variant="outline" onClick={() => sendInvite.mutate(s.id)} disabled={sendInvite.isPending} data-testid={`button-invite-${s.id}`}>
                        <Mail className="h-3.5 w-3.5 mr-1.5" /> Send Invite
                      </Button>
                    )}
                    {s.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => sendInvite.mutate(s.id)} disabled={sendInvite.isPending}>
                        <Mail className="h-3.5 w-3.5 mr-1.5" /> Re-send
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteSlot.mutate(s.id)} data-testid={`button-delete-${s.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {s.status === "declined" && s.declineReason && (
                  <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Declined: {s.declineReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
