import { useEffect, useState } from "react";
import { useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Calendar, Clock, MapPin, Briefcase, DollarSign } from "lucide-react";

function dollars(cents: number) { return `$${((cents || 0) / 100).toFixed(2)}`; }

export default function CrewRespond() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const search = useSearch();
  const initialAction = new URLSearchParams(search).get("action") as "accept" | "decline" | null;

  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState<"confirmed" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/crew/respond", token],
    queryFn: () => fetch(`/api/crew/respond/${token}`).then(r => {
      if (!r.ok) throw new Error("Invalid link");
      return r.json();
    }),
  });

  const respond = useMutation({
    mutationFn: async (action: "accept" | "decline") => {
      const res = await fetch(`/api/crew/respond/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action === "decline" ? reason : undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed");
      return body;
    },
    onSuccess: (r) => setSubmitted(r.status),
    onError: (e: any) => setError(e.message),
  });

  // If the slot was already responded to, show that state
  useEffect(() => {
    if (data?.slot?.status === "confirmed" || data?.slot?.status === "declined") {
      setSubmitted(data.slot.status);
    }
  }, [data]);

  // Auto-accept if URL says ?action=accept and not yet submitted
  useEffect(() => {
    if (initialAction === "accept" && data?.slot?.status === "pending" && !submitted) {
      respond.mutate("accept");
    }
  }, [initialAction, data, submitted]);

  if (isLoading) return <CenteredCard><p>Loading…</p></CenteredCard>;
  if (isError || !data) return <CenteredCard><p className="text-destructive">This link is invalid or has expired.</p></CenteredCard>;

  const { booking, position, member, studios } = data;
  const tz = (import.meta.env.VITE_FACILITY_TIMEZONE as string) || "America/Chicago";
  const start = new Date(booking.start);
  const end = new Date(booking.end);
  const dateStr = start.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz });
  const timeStr = `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}`;

  if (submitted === "confirmed") {
    return <CenteredCard>
      <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Booking Confirmed</h2>
      <p className="text-muted-foreground">Thanks {member?.name}! The producer has been notified. You're booked for <strong>{position.name}</strong> on <strong>{dateStr}</strong>.</p>
    </CenteredCard>;
  }
  if (submitted === "declined") {
    return <CenteredCard>
      <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
      <h2 className="text-2xl font-bold mb-2">Booking Declined</h2>
      <p className="text-muted-foreground">No problem. The producer has been notified you're not available.</p>
    </CenteredCard>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-black dark:to-neutral-900 py-8 px-4">
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg">
          <CardTitle className="text-2xl">Crew Booking Request</CardTitle>
          <p className="opacity-90 text-sm">Hi {member?.name} — please confirm or decline this booking.</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <DetailRow icon={Briefcase} label="Position" value={position.name} />
          <DetailRow icon={Calendar} label="Production" value={booking.title} />
          <DetailRow icon={Calendar} label="Date" value={dateStr} />
          <DetailRow icon={Clock} label="Time" value={timeStr} />
          <DetailRow icon={MapPin} label="Studio" value={studios.map((s: any) => s.name).join(", ") || "TBD"} />
          <DetailRow icon={DollarSign} label={data.slot.rateType === "half-day" ? "Half-day Rate" : "Day Rate"} value={dollars(data.slot.rateSnapshotCents)} />

          {booking.description && (
            <div className="bg-muted/40 rounded-md p-3 text-sm whitespace-pre-wrap">{booking.description}</div>
          )}

          <div className="border-t pt-4 space-y-3">
            <div>
              <Label className="text-sm">If declining, please tell us why (optional):</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="e.g. unavailable that day, booked on another shoot…" />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button size="lg" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => respond.mutate("accept")} disabled={respond.isPending} data-testid="button-accept">
                <CheckCircle2 className="h-5 w-5 mr-2" /> Accept Booking
              </Button>
              <Button size="lg" variant="destructive" className="flex-1" onClick={() => respond.mutate("decline")} disabled={respond.isPending} data-testid="button-decline">
                <XCircle className="h-5 w-5 mr-2" /> Decline
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="text-xs uppercase text-muted-foreground font-semibold">{label}</div>
        <div className="text-base">{value}</div>
      </div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-black dark:to-neutral-900">
      <Card className="max-w-md w-full"><CardContent className="text-center py-12">{children}</CardContent></Card>
    </div>
  );
}
