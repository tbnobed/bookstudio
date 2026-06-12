import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Asset } from "@shared/schema";
import {
  Search, Package, Camera, Lightbulb, Volume2, Cable, Wrench, Tv,
  User, X, Plus, ClipboardList, AlertCircle, CheckCircle2, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveCheckout = {
  id: number;
  assetId: number;
  checkedOutBy: number;
  checkedOutByName: string;
  checkedOutAt: string;
  purpose: string | null;
  notes: string | null;
  bookingEnded?: boolean;
};

const CATEGORY_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  camera:      { icon: Camera,    color: "text-blue-500" },
  lighting:    { icon: Lightbulb, color: "text-yellow-500" },
  audio:       { icon: Volume2,   color: "text-purple-500" },
  video:       { icon: Tv,        color: "text-indigo-500" },
  cables:      { icon: Cable,     color: "text-gray-500" },
  accessories: { icon: Wrench,    color: "text-orange-500" },
  other:       { icon: Package,   color: "text-teal-500" },
};

function CategoryIcon({ category }: { category: string }) {
  const cfg = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other;
  const Icon = cfg.icon;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.color)} />;
}

interface Props {
  booking: any;
}

export function BookingAssetsTab({ booking }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const bookingId = booking?.id;

  const { data: plannedAssets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/bookings", bookingId, "assets"],
    queryFn: () => fetch(`/api/bookings/${bookingId}/assets`, { credentials: "include" }).then(r => r.json()),
    enabled: !!bookingId,
  });

  const { data: allAssets = [] } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });

  const { data: activeCheckouts = [] } = useQuery<ActiveCheckout[]>({
    queryKey: ["/api/assets/checkouts/active"],
  });

  const checkoutMap = useMemo(() => {
    const map = new Map<number, ActiveCheckout>();
    for (const c of activeCheckouts) map.set(c.assetId, c);
    return map;
  }, [activeCheckouts]);

  const plannedIds = useMemo(() => new Set(plannedAssets.map(a => a.id)), [plannedAssets]);

  const addMutation = useMutation({
    mutationFn: (assetId: number) =>
      apiRequest("POST", `/api/bookings/${bookingId}/assets`, { assetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", bookingId, "assets"] });
      toast({ title: "Added to plan", description: "Asset added to this production's gear list." });
    },
    onError: () => toast({ title: "Error", description: "Could not add asset to plan.", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (assetId: number) =>
      apiRequest("DELETE", `/api/bookings/${bookingId}/assets/${assetId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", bookingId, "assets"] });
      toast({ title: "Removed from plan", description: "Asset removed from this production's gear list." });
    },
    onError: () => toast({ title: "Error", description: "Could not remove asset from plan.", variant: "destructive" }),
  });

  const availableToAdd = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allAssets.filter(a => {
      if (plannedIds.has(a.id)) return false;
      if (a.status === "retired") return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.category ?? "").toLowerCase().includes(q) ||
        (a.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [allAssets, plannedIds, search]);

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
        <Package className="h-8 w-8 text-gray-300" />
        <p className="text-muted-foreground">
          Gear planning will be available after saving this booking.
        </p>
        <p className="text-muted-foreground text-sm">Save the booking first, then you can build a gear list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Info callout */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2.5">
        <ClipboardList className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          This is a planning list only. Adding gear here does <strong>not</strong> check it out — crew members check out equipment from the Assets page when they actually take it.
        </p>
      </div>

      {/* Planned gear list */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-neutral-700 dark:text-gray-300">
            Planned for this production
          </span>
          {plannedAssets.length > 0 && (
            <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-300 text-emerald-700">
              {plannedAssets.length}
            </Badge>
          )}
        </div>

        {plannedAssets.length === 0 ? (
          <p className="text-xs text-gray-400 pl-6">No gear planned yet — add equipment below.</p>
        ) : (
          <div className="space-y-1.5">
            {plannedAssets.map(asset => {
              const co = checkoutMap.get(asset.id);
              const isOut = !!co;
              const isOverdue = co?.bookingEnded;
              return (
                <div
                  key={asset.id}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg border",
                    isOverdue
                      ? "bg-orange-50 dark:bg-orange-900/10 border-orange-300 dark:border-orange-700"
                      : isOut
                        ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                        : "bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                  )}
                >
                  <CategoryIcon category={asset.category ?? "other"} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.name}</p>
                    {isOverdue && (
                      <div className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400 mt-0.5">
                        <AlertCircle className="h-2.5 w-2.5" />
                        <span>Overdue return — {co!.checkedOutByName} hasn't checked it in yet</span>
                      </div>
                    )}
                    {isOut && !isOverdue && (
                      <div className="flex items-center gap-1 text-[10px] text-blue-500 mt-0.5">
                        <User className="h-2.5 w-2.5" />
                        <span className="truncate">Checked out by {co!.checkedOutByName}</span>
                      </div>
                    )}
                    {!isOut && (
                      <span className="text-[10px] text-emerald-600 font-medium">Available</span>
                    )}
                  </div>
                  {isOverdue && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-100 border-orange-300 text-orange-700 shrink-0">
                      Overdue
                    </Badge>
                  )}
                  {isOut && !isOverdue && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-100 border-blue-300 text-blue-700 shrink-0">
                      Out
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(asset.id)}
                    title="Remove from plan"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add gear */}
      <div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-sm font-semibold text-neutral-700 dark:text-gray-300">Add Equipment</span>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-7 text-xs"
            />
          </div>
        </div>

        {availableToAdd.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            {search ? "No assets match your search." : "All assets are already on this plan."}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {availableToAdd.map(asset => {
              const co = checkoutMap.get(asset.id);
              const isOut = !!co;
              return (
                <div
                  key={asset.id}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg border",
                    isOut
                      ? "bg-gray-50 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700 opacity-80"
                      : "bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700"
                  )}
                >
                  <CategoryIcon category={asset.category ?? "other"} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.name}</p>
                    {co ? (
                      <div className="flex items-center gap-1 text-[10px] text-blue-500 mt-0.5">
                        <User className="h-2.5 w-2.5" />
                        <span className="truncate">{co.checkedOutByName}{co.purpose ? ` — ${co.purpose}` : ""}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{asset.location ?? asset.category ?? ""}</span>
                      </div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 shrink-0",
                      isOut
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    )}
                  >
                    {isOut ? "In Use" : "Available"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300 shrink-0"
                    disabled={addMutation.isPending}
                    onClick={() => addMutation.mutate(asset.id)}
                  >
                    <Plus className="h-3 w-3" />
                    Plan
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
