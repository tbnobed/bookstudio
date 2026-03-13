import { useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Asset } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, X, Plus, Pencil, Trash2, Package, Camera, Lightbulb, Volume2, Cable, Wrench, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { value: "available", label: "Available", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700" },
  { value: "in-use", label: "In Use", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700" },
  { value: "maintenance", label: "Maintenance", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700" },
  { value: "retired", label: "Retired", color: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600" },
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

  const canDelete = user?.role === "admin" || user?.role === "site_manager";

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(asset => (
              <div
                key={asset.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Category color bar */}
                <div className={cn("h-1.5", {
                  "bg-blue-500": asset.category === "camera",
                  "bg-yellow-500": asset.category === "lighting",
                  "bg-purple-500": asset.category === "audio",
                  "bg-indigo-500": asset.category === "video",
                  "bg-gray-500": asset.category === "cable",
                  "bg-teal-500": asset.category === "accessory",
                  "bg-orange-500": asset.category === "other",
                })} />

                <div className="p-4">
                  {/* Name + status */}
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white leading-tight flex-1 min-w-0 truncate">
                      {asset.name}
                    </h3>
                    <Badge variant="outline" className={cn("text-xs px-1.5 py-0 shrink-0", getStatusStyle(asset.status))}>
                      {STATUSES.find(s => s.value === asset.status)?.label ?? asset.status}
                    </Badge>
                  </div>

                  {/* Category */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {getCategoryIcon(asset.category)}
                    <span>{getCategoryLabel(asset.category)}</span>
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                    {asset.serialNumber && (
                      <div className="flex gap-1">
                        <span className="text-gray-400 shrink-0">S/N:</span>
                        <span className="font-mono truncate">{asset.serialNumber}</span>
                      </div>
                    )}
                    {asset.assetTag && (
                      <div className="flex gap-1">
                        <span className="text-gray-400 shrink-0">Tag:</span>
                        <span className="font-mono truncate">{asset.assetTag}</span>
                      </div>
                    )}
                    {asset.location && (
                      <div className="flex gap-1">
                        <span className="text-gray-400 shrink-0">Location:</span>
                        <span className="truncate">{asset.location}</span>
                      </div>
                    )}
                    {asset.description && (
                      <p className="text-gray-500 dark:text-gray-400 line-clamp-2 pt-0.5">{asset.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openEdit(asset)}>
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                        onClick={() => setDeleteTarget(asset)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
    </div>
  );
}
