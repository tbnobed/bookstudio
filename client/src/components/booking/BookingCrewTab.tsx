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
  unfilled:  { label: "Unfilled",  icon: UserPlus,     cls: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100" },
  pending:   { label: "Invited",   icon: Clock,        cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, cls: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300" },
  declined:  { label: "Declined",  icon: XCircle,      cls: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300" },
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

  return (
    <div className="space-y-4">
      {/* Cost rollup */}
      <div className="flex items-center justify-between bg-muted/40 rounded-md p-3">
        <div className="text-sm text-muted-foreground">
          Production length: <strong>{totals.hours.toFixed(1)}h</strong> →
          {" "}auto rate: <Badge variant="outline" className="ml-1">{totals.defaultRateType === "half-day" ? "Half-day" : "Day"}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => window.open(`/bookings/${bookingId}/call-sheet`, "_blank")} data-testid="button-call-sheet">
            <Printer className="h-4 w-4 mr-1" /> Call Sheet
          </Button>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <DollarSign className="h-5 w-5 text-green-600" />
            {dollars(totals.cents)}
          </div>
        </div>
      </div>

      {/* Add slot + apply template controls */}
      <div className="flex flex-wrap gap-2 items-end border-b pb-3">
        <div className="flex gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Add position</label>
            <Select value={addPosId} onValueChange={setAddPosId}>
              <SelectTrigger className="w-48" data-testid="select-add-position"><SelectValue placeholder="Choose position…" /></SelectTrigger>
              <SelectContent>
                {positions.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={!addPosId || addSlot.isPending} onClick={() => addSlot.mutate()} data-testid="button-add-slot">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        <div className="flex gap-2 items-end ml-auto">
          <div>
            <label className="text-xs text-muted-foreground">Apply template</label>
            <Select value={applyTplId} onValueChange={setApplyTplId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Choose template…" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" disabled={!applyTplId || applyTemplate.isPending} onClick={() => applyTemplate.mutate()}>
            <FileText className="h-4 w-4 mr-1" /> Apply
          </Button>
        </div>
      </div>

      {/* Slot list */}
      {slots.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No crew assigned yet. Add positions above or apply a template.</div>
      ) : (
        <div className="space-y-2">
          {slots.map((s: any) => {
            const meta = STATUS_META[s.status] || STATUS_META.unfilled;
            const StatusIcon = meta.icon;
            const candidates = members.filter(m =>
              m.isActive && m.positions.some(p => p.id === s.positionId)
            );
            return (
              <div key={s.id} className="border rounded-md p-3 flex flex-wrap items-center gap-3">
                <div className="font-medium w-40 shrink-0">{s.position?.name || "?"}</div>
                <Select
                  value={s.crewMemberId ? s.crewMemberId.toString() : "__unassigned"}
                  onValueChange={(v) => assignCrew.mutate({
                    slotId: s.id,
                    crewMemberId: v === "__unassigned" ? null : parseInt(v),
                  })}
                >
                  <SelectTrigger className="w-56" data-testid={`select-crew-${s.id}`}>
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

                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${meta.cls}`}>
                  <StatusIcon className="h-3 w-3" /> {meta.label}
                </div>

                {s.rateSnapshotCents > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {dollars(s.rateSnapshotCents)} <span className="text-xs">({s.rateType})</span>
                  </div>
                )}

                {s.status === "declined" && s.declineReason && (
                  <div className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" /> {s.declineReason}
                  </div>
                )}

                <div className="flex gap-1 ml-auto">
                  {s.crewMemberId && (s.status === "unfilled" || s.status === "declined") && (
                    <Button size="sm" variant="outline" onClick={() => sendInvite.mutate(s.id)} disabled={sendInvite.isPending} data-testid={`button-invite-${s.id}`}>
                      <Mail className="h-3 w-3 mr-1" /> Send Invite
                    </Button>
                  )}
                  {s.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => sendInvite.mutate(s.id)} disabled={sendInvite.isPending}>
                      <Mail className="h-3 w-3 mr-1" /> Re-send
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => deleteSlot.mutate(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
