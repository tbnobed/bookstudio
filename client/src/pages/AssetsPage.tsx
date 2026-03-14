import { useState, useMemo, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Asset, Booking, AssetPhoto } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, Plus, Pencil, Trash2, Package, Camera, Lightbulb, Volume2, Cable, Wrench, MoreHorizontal, CheckCircle2, CircleDot, AlertTriangle, Archive, LogIn, LogOut, History, User, Clock, ShoppingCart, Tv, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type EnrichedCheckout = {
  id: number;
  assetId: number;
  checkedOutBy: number;
  checkedOutAt: string | null;
  checkedInAt: string | null;
  checkedInBy: number | null;
  notes: string | null;
  purpose: string | null;
  checkedOutByName: string;
  checkedInByName: string | null;
};

const CATEGORIES = [
  { value: "camera", label: "Camera", icon: Camera },
  { value: "lighting", label: "Lighting", icon: Lightbulb },
  { value: "audio", label: "Audio", icon: Volume2 },
  { value: "video", label: "Video", icon: Package },
  { value: "cable", label: "Cable", icon: Cable },
  { value: "accessory", label: "Accessory", icon: MoreHorizontal },
  { value: "other", label: "Other", icon: Wrench },
];

const STATUSES = [
  { value: "available", label: "Available", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700", icon: CheckCircle2, iconClass: "text-emerald-600" },
  { value: "in-use", label: "In Use", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700", icon: CircleDot, iconClass: "text-blue-600" },
  { value: "maintenance", label: "Maintenance", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700", icon: AlertTriangle, iconClass: "text-amber-600" },
  { value: "retired", label: "Retired", color: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600", icon: Archive, iconClass: "text-gray-500" },
];

function getStatusStyle(status: string) {
  return STATUSES.find(s => s.value === status)?.color ?? STATUSES[0].color;
}

function getCategoryIcon(category: string) {
  const cat = CATEGORIES.find(c => c.value === category);
  const Icon = cat?.icon ?? Package;
  return <Icon className="h-4 w-4" />;
}

function getCategoryLabel(category: string) {
  return CATEGORIES.find(c => c.value === category)?.label ?? category;
}

const EMPTY_FORM = {
  name: "",
  category: "camera",
  status: "available",
  serialNumber: "",
  assetTag: "",
  location: "",
  description: "",
  notes: "",
  purchaseDate: "",
  lastMaintenanceDate: "",
};

function formatBookingDate(dateStr: string | Date) {
  const d = new Date(dateStr as string);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

type ProductionPickerProps = {
  value: string;
  onChange: (val: string) => void;
  productions: Booking[];
};

function ProductionPicker({ value, onChange, productions }: ProductionPickerProps) {
  // Deduplicate by title, sort most recent first, take top 40
  const seen = new Set<string>();
  const recent = productions
    .slice()
    .sort((a, b) => new Date(b.start as string).getTime() - new Date(a.start as string).getTime())
    .filter(b => {
      if (seen.has(b.title)) return false;
      seen.add(b.title);
      return true;
    })
    .slice(0, 40);

  return (
    <div className="space-y-2">
      {recent.length > 0 && (
        <Select
          value={recent.find(b => b.title === value) ? value : "__custom__"}
          onValueChange={v => { if (v !== "__custom__") onChange(v); }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick a recent production..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__custom__" className="text-gray-400 italic">
              — type a custom name below —
            </SelectItem>
            {recent.map(b => (
              <SelectItem key={b.id} value={b.title}>
                <div className="flex items-center gap-2">
                  <Tv className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">{b.title}</span>
                  <span className="ml-2 text-xs text-gray-400 shrink-0">{formatBookingDate(b.start)}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Input
        placeholder={recent.length > 0 ? "Or type a custom production name..." : "e.g. Morning news shoot, Studio B setup"}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

export default function AssetsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Checkout system state
  const [checkoutTarget, setCheckoutTarget] = useState<Asset | null>(null);
  const [checkoutForm, setCheckoutForm] = useState({ purpose: "", notes: "" });
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkCheckoutOpen, setBulkCheckoutOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ purpose: "", notes: "" });

  // Photo state
  const photoFileRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const canDelete = user?.role === "admin" || user?.role === "site_manager";

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const { data: activeCheckouts = [] } = useQuery<EnrichedCheckout[]>({
    queryKey: ["/api/assets/checkouts/active"],
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });

  const { data: assetHistory = [], isLoading: historyLoading } = useQuery<EnrichedCheckout[]>({
    queryKey: ["/api/assets", historyAsset?.id, "checkouts"],
    queryFn: () => fetch(`/api/assets/${historyAsset!.id}/checkouts`, { credentials: "include" }).then(r => r.json()),
    enabled: !!historyAsset,
  });

  const { data: assetPhotos = [], isLoading: photosLoading } = useQuery<AssetPhoto[]>({
    queryKey: ["/api/assets", editAsset?.id, "photos"],
    queryFn: () => fetch(`/api/assets/${editAsset!.id}/photos`, { credentials: "include" }).then(r => r.json()),
    enabled: !!editAsset,
  });

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editAsset) return;
    if (assetPhotos.length >= 5) {
      toast({ title: "Maximum 5 photos per asset", variant: "destructive" });
      return;
    }
    setPhotoUploading(true);
    try {
      const photoData = await compressImage(file);
      await apiRequest("POST", `/api/assets/${editAsset.id}/photos`, { photoData });
      queryClient.invalidateQueries({ queryKey: ["/api/assets", editAsset.id, "photos"] });
      toast({ title: "Photo added" });
    } catch (err: any) {
      toast({ title: "Failed to add photo", description: err?.message, variant: "destructive" });
    } finally {
      setPhotoUploading(false);
      if (photoFileRef.current) photoFileRef.current.value = "";
    }
  };

  const handlePhotoDelete = async (photoId: number) => {
    if (!editAsset) return;
    try {
      await apiRequest("DELETE", `/api/assets/${editAsset.id}/photos/${photoId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/assets", editAsset.id, "photos"] });
    } catch {
      toast({ title: "Failed to delete photo", variant: "destructive" });
    }
  };

  const createAsset = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => apiRequest("POST", "/api/assets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset added", description: `${form.name} has been added to the inventory.` });
      closeModal();
    },
    onError: () => toast({ title: "Error", description: "Failed to add asset.", variant: "destructive" }),
  });

  const updateAsset = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof EMPTY_FORM> }) =>
      apiRequest("PUT", `/api/assets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset updated", description: `${form.name} has been updated.` });
      closeModal();
    },
    onError: () => toast({ title: "Error", description: "Failed to update asset.", variant: "destructive" }),
  });

  const deleteAsset = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset deleted", description: "Asset has been removed from inventory." });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete asset.", variant: "destructive" }),
  });

  const quickSetStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/assets/${id}`, { status }),
    onSuccess: (_data, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      const label = STATUSES.find(s => s.value === status)?.label ?? status;
      toast({ title: "Status updated", description: `Asset marked as ${label}.` });
    },
    onError: () => toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }),
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ id, purpose, notes }: { id: number; purpose: string; notes: string }) =>
      apiRequest("POST", `/api/assets/${id}/checkout`, { purpose, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets/checkouts/active"] });
      toast({ title: "Checked out", description: `${checkoutTarget?.name} is now checked out to you.` });
      setCheckoutTarget(null);
      setCheckoutForm({ purpose: "", notes: "" });
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to check out asset.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/assets/${id}/checkin`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets/checkouts/active"] });
      const name = assets.find(a => a.id === id)?.name ?? "Asset";
      toast({ title: "Checked in", description: `${name} has been returned.` });
    },
    onError: () => toast({ title: "Error", description: "Failed to check in asset.", variant: "destructive" }),
  });

  const [bulkPending, setBulkPending] = useState(false);

  const handleBulkCheckout = async () => {
    // Snapshot the targets at click-time using selectedAvailable (already computed)
    const targets = assets.filter(a => selectedIds.has(a.id) && a.status === "available");
    if (targets.length === 0) return;
    setBulkPending(true);
    try {
      const results = await Promise.allSettled(
        targets.map(a =>
          apiRequest("POST", `/api/assets/${a.id}/checkout`, { purpose: bulkForm.purpose, notes: bulkForm.notes })
        )
      );
      const succeeded = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;
      // Reset UI first, then refresh data
      setSelectedIds(new Set());
      setBulkCheckoutOpen(false);
      setBulkForm({ purpose: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets/checkouts/active"] });
      if (failed === 0) {
        toast({ title: "Checked out", description: `${succeeded} item${succeeded !== 1 ? "s" : ""} checked out successfully.` });
      } else if (succeeded > 0) {
        toast({ title: "Partial success", description: `${succeeded} checked out, ${failed} already in use or unavailable.`, variant: "destructive" });
      } else {
        toast({ title: "Checkout failed", description: "None of the selected items could be checked out.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Bulk checkout error:", err);
      toast({ title: "Error", description: "An unexpected error occurred during checkout.", variant: "destructive" });
    } finally {
      setBulkPending(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openCreate = () => {
    setEditAsset(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditAsset(asset);
    setForm({
      name: asset.name,
      category: asset.category,
      status: asset.status,
      serialNumber: asset.serialNumber ?? "",
      assetTag: asset.assetTag ?? "",
      location: asset.location ?? "",
      description: asset.description ?? "",
      notes: asset.notes ?? "",
      purchaseDate: asset.purchaseDate ?? "",
      lastMaintenanceDate: asset.lastMaintenanceDate ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditAsset(null);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: "Validation error", description: "Asset name is required.", variant: "destructive" });
      return;
    }
    if (editAsset) {
      updateAsset.mutate({ id: editAsset.id, data: form });
    } else {
      createAsset.mutate(form);
    }
  };

  // Build a fast lookup: assetId → active checkout
  const checkoutMap = useMemo(() => {
    const map = new Map<number, EnrichedCheckout>();
    for (const c of activeCheckouts) map.set(c.assetId, c);
    return map;
  }, [activeCheckouts]);

  // Stats counts
  const statCounts = useMemo(() => {
    return STATUSES.reduce((acc, s) => {
      acc[s.value] = assets.filter(a => a.status === s.value).length;
      return acc;
    }, {} as Record<string, number>);
  }, [assets]);

  // Filtered assets
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter(a => {
      const matchCat = categoryFilter === "all" || a.category === categoryFilter;
      const matchStat = statusFilter === "all" || a.status === statusFilter;
      const matchSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.serialNumber ?? "").toLowerCase().includes(q) ||
        (a.assetTag ?? "").toLowerCase().includes(q) ||
        (a.location ?? "").toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q);
      return matchCat && matchStat && matchSearch;
    });
  }, [assets, searchQuery, categoryFilter, statusFilter]);

  const hasActiveFilters = searchQuery.trim() !== "" || categoryFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  // Selection helpers — depend on filtered, so defined after it
  const availableInFiltered = filtered.filter(a => a.status === "available");
  const selectedAvailable = filtered.filter(a => selectedIds.has(a.id) && a.status === "available");
  const allAvailableSelected = availableInFiltered.length > 0 && availableInFiltered.every(a => selectedIds.has(a.id));
  const someAvailableSelected = availableInFiltered.some(a => selectedIds.has(a.id)) && !allAvailableSelected;

  const toggleSelectAll = () => {
    if (allAvailableSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        availableInFiltered.forEach(a => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        availableInFiltered.forEach(a => next.add(a.id));
        return next;
      });
    }
  };

  const isPending = createAsset.isPending || updateAsset.isPending;

  return (
    <div className="flex flex-col h-screen">
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view="week"
        onViewChange={() => {}}
        title="Assets"
        showViewToggle={false}
      />

      <div className="w-full px-4 pb-16 overflow-auto">

        {/* Page header */}
        <div className="flex justify-between items-center mb-4 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Asset Inventory</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{assets.length} total items</p>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        </div>

        {/* Status summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all hover:shadow-md",
                statusFilter === s.value
                  ? s.color + " shadow-sm ring-2 ring-offset-1 ring-current"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300"
              )}
            >
              <p className="text-2xl font-bold">{statCounts[s.value] ?? 0}</p>
              <p className="text-xs font-medium mt-0.5 opacity-80">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search by name, serial number, location..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0 text-gray-500 hover:text-gray-800">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Asset grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {hasActiveFilters ? "No assets match your search or filters." : "No assets in inventory yet."}
            </p>
            {hasActiveFilters ? (
              <button onClick={clearFilters} className="mt-2 text-sm text-primary underline hover:no-underline">
                Clear filters
              </button>
            ) : (
              <Button onClick={openCreate} variant="outline" className="mt-4 gap-1.5">
                <Plus className="h-4 w-4" />
                Add your first asset
              </Button>
            )}
          </div>
        ) : (
          <>
          {/* Floating bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  {selectedAvailable.length} item{selectedAvailable.length !== 1 ? "s" : ""} selected for checkout
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                  onClick={clearSelection}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => { setBulkForm({ purpose: "", notes: "" }); setBulkCheckoutOpen(true); }}
                  disabled={selectedAvailable.length === 0}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Check Out {selectedAvailable.length} Item{selectedAvailable.length !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[28px_3fr_1fr_1fr_1fr_1fr_200px] gap-4 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <div className="flex items-center">
                <Checkbox
                  checked={allAvailableSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all available"
                  className={cn(someAvailableSelected && "opacity-60")}
                  disabled={availableInFiltered.length === 0}
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1 shrink-0 invisible" />
                <span>Name</span>
              </div>
              <span>Category</span>
              <span>Status</span>
              <span className="hidden md:block">Serial / Tag</span>
              <span className="hidden lg:block">Location</span>
              <span></span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filtered.map(asset => (
                <ContextMenu key={asset.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        "grid grid-cols-[28px_3fr_1fr_1fr_1fr_1fr_200px] gap-4 px-4 py-3 items-center bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors select-none",
                        selectedIds.has(asset.id) && "bg-emerald-50/60 dark:bg-emerald-900/10"
                      )}
                    >
                      {/* Checkbox (only for available assets) */}
                      <div className="flex items-center" onClick={e => e.stopPropagation()}>
                        {asset.status === "available" ? (
                          <Checkbox
                            checked={selectedIds.has(asset.id)}
                            onCheckedChange={() => toggleSelect(asset.id)}
                            aria-label={`Select ${asset.name}`}
                          />
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </div>

                      {/* Name + category color indicator */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-1 self-stretch rounded-full shrink-0", {
                          "bg-blue-500": asset.category === "camera",
                          "bg-yellow-500": asset.category === "lighting",
                          "bg-purple-500": asset.category === "audio",
                          "bg-indigo-500": asset.category === "video",
                          "bg-gray-400": asset.category === "cable",
                          "bg-teal-500": asset.category === "accessory",
                          "bg-orange-500": asset.category === "other",
                        })} />
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{asset.name}</p>
                          {asset.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{asset.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Category */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {getCategoryIcon(asset.category)}
                        <span className="hidden sm:inline">{getCategoryLabel(asset.category)}</span>
                      </div>

                      {/* Status + checkout info */}
                      <div className="space-y-1">
                        <Badge variant="outline" className={cn("text-xs px-1.5 py-0", getStatusStyle(asset.status))}>
                          {STATUSES.find(s => s.value === asset.status)?.label ?? asset.status}
                        </Badge>
                        {checkoutMap.get(asset.id) && (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                              <User className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{checkoutMap.get(asset.id)!.checkedOutByName}</span>
                            </div>
                            {checkoutMap.get(asset.id)!.purpose && (
                              <div className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400">
                                <Tv className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{checkoutMap.get(asset.id)!.purpose}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Serial / Tag */}
                      <div className="hidden md:block text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
                        {asset.serialNumber && <p className="font-mono truncate">{asset.serialNumber}</p>}
                        {asset.assetTag && <p className="text-gray-400 truncate">{asset.assetTag}</p>}
                      </div>

                      {/* Location */}
                      <div className="hidden lg:block text-xs text-gray-500 dark:text-gray-400 truncate">
                        {asset.location ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {asset.status === "available" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
                            onClick={() => { setCheckoutTarget(asset); setCheckoutForm({ purpose: "", notes: "" }); }}
                          >
                            <LogOut className="h-3 w-3" />
                            Check Out
                          </Button>
                        )}
                        {asset.status === "in-use" && checkoutMap.get(asset.id) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-blue-700 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                            disabled={checkinMutation.isPending}
                            onClick={() => checkinMutation.mutate(asset.id)}
                          >
                            <LogIn className="h-3 w-3" />
                            Check In
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openEdit(asset)}>
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
                          title="Checkout history"
                          onClick={() => setHistoryAsset(asset)}
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </ContextMenuTrigger>

                  <ContextMenuContent className="w-56">
                    <ContextMenuLabel className="text-xs text-gray-500 font-normal truncate">
                      {asset.name}
                    </ContextMenuLabel>
                    {checkoutMap.get(asset.id) && (
                      <div className="px-2 py-1.5 space-y-1 mx-1 rounded bg-blue-50 dark:bg-blue-900/20">
                        <div className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">Checked out by {checkoutMap.get(asset.id)!.checkedOutByName}</span>
                        </div>
                        {checkoutMap.get(asset.id)!.purpose && (
                          <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-400">
                            <Tv className="h-3 w-3 shrink-0" />
                            <span className="truncate">{checkoutMap.get(asset.id)!.purpose}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <ContextMenuSeparator />
                    {asset.status === "available" && (
                      <ContextMenuItem
                        className="gap-2 cursor-pointer text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50 dark:focus:bg-emerald-900/20"
                        onSelect={() => { setCheckoutTarget(asset); setCheckoutForm({ purpose: "", notes: "" }); }}
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        Check Out
                      </ContextMenuItem>
                    )}
                    {asset.status === "in-use" && checkoutMap.get(asset.id) && (
                      <ContextMenuItem
                        className="gap-2 cursor-pointer text-blue-700 focus:text-blue-700 focus:bg-blue-50 dark:focus:bg-blue-900/20"
                        disabled={checkinMutation.isPending}
                        onSelect={() => checkinMutation.mutate(asset.id)}
                      >
                        <LogIn className="h-4 w-4 shrink-0" />
                        Check In
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem
                      className="gap-2 cursor-pointer"
                      onSelect={() => setHistoryAsset(asset)}
                    >
                      <History className="h-4 w-4 shrink-0 text-gray-500" />
                      View checkout history
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuLabel className="text-xs">Set Status</ContextMenuLabel>
                    {STATUSES.map(s => {
                      const Icon = s.icon;
                      const isCurrent = asset.status === s.value;
                      return (
                        <ContextMenuItem
                          key={s.value}
                          disabled={isCurrent || quickSetStatus.isPending}
                          onSelect={() => quickSetStatus.mutate({ id: asset.id, status: s.value })}
                          className={cn("gap-2 cursor-pointer", isCurrent && "opacity-50 cursor-default")}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", s.iconClass)} />
                          <span>{s.label}</span>
                          {isCurrent && (
                            <span className="ml-auto text-[10px] text-gray-400">current</span>
                          )}
                        </ContextMenuItem>
                      );
                    })}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      className="gap-2 cursor-pointer"
                      onSelect={() => openEdit(asset)}
                    >
                      <Pencil className="h-4 w-4 shrink-0 text-gray-500" />
                      Edit asset
                    </ContextMenuItem>
                    {canDelete && (
                      <ContextMenuItem
                        className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                        onSelect={() => setDeleteTarget(asset)}
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        Delete asset
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </div>
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAsset ? "Edit Asset" : "Add Asset"}</DialogTitle>
            <DialogDescription>
              {editAsset ? "Update the details for this asset." : "Add a new item to your production gear inventory."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="asset-name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="asset-name"
                placeholder="e.g. Sony FX6 Camera"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Category + Status row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category <span className="text-red-500">*</span></Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status <span className="text-red-500">*</span></Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Serial + Asset Tag row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="serial">Serial Number</Label>
                <Input
                  id="serial"
                  placeholder="SN-12345"
                  value={form.serialNumber}
                  onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tag">Asset Tag</Label>
                <Input
                  id="tag"
                  placeholder="TAG-001"
                  value={form.assetTag}
                  onChange={e => setForm(f => ({ ...f, assetTag: e.target.value }))}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Studio A Equipment Room"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the asset..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes, damage, accessories included, etc."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="purchase-date">Purchase Date</Label>
                <Input
                  id="purchase-date"
                  type="date"
                  value={form.purchaseDate}
                  onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maintenance-date">Last Maintenance</Label>
                <Input
                  id="maintenance-date"
                  type="date"
                  value={form.lastMaintenanceDate}
                  onChange={e => setForm(f => ({ ...f, lastMaintenanceDate: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Photos — only visible when editing an existing asset */}
          {editAsset && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Photos
                  <span className="text-xs text-muted-foreground font-normal">({assetPhotos.length}/5)</span>
                </Label>
                {assetPhotos.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => photoFileRef.current?.click()}
                    disabled={photoUploading}
                  >
                    {photoUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Add photo
                  </Button>
                )}
              </div>
              <input ref={photoFileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoAdd} />
              {photosLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : assetPhotos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No photos yet. Click "Add photo" to upload one.</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {assetPhotos.map(photo => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.photoData}
                        alt="Asset photo"
                        className="w-20 h-20 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setViewPhoto(photo.photoData)}
                      />
                      <button
                        type="button"
                        onClick={() => handlePhotoDelete(photo.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving..." : editAsset ? "Save Changes" : "Add Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently remove <strong>{deleteTarget?.name}</strong> from the inventory? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteAsset.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteAsset.mutate(deleteTarget.id)}
              disabled={deleteAsset.isPending}
            >
              {deleteAsset.isPending ? "Deleting..." : "Delete Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check Out Modal */}
      <Dialog open={!!checkoutTarget} onOpenChange={open => { if (!open) { setCheckoutTarget(null); setCheckoutForm({ purpose: "", notes: "" }); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-emerald-600" />
              Check Out Asset
            </DialogTitle>
            <DialogDescription>
              Checking out <strong>{checkoutTarget?.name}</strong> to you. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Production / Purpose</Label>
              <ProductionPicker
                value={checkoutForm.purpose}
                onChange={val => setCheckoutForm(f => ({ ...f, purpose: val }))}
                productions={bookings}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-notes">Notes (optional)</Label>
              <Textarea
                id="co-notes"
                placeholder="Any notes about the condition of the item"
                value={checkoutForm.notes}
                onChange={e => setCheckoutForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCheckoutTarget(null); setCheckoutForm({ purpose: "", notes: "" }); }} disabled={checkoutMutation.isPending}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => checkoutTarget && checkoutMutation.mutate({ id: checkoutTarget.id, ...checkoutForm })}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? "Checking out..." : "Check Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout History Modal */}
      <Dialog open={!!historyAsset} onOpenChange={open => { if (!open) setHistoryAsset(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-gray-500" />
              Checkout History
            </DialogTitle>
            <DialogDescription>{historyAsset?.name}</DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading history...</div>
          ) : assetHistory.length === 0 ? (
            <div className="py-8 text-center">
              <History className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No checkout history yet</p>
              <p className="text-xs text-gray-400 mt-1">Records will appear here when the asset is checked out.</p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {assetHistory.map(entry => (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    entry.checkedInAt
                      ? "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                      : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                      <User className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                      {entry.checkedOutByName}
                    </div>
                    {entry.checkedInAt ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 shrink-0">
                        Returned
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
                        Active
                      </Badge>
                    )}
                  </div>
                  {entry.purpose && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{entry.purpose}</p>
                  )}
                  {entry.notes && (
                    <p className="text-xs text-gray-400 italic mt-0.5">{entry.notes}</p>
                  )}
                  <div className="flex flex-col gap-0.5 mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                    <div className="flex items-center gap-1">
                      <LogOut className="h-2.5 w-2.5 shrink-0" />
                      Out: {entry.checkedOutAt ? new Date(entry.checkedOutAt).toLocaleString() : "—"}
                    </div>
                    {entry.checkedInAt && (
                      <div className="flex items-center gap-1">
                        <LogIn className="h-2.5 w-2.5 shrink-0" />
                        In: {new Date(entry.checkedInAt).toLocaleString()}
                        {entry.checkedInByName && entry.checkedInByName !== entry.checkedOutByName && (
                          <span className="text-gray-400"> by {entry.checkedInByName}</span>
                        )}
                      </div>
                    )}
                    {!entry.checkedInAt && entry.checkedOutAt && (
                      <div className="flex items-center gap-1 text-blue-500 dark:text-blue-400">
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        Out for {Math.round((Date.now() - new Date(entry.checkedOutAt).getTime()) / 3600000)} hr(s)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryAsset(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Check Out Modal */}
      <Dialog open={bulkCheckoutOpen} onOpenChange={open => { if (!open) { setBulkCheckoutOpen(false); setBulkForm({ purpose: "", notes: "" }); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              Bulk Check Out
            </DialogTitle>
            <DialogDescription>
              Checking out <strong>{selectedAvailable.length} item{selectedAvailable.length !== 1 ? "s" : ""}</strong> to you. The same purpose and notes will be applied to all.
            </DialogDescription>
          </DialogHeader>

          {/* Item list preview */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 max-h-40 overflow-y-auto text-sm">
            {selectedAvailable.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="truncate font-medium text-gray-800 dark:text-gray-200">{a.name}</span>
                <span className="ml-auto text-xs text-gray-400 shrink-0">{getCategoryLabel(a.category)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Production / Purpose</Label>
              <ProductionPicker
                value={bulkForm.purpose}
                onChange={val => setBulkForm(f => ({ ...f, purpose: val }))}
                productions={bookings}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-notes">Notes (optional)</Label>
              <Textarea
                id="bulk-notes"
                placeholder="Any condition notes or reminders"
                value={bulkForm.notes}
                onChange={e => setBulkForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkCheckoutOpen(false); setBulkForm({ purpose: "", notes: "" }); }} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={handleBulkCheckout}
              disabled={bulkPending || selectedAvailable.length === 0}
            >
              <ShoppingCart className="h-4 w-4" />
              {bulkPending ? "Checking out..." : `Check Out ${selectedAvailable.length} Item${selectedAvailable.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-screen photo viewer */}
      {viewPhoto && (
        <div
          className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center cursor-zoom-out"
          onClick={() => setViewPhoto(null)}
        >
          <img src={viewPhoto} alt="Full view" className="max-w-full max-h-full object-contain" />
          <button
            className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            onClick={() => setViewPhoto(null)}
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
