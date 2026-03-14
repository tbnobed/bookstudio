import { useState, useEffect, useRef, useCallback } from "react";
import { BarcodeDetectorPolyfill } from "@undecaf/barcode-detector-polyfill";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Asset, AssetCheckout } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Search, X, Plus, Camera, ArrowLeft, Barcode,
  LogIn, LogOut as LogOutIcon, Package,
  Loader2, Check, ScanLine, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: "camera",    label: "Camera",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "lighting",  label: "Lighting",  color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  { value: "audio",     label: "Audio",     color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "video",     label: "Video",     color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  { value: "cable",     label: "Cable",     color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  { value: "accessory", label: "Accessory", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "other",     label: "Other",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
];
const getCat = (cat: string) => CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[6];

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  available:   { label: "Available",   dot: "bg-emerald-400", text: "text-emerald-600 dark:text-emerald-400" },
  "in-use":    { label: "In Use",      dot: "bg-rose-400",    text: "text-rose-600 dark:text-rose-400" },
  maintenance: { label: "Maintenance", dot: "bg-amber-400",   text: "text-amber-600 dark:text-amber-400" },
  retired:     { label: "Retired",     dot: "bg-gray-400",    text: "text-gray-500 dark:text-gray-400" },
};

// ── Barcode Scanner ─────────────────────────────────────────────────────────────
interface ScannerProps {
  fieldLabel: string;
  onDetected: (value: string) => void;
  onClose: () => void;
}

// Install the ZBar WASM polyfill on iOS/Safari where the native BarcodeDetector API
// is not implemented. On Chrome/Android the native API is used; on all other browsers
// the WASM polyfill transparently takes over — same API, same call sites.
if (!('BarcodeDetector' in window)) {
  (window as any).BarcodeDetector = BarcodeDetectorPolyfill;
}

function BarcodeScanner({ fieldLabel, onDetected, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [hint, setHint] = useState("Loading scanner…");

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const handleDetected = useCallback((value: string) => {
    stopCamera();
    onDetected(value);
  }, [onDetected, stopCamera]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const BD = (window as any).BarcodeDetector;

      // Warm up WASM before opening the camera so the first scan isn't delayed.
      setHint("Loading scanner…");
      let formats: string[] = [];
      try { formats = await BD.getSupportedFormats(); } catch (_) {}
      if (cancelled) return;

      setHint("Opening camera…");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current!;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();
        if (cancelled) return;

        const detector = new BD({ formats: formats.length ? formats : undefined });
        setReady(true);
        setHint("Align barcode within the frame");

        async function tick() {
          if (cancelled || !streamRef.current) return;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            try {
              const results = await detector.detect(video);
              if (results.length > 0 && !cancelled) {
                handleDetected(results[0].rawValue);
                return;
              }
            } catch (_) { /* no barcode in this frame — normal */ }
          }
          rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);

      } catch (err: any) {
        if (cancelled) return;
        const msg = (err?.message ?? "") + (err?.name ?? "");
        if (location.protocol !== "https:") {
          setError("Camera requires a secure (HTTPS) connection. Open the installed app instead.");
        } else if (/NotAllowed|PermissionDenied/i.test(msg)) {
          const isStandalone = window.matchMedia("(display-mode: standalone)").matches
            || (navigator as { standalone?: boolean }).standalone === true;
          setError(isStandalone
            ? "Camera access denied. Go to Settings → Privacy → Camera and enable Studio Assets."
            : "Camera access denied. Check your browser's site settings and allow camera access.");
        } else if (/NotFound|DevicesNotFound/i.test(msg)) {
          setError("No camera found on this device.");
        } else if (/NotReadable|TrackStart/i.test(msg)) {
          setError("Camera is in use by another app. Close it and try again.");
        } else {
          setError("Could not start camera. Enter the value manually below.");
        }
      }
    }

    start();
    return () => { cancelled = true; stopCamera(); };
  }, [handleDetected, stopCamera]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 text-white shrink-0">
        <button onClick={() => { stopCamera(); onClose(); }}
          className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="font-semibold text-sm">Scan for {fieldLabel}</p>
          <p className="text-[11px] text-white/50">Barcode · QR · Data Matrix</p>
        </div>
      </div>

      {/* Camera error state */}
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5 text-white">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
            <Barcode className="h-8 w-8 opacity-60" />
          </div>
          <p className="text-center text-sm text-white/60 max-w-xs">{error}</p>
          <div className="w-full max-w-xs space-y-3">
            <Input
              autoFocus
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12"
              placeholder="Type or paste value…"
              value={manual}
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => e.key === "Enter" && manual.trim() && handleDetected(manual.trim())}
            />
            <Button className="w-full h-12"
              onClick={() => manual.trim() && handleDetected(manual.trim())}
              disabled={!manual.trim()}>
              Use This Value
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Live camera feed */}
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Dark mask with clear centre window */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <mask id="viewfinder-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <rect x="50%" y="50%" width="260" height="160" rx="12" fill="black"
                    transform="translate(-130, -80)" />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#viewfinder-mask)" />
            </svg>

            {/* Corner brackets */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-[260px] h-[160px]">
                {[
                  "top-0 left-0 border-t-3 border-l-3 rounded-tl-xl",
                  "top-0 right-0 border-t-3 border-r-3 rounded-tr-xl",
                  "bottom-0 left-0 border-b-3 border-l-3 rounded-bl-xl",
                  "bottom-0 right-0 border-b-3 border-r-3 rounded-br-xl",
                ].map((cls, i) => (
                  <div key={i} className={cn("absolute w-7 h-7 border-blue-400", cls)}
                    style={{ borderWidth: "3px" }} />
                ))}
                {ready && (
                  <div className="absolute left-2 right-2 h-0.5 bg-blue-400 rounded-full"
                    style={{
                      boxShadow: "0 0 8px 2px rgba(96,165,250,0.8)",
                      animation: "scanLine 1.8s ease-in-out infinite",
                      top: "10%",
                    }}
                  />
                )}
              </div>
            </div>

            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Bottom hint + manual entry */}
          <div className="shrink-0 p-5 text-white space-y-4">
            <p className="text-center text-sm text-white/60">{hint}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/15" />
              <span className="text-xs text-white/40">or enter manually</span>
              <div className="flex-1 h-px bg-white/15" />
            </div>
            <div className="flex gap-2">
              <Input
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 flex-1"
                placeholder="Paste / type value…"
                value={manual}
                onChange={e => setManual(e.target.value)}
                onKeyDown={e => e.key === "Enter" && manual.trim() && handleDetected(manual.trim())}
              />
              <Button variant="secondary" className="shrink-0"
                onClick={() => manual.trim() && handleDetected(manual.trim())}
                disabled={!manual.trim()}>
                Use
              </Button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes scanLine {
          0%   { top: 10%; }
          50%  { top: 80%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}

// ── Asset Card ─────────────────────────────────────────────────────────────────
interface AssetCardProps {
  asset: Asset;
  activeCheckout: (AssetCheckout & { checkedOutByName?: string }) | undefined;
  currentUserId: number;
  onCheckout: (asset: Asset) => void;
  onCheckin: (asset: Asset) => void;
  checkingIn: boolean;
}

function AssetCard({ asset, activeCheckout, currentUserId, onCheckout, onCheckin, checkingIn }: AssetCardProps) {
  const cat = getCat(asset.category);
  const st = STATUS_CONFIG[asset.status] ?? STATUS_CONFIG.available;
  const isCheckedOutByMe = activeCheckout?.checkedOutBy === currentUserId;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", cat.color)}>
          <Package className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">{asset.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full", cat.color)}>
              {cat.label}
            </span>
            <span className="flex items-center gap-1">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", st.dot)} />
              <span className={cn("text-[11px] font-medium", st.text)}>{st.label}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 dark:text-gray-400">
        {asset.serialNumber && (
          <span className="flex items-center gap-1 truncate">
            <Barcode className="h-3 w-3 shrink-0" />
            {asset.serialNumber}
          </span>
        )}
        {asset.location && (
          <span className="truncate">📍 {asset.location}</span>
        )}
        {activeCheckout && (
          <span className="col-span-2 flex items-center gap-1 text-rose-500 dark:text-rose-400 font-medium">
            <LogOutIcon className="h-3 w-3 shrink-0" />
            Out: {activeCheckout.checkedOutByName ?? `User #${activeCheckout.checkedOutBy}`}
            {activeCheckout.purpose ? ` · ${activeCheckout.purpose}` : ""}
          </span>
        )}
      </div>

      {/* Action button */}
      {asset.status !== "retired" && asset.status !== "maintenance" && (
        <div className="pt-1">
          {!activeCheckout ? (
            <Button
              size="sm"
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white gap-2"
              onClick={() => onCheckout(asset)}
            >
              <LogOutIcon className="h-4 w-4" />
              Check Out
            </Button>
          ) : isCheckedOutByMe ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-10 border-emerald-400 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 gap-2"
              onClick={() => onCheckin(asset)}
              disabled={checkingIn}
            >
              {checkingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Return
            </Button>
          ) : (
            <p className="text-center text-xs text-gray-400 italic py-2">Checked out by someone else</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MobileAssetsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "mine" | "available">("all");
  const [checkoutAsset, setCheckoutAsset] = useState<Asset | null>(null);
  const [checkoutPurpose, setCheckoutPurpose] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  // Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<"serial" | "tag" | null>(null);

  // ── PWA install ─────────────────────────────────────────────────────────────
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt?: () => Promise<void> } | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandalone = window.matchMedia("(display-mode: standalone)").matches
    || (navigator as { standalone?: boolean }).standalone === true;

  useEffect(() => {
    // Swap manifest to assets-specific manifest
    const existingLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const originalHref = existingLink?.href ?? "/manifest.json";
    let newLink: HTMLLinkElement | null = null;
    if (existingLink) {
      existingLink.setAttribute("href", "/manifest-assets.json");
    } else {
      newLink = document.createElement("link");
      newLink.rel = "manifest";
      newLink.href = "/manifest-assets.json";
      document.head.appendChild(newLink);
    }

    // Update apple-mobile-web-app-title for iOS
    const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const originalTitle = appleTitle?.content;
    if (appleTitle) appleTitle.content = "Studio Assets";

    // Show banner if not already installed
    if (!isInStandalone) {
      if (isIos) setShowInstallBanner(true);
    }

    // Android / Chrome install prompt
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as Event & { prompt?: () => Promise<void> });
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      // Restore original manifest
      if (existingLink) existingLink.setAttribute("href", originalHref);
      if (newLink) document.head.removeChild(newLink);
      if (appleTitle && originalTitle) appleTitle.content = originalTitle;
    };
  }, []);

  // Add-asset form
  const [newAsset, setNewAsset] = useState({
    name: "", category: "camera", serialNumber: "", assetTag: "",
    location: "", description: "", notes: "",
  });

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    refetchInterval: 30000,
  });

  const { data: activeCheckouts = [] } = useQuery<(AssetCheckout & { checkedOutByName?: string })[]>({
    queryKey: ["/api/assets/checkouts/active"],
    refetchInterval: 30000,
  });

  const checkoutMap = Object.fromEntries(activeCheckouts.map(c => [c.assetId, c]));

  // ── Mutations ──────────────────────────────────────────────────────────────
  const checkoutMutation = useMutation({
    mutationFn: (data: { assetId: number; purpose: string; notes: string }) =>
      apiRequest("POST", `/api/assets/${data.assetId}/checkout`, {
        purpose: data.purpose,
        notes: data.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets/checkouts/active"] });
      setCheckoutAsset(null);
      setCheckoutPurpose("");
      setCheckoutNotes("");
      toast({ title: "Checked out", description: "Asset is now checked out to you." });
    },
    onError: () => toast({ title: "Error", description: "Failed to check out asset.", variant: "destructive" }),
  });

  const checkinMutation = useMutation({
    mutationFn: (assetId: number) => apiRequest("POST", `/api/assets/${assetId}/checkin`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets/checkouts/active"] });
      setCheckingInId(null);
      toast({ title: "Returned", description: "Asset has been checked back in." });
    },
    onError: () => { setCheckingInId(null); toast({ title: "Error", description: "Failed to return asset.", variant: "destructive" }); },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newAsset) => apiRequest("POST", "/api/assets", { ...data, status: "available" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setAddOpen(false);
      setNewAsset({ name: "", category: "camera", serialNumber: "", assetTag: "", location: "", description: "", notes: "" });
      toast({ title: "Asset added", description: "New asset has been added to inventory." });
    },
    onError: () => toast({ title: "Error", description: "Failed to add asset.", variant: "destructive" }),
  });

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = assets.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      a.name.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      (a.serialNumber ?? "").toLowerCase().includes(q) ||
      (a.assetTag ?? "").toLowerCase().includes(q) ||
      (a.location ?? "").toLowerCase().includes(q);

    if (!matchSearch) return false;
    if (tab === "available") return a.status === "available" && !checkoutMap[a.id];
    if (tab === "mine") return !!checkoutMap[a.id] && checkoutMap[a.id].checkedOutBy === user?.id;
    return true;
  });

  const handleOpenScanner = (target: "serial" | "tag") => {
    setScanTarget(target);
    setScannerOpen(true);
  };

  const handleScanDetected = (value: string) => {
    setScannerOpen(false);
    if (scanTarget === "serial") setNewAsset(p => ({ ...p, serialNumber: value }));
    if (scanTarget === "tag") setNewAsset(p => ({ ...p, assetTag: value }));
    setScanTarget(null);
    toast({ title: "Scanned!", description: `Value captured: ${value}` });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* ── Standalone header ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Equipment</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{assets.length} items in inventory</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, serial, location…"
            className="pl-9 pr-8 h-10 rounded-xl"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {([
            { key: "all",       label: `All (${assets.length})` },
            { key: "mine",      label: `My Gear (${activeCheckouts.filter(c => c.checkedOutBy === user?.id).length})` },
            { key: "available", label: "Available" },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                tab === t.key
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Install banner ──────────────────────────────────────────────────── */}
      {showInstallBanner && !isInStandalone && (
        <div className="mx-4 mt-3 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-3.5 flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Add to Home Screen</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              {isIos
                ? <>Tap the <strong>Share</strong> button then <strong>"Add to Home Screen"</strong> to install Studio Assets as an app.</>
                : "Install Studio Assets for quick one-tap access from your home screen."}
            </p>
            {!isIos && installPrompt && (
              <button
                onClick={async () => {
                  await installPrompt.prompt?.();
                  setShowInstallBanner(false);
                  setInstallPrompt(null);
                }}
                className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold active:scale-95 transition-transform"
              >
                Install App
              </button>
            )}
          </div>
          <button
            onClick={() => setShowInstallBanner(false)}
            className="shrink-0 p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Asset list ──────────────────────────────────────────────────────── */}
      <div className="flex-1 p-4 pb-8 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Package className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {search ? "No assets match your search" : "No assets in this view"}
            </p>
          </div>
        ) : (
          filtered.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              activeCheckout={checkoutMap[asset.id]}
              currentUserId={user?.id ?? 0}
              onCheckout={setCheckoutAsset}
              onCheckin={(a) => {
                setCheckingInId(a.id);
                checkinMutation.mutate(a.id);
              }}
              checkingIn={checkinMutation.isPending && checkingInId === asset.id}
            />
          ))
        )}
      </div>

      {/* ── Check-out sheet ──────────────────────────────────────────────────── */}
      <Sheet open={!!checkoutAsset} onOpenChange={open => !open && setCheckoutAsset(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>Check Out Asset</SheetTitle>
          </SheetHeader>
          {checkoutAsset && (
            <div className="space-y-4 pb-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", getCat(checkoutAsset.category).color)}>
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{checkoutAsset.name}</p>
                  {checkoutAsset.serialNumber && (
                    <p className="text-xs text-gray-500"># {checkoutAsset.serialNumber}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Purpose / Production <span className="text-gray-400">(optional)</span></Label>
                <Input
                  placeholder="e.g. Weekend Live Shoot"
                  value={checkoutPurpose}
                  onChange={e => setCheckoutPurpose(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Notes <span className="text-gray-400">(optional)</span></Label>
                <Textarea
                  placeholder="Condition notes, return date, etc."
                  value={checkoutNotes}
                  onChange={e => setCheckoutNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                className="w-full h-12 text-base gap-2"
                onClick={() => checkoutAsset && checkoutMutation.mutate({
                  assetId: checkoutAsset.id,
                  purpose: checkoutPurpose,
                  notes: checkoutNotes,
                })}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOutIcon className="h-5 w-5" />}
                Confirm Check Out
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add asset sheet ──────────────────────────────────────────────────── */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
          <SheetHeader className="mb-4 sticky top-0 bg-white dark:bg-gray-900 pb-2">
            <SheetTitle>Add New Asset</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 pb-6">
            {/* Camera scan hint */}
            <div className="flex items-center gap-2.5 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
              <Camera className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Use the scan button next to Serial Number or Asset Tag to capture values with your camera.
              </p>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Asset Name *</Label>
              <Input
                placeholder="e.g. Sony FX6 Cinema Camera"
                value={newAsset.name}
                onChange={e => setNewAsset(p => ({ ...p, name: e.target.value }))}
                className="h-11"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={newAsset.category} onValueChange={v => setNewAsset(p => ({ ...p, category: v }))}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Serial number with scan */}
            <div className="space-y-1.5">
              <Label>Serial Number</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="S/N from label"
                  value={newAsset.serialNumber}
                  onChange={e => setNewAsset(p => ({ ...p, serialNumber: e.target.value }))}
                  className="h-11 flex-1"
                />
                <button
                  onClick={() => handleOpenScanner("serial")}
                  className="flex items-center gap-1.5 px-3 h-11 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all shrink-0"
                >
                  <ScanLine className="h-4 w-4 text-blue-500" />
                  Scan
                </button>
              </div>
            </div>

            {/* Asset tag with scan */}
            <div className="space-y-1.5">
              <Label>Asset Tag</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Internal tag / QR label"
                  value={newAsset.assetTag}
                  onChange={e => setNewAsset(p => ({ ...p, assetTag: e.target.value }))}
                  className="h-11 flex-1"
                />
                <button
                  onClick={() => handleOpenScanner("tag")}
                  className="flex items-center gap-1.5 px-3 h-11 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all shrink-0"
                >
                  <Tag className="h-4 w-4 text-purple-500" />
                  Scan
                </button>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input
                placeholder="e.g. Storage Room B, Shelf 3"
                value={newAsset.location}
                onChange={e => setNewAsset(p => ({ ...p, location: e.target.value }))}
                className="h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description / Model Details</Label>
              <Textarea
                placeholder="Model info, specs, purchase details…"
                value={newAsset.description}
                onChange={e => setNewAsset(p => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>

            <Button
              className="w-full h-12 text-base gap-2"
              onClick={() => createMutation.mutate(newAsset)}
              disabled={!newAsset.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              Add to Inventory
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Barcode scanner overlay ──────────────────────────────────────────── */}
      {scannerOpen && scanTarget && (
        <BarcodeScanner
          fieldLabel={scanTarget === "serial" ? "Serial Number" : "Asset Tag"}
          onDetected={handleScanDetected}
          onClose={() => { setScannerOpen(false); setScanTarget(null); }}
        />
      )}
    </div>
  );
}
