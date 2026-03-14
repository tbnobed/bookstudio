import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Asset } from "@shared/schema";
import { Search, LogOut, LogIn, Package, Camera, Lightbulb, Volume2, Cable, Wrench, Tv, User, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveCheckout = {
  id: number;
  assetId: number;
  checkedOutBy: number;
  checkedOutByName: string;
  checkedOutAt: string;
  purpose: string | null;
  notes: string | null;
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

const STATUS_STYLES: Record<string, string> = {
  available:   "bg-emerald-100 text-emerald-800 border-emerald-300",
  "in-use":    "bg-blue-100 text-blue-800 border-blue-300",
  maintenance: "bg-amber-100 text-amber-800 border-amber-300",
  retired:     "bg-gray-100 text-gray-500 border-gray-300",
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

  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });
  const { data: activeCheckouts = [] } = useQuery<ActiveCheckout[]>({
    queryKey: ["/api/assets/checkouts/active"],
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ id, purpose }: { id: number; purpose: string }) =>
      apiRequest("POST", `/api/assets/${id}/checkout`, { purpose, notes: "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets/checkouts/active"] });
      toast({ title: "Checked out", description: "Asset assigned to this production." });
    },
    onError: () => toast({ title: "Error", description: "Could not check out asset.", variant: "destructive" }),
  });

  const checkinMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/assets/${id}/checkin`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets/checkouts/active"] });
      toast({ title: "Checked in", description: "Asset returned from production." });
    },
    onError: () => toast({ title: "Error", description: "Could not check in asset.", variant: "destructive" }),
  });

  // Build lookup: assetId -> checkout
  const checkoutMap = useMemo(() => {
    const map = new Map<number, ActiveCheckout>();
    for (const c of activeCheckouts) map.set(c.assetId, c);
    return map;
  }, [activeCheckouts]);

  const productionName = booking?.title ?? "";

  // Assets assigned to THIS production
  const assignedAssets = useMemo(
    () => assets.filter(a => {
      const co = checkoutMap.get(a.id);
      return co && co.purpose === productionName;
    }),
    [assets, checkoutMap, productionName]
  );

  // Remaining assets (available or in-use for other productions)
  const otherAssets = useMemo(() => {
    const q = search.toLowerCase();
    return assets
      .filter(a => !assignedAssets.find(x => x.id === a.id))
      .filter(a =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.category ?? "").toLowerCase().includes(q) ||
        (a.location ?? "").toLowerCase().includes(q)
      );
  }, [assets, assignedAssets, search]);

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
        <Package className="h-8 w-8 text-gray-300" />
        <p className="text-muted-foreground">
          Asset assignment will be available after creating this booking.
        </p>
        <p className="text-muted-foreground text-sm">Save the booking first, then you can assign equipment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Assigned assets */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Assigned to this production
          </span>
          {assignedAssets.length > 0 && (
            <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-300 text-emerald-700">
              {assignedAssets.length}
            </Badge>
          )}
        </div>

        {assignedAssets.length === 0 ? (
          <p className="text-xs text-gray-400 pl-6">No equipment assigned yet.</p>
        ) : (
          <div className="space-y-1.5">
            {assignedAssets.map(asset => {
              const co = checkoutMap.get(asset.id)!;
              return (
                <div
                  key={asset.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                >
                  <CategoryIcon category={asset.category ?? "other"} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                      <User className="h-2.5 w-2.5" />
                      <span>{co.checkedOutByName}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-300 shrink-0"
                    disabled={checkinMutation.isPending}
                    onClick={() => checkinMutation.mutate(asset.id)}
                  >
                    <LogIn className="h-3 w-3" />
                    Return
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available / other assets */}
      <div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Equipment</span>
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

        {otherAssets.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No equipment found.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {otherAssets.map(asset => {
              const co = checkoutMap.get(asset.id);
              const isAvailable = asset.status === "available";
              const isMine = co && co.purpose === productionName;

              return (
                <div
                  key={asset.id}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg border",
                    isAvailable
                      ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                      : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-75"
                  )}
                >
                  <CategoryIcon category={asset.category ?? "other"} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.name}</p>
                    {co && (
                      <div className="flex items-center gap-1 text-[10px] text-blue-500 mt-0.5">
                        <User className="h-2.5 w-2.5" />
                        <span className="truncate">{co.checkedOutByName} — {co.purpose ?? "no production"}</span>
                      </div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 shrink-0", STATUS_STYLES[asset.status ?? "available"])}
                  >
                    {asset.status === "in-use" ? "In Use" : asset.status === "available" ? "Available" : asset.status}
                  </Badge>
                  {isAvailable && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300 shrink-0"
                      disabled={checkoutMutation.isPending}
                      onClick={() => checkoutMutation.mutate({ id: asset.id, purpose: productionName })}
                    >
                      <LogOut className="h-3 w-3" />
                      Assign
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
