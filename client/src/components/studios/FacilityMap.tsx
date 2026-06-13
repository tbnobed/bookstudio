import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Save, X, Square, Hexagon, CalendarPlus, Download, Upload, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { compressImage } from "@/lib/imageCompress";
import { useStudioStatus } from "@/hooks/use-studio-status";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatTime, formatTimeRange, isBookingActive, FACILITY_TIMEZONE } from "@/lib/dateUtils";
import type { FacilityMapRoom, Studio, PcrRoom, Booking } from "@shared/schema";
import BookingModal from "@/components/booking/BookingModal";

// A studio reference photo placed at an exact spot on the facility map.
interface PhotoPin {
  id: number;
  studioId: number;
  photoData: string;
  caption: string | null;
  x: number;
  y: number;
}

const VIEW_W = 680;
const VIEW_H = 470;

type StatusKey = "available" | "in-use" | "maintenance" | "upcoming" | "neutral";

const STATUS_STYLE: Record<StatusKey, { fill: string; stroke: string; text: string; label: string }> = {
  available: { fill: "#1D9E75", stroke: "#0F6E56", text: "#04342C", label: "Available" },
  "in-use": { fill: "#E24B4A", stroke: "#A32D2D", text: "#501313", label: "In Use" },
  maintenance: { fill: "#F59E0B", stroke: "#B45309", text: "#3a2102", label: "Maintenance" },
  upcoming: { fill: "#FBBF24", stroke: "#D97706", text: "#3a2a02", label: "Upcoming" },
  neutral: { fill: "#CBD5E1", stroke: "#94A3B8", text: "#334155", label: "Unlinked" },
};

interface DraftRoom {
  uid: string;
  label: string;
  shapeType: "rect" | "polygon";
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  points: string | null;
  labelX: number | null;
  labelY: number | null;
  fontSize: number;
  fill: string | null;
  studioId: number | null;
  pcrRoomId: number | null;
  sortOrder: number;
}

function toDraft(r: FacilityMapRoom): DraftRoom {
  return {
    uid: `db-${r.id}`,
    label: r.label,
    shapeType: (r.shapeType as "rect" | "polygon") ?? "rect",
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    rx: r.rx,
    points: r.points,
    labelX: r.labelX ?? null,
    labelY: r.labelY ?? null,
    fontSize: r.fontSize,
    fill: r.fill,
    studioId: r.studioId,
    pcrRoomId: r.pcrRoomId,
    sortOrder: r.sortOrder,
  };
}

function parsePoints(points: string | null): Array<[number, number]> {
  if (!points) return [];
  return points
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [x, y] = p.split(",").map(Number);
      return [x, y] as [number, number];
    })
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

function serializePoints(pts: Array<[number, number]>): string {
  return pts.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" ");
}

// Squared distance from point P to segment AB (avoids sqrt for comparisons).
function distToSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

// Returns the index after which a new vertex should be inserted so it lands
// on the polygon edge nearest to the clicked point.
function nearestEdgeInsertIndex(pts: Array<[number, number]>, px: number, py: number): number {
  let best = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const d = distToSegmentSq(px, py, a[0], a[1], b[0], b[1]);
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Centroid of a shape, used to anchor the label.
function shapeCenter(r: DraftRoom): { cx: number; cy: number } {
  if (r.shapeType === "rect") {
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }
  const pts = parsePoints(r.points);
  if (pts.length === 0) return { cx: 0, cy: 0 };
  const sum = pts.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return { cx: sum[0] / pts.length, cy: sum[1] / pts.length };
}

function boundingBox(r: DraftRoom): { x: number; y: number; w: number; h: number } {
  if (r.shapeType === "rect") {
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }
  const pts = parsePoints(r.points);
  if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

export default function FacilityMap({ allowEdit = true }: { allowEdit?: boolean }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const canEdit =
    allowEdit && !isMobile &&
    (user?.role === "admin" ||
      user?.role === "site_manager" ||
      user?.role === "engineer" ||
      user?.role === "it");
  // Backup / restore of the whole map config is admin-only.
  const isAdmin = user?.role === "admin";
  // Studio reference photos: same management roles as the map, but allowed on
  // mobile too so managers can capture angle shots with a phone camera.
  const canManagePhotos =
    user?.role === "admin" ||
    user?.role === "site_manager" ||
    user?.role === "engineer" ||
    user?.role === "it";

  // Photo-pin state. A pin is a studio reference photo dropped at an exact spot
  // on the map; any authenticated user can click a pin to view that angle.
  const [addPinMode, setAddPinMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<
    { x: number; y: number; studioId: number; studioName: string } | null
  >(null);
  const [pinPhoto, setPinPhoto] = useState<string | null>(null);
  const [pinCaption, setPinCaption] = useState("");
  const [pinUploading, setPinUploading] = useState(false);
  const [pinViewer, setPinViewer] = useState<PhotoPin | null>(null);
  const [hoverPin, setHoverPin] = useState<PhotoPin | null>(null);
  const pinFileRef = useRef<HTMLInputElement | null>(null);

  const { data: rooms = [] } = useQuery<FacilityMapRoom[]>({
    queryKey: ["/api/facility-map"],
  });
  const { data: studios = [] } = useQuery<Studio[]>({ queryKey: ["/api/studios"] });
  const { data: photoPins = [] } = useQuery<PhotoPin[]>({
    queryKey: ["/api/facility-map/photo-pins"],
  });
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({ queryKey: ["/api/pcr-rooms"] });
  const { data: bookings = [] } = useQuery<Booking[]>({ queryKey: ["/api/bookings"] });
  const { data: userNames = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/users/names"],
  });
  const { data: bookingStudioLinks = [] } = useQuery<{ bookingId: number; studioId: number }[]>({
    queryKey: ["/api/booking-studios"],
  });
  const { getStudioStatus } = useStudioStatus();

  const getUserName = (id?: number | null) =>
    id == null ? undefined : userNames.find((u) => u.id === id)?.name;

  const formatBookingType = (type?: string | null) => {
    if (!type) return undefined;
    const map: Record<string, string> = {
      production: "Production",
      rehearsal: "Rehearsal",
      maintenance: "Maintenance",
      it_support: "IT Support",
      meeting: "Meeting",
    };
    return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<DraftRoom[]>([]);
  // Editable copy of the photo pins while in edit mode, so they translate
  // along with their studio's shape when it is moved.
  const [pinDraft, setPinDraft] = useState<PhotoPin[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [bookingStudioId, setBookingStudioId] = useState<number | undefined>(undefined);
  const [bookingPcrRoomId, setBookingPcrRoomId] = useState<number | undefined>(undefined);
  const [bookingOpen, setBookingOpen] = useState(false);
  // Ticks every minute so time-relative views (the 15-day window, active dots)
  // stay correct while the page is left open.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<
    | null
    | {
        mode: "move" | "resize" | "vertex" | "label";
        uid: string;
        vertexIndex?: number;
        startX: number;
        startY: number;
        orig: DraftRoom;
        pinOrigins?: { id: number; x: number; y: number }[];
      }
  >(null);

  // Pins currently rendered: the editable draft while editing, otherwise the
  // server copy.
  const displayPins: PhotoPin[] = isEditing ? pinDraft : photoPins;

  // Shapes currently rendered: draft when editing, otherwise the server copy.
  const display: DraftRoom[] = useMemo(
    () => (isEditing ? draft : rooms.map(toDraft)),
    [isEditing, draft, rooms],
  );

  const resolveStatus = useCallback(
    (r: DraftRoom): { key: StatusKey; currentBooking?: any; nextBooking?: any } => {
      if (r.studioId) {
        const s = getStudioStatus(r.studioId);
        return {
          key: s.status as StatusKey,
          currentBooking: s.currentBooking,
          nextBooking: s.nextBooking,
        };
      }
      if (r.pcrRoomId) {
        const pcr = pcrRooms.find((p) => p.id === r.pcrRoomId);
        if (pcr) {
          const nowMs = Date.now();
          const pcrBookings = bookings
            .filter((b) => b.pcrRoomId === r.pcrRoomId && b.status !== "cancelled")
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
          // Use the project's canonical, instant-based active check (booking
          // times are stored as absolute UTC, so this is timezone-independent).
          const currentBooking = pcrBookings.find((b) => isBookingActive(b));
          const nextBooking = pcrBookings.find((b) => new Date(b.start).getTime() > nowMs);

          if (pcr.status === "maintenance") return { key: "maintenance", currentBooking, nextBooking };
          if (currentBooking || pcr.status === "in-use" || pcr.status === "booked")
            return { key: "in-use", currentBooking, nextBooking };
          if (nextBooking) return { key: "upcoming", nextBooking };
          return { key: "available" };
        }
      }
      return { key: "neutral" };
    },
    [getStudioStatus, pcrRooms, bookings],
  );

  const linkedRooms = display.filter((r) => r.studioId || r.pcrRoomId);
  const availableCount = linkedRooms.filter((r) => resolveStatus(r).key === "available").length;

  const selected = display.find((r) => r.uid === selectedUid) || null;

  const toSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW_W,
      y: ((clientY - rect.top) / rect.height) * VIEW_H,
    };
  };

  const updateDraft = (uid: string, patch: Partial<DraftRoom>) => {
    setDraft((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const ctx = dragRef.current;
    if (!ctx) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cur = {
      x: ((e.clientX - rect.left) / rect.width) * VIEW_W,
      y: ((e.clientY - rect.top) / rect.height) * VIEW_H,
    };
    const dx = cur.x - ctx.startX;
    const dy = cur.y - ctx.startY;
    const o = ctx.orig;

    // When the whole shape moves, carry its studio's photo pins along with it.
    // Pins are clamped to the map bounds so they never leave the floorplan
    // (and so the save-time PATCH, which rejects out-of-bounds, can't fail).
    if (ctx.mode === "move" && ctx.pinOrigins && ctx.pinOrigins.length) {
      setPinDraft((prev) =>
        prev.map((p) => {
          const origin = ctx.pinOrigins!.find((po) => po.id === p.id);
          if (!origin) return p;
          return {
            ...p,
            x: Math.max(0, Math.min(VIEW_W, origin.x + dx)),
            y: Math.max(0, Math.min(VIEW_H, origin.y + dy)),
          };
        }),
      );
    }

    setDraft((prev) =>
      prev.map((r) => {
        if (r.uid !== ctx.uid) return r;
        if (ctx.mode === "move") {
          if (o.shapeType === "rect") {
            return { ...r, x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
          }
          const pts = parsePoints(o.points).map(
            ([px, py]) => [px + dx, py + dy] as [number, number],
          );
          return { ...r, points: serializePoints(pts) };
        }
        if (ctx.mode === "resize") {
          return {
            ...r,
            width: Math.max(20, Math.round(o.width + dx)),
            height: Math.max(20, Math.round(o.height + dy)),
          };
        }
        if (ctx.mode === "vertex" && ctx.vertexIndex !== undefined) {
          const pts = parsePoints(o.points).map(
            (p, i) => (i === ctx.vertexIndex ? ([p[0] + dx, p[1] + dy] as [number, number]) : p),
          );
          return { ...r, points: serializePoints(pts) };
        }
        if (ctx.mode === "label") {
          const base =
            o.labelX != null && o.labelY != null
              ? { cx: o.labelX, cy: o.labelY }
              : shapeCenter(o);
          return { ...r, labelX: base.cx + dx, labelY: base.cy + dy };
        }
        return r;
      }),
    );
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  const startDrag = (
    e: React.PointerEvent,
    room: DraftRoom,
    mode: "move" | "resize" | "vertex" | "label",
    vertexIndex?: number,
  ) => {
    if (!isEditing) return;
    e.stopPropagation();
    setSelectedUid(room.uid);
    const start = toSvgCoords(e.clientX, e.clientY);
    // Capture the starting positions of this studio's pins so they can be
    // translated by the same delta as the shape during a move.
    const pinOrigins =
      mode === "move" && room.studioId
        ? pinDraft
            .filter((p) => p.studioId === room.studioId)
            .map((p) => ({ id: p.id, x: p.x, y: p.y }))
        : undefined;
    dragRef.current = {
      mode,
      uid: room.uid,
      vertexIndex,
      startX: start.x,
      startY: start.y,
      orig: room,
      pinOrigins,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const enterEdit = () => {
    setDraft(rooms.map(toDraft));
    setPinDraft(photoPins.map((p) => ({ ...p })));
    setSelectedUid(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft([]);
    setPinDraft([]);
    setSelectedUid(null);
  };

  const nextSortOrder = () =>
    (draft.length ? Math.max(...draft.map((r) => r.sortOrder)) : 0) + 10;

  const addRect = () => {
    const uid = `new-${Date.now()}`;
    setDraft((prev) => [
      ...prev,
      {
        uid,
        label: "New",
        shapeType: "rect",
        x: 300,
        y: 200,
        width: 90,
        height: 60,
        rx: 6,
        points: null,
        labelX: null,
        labelY: null,
        fontSize: 14,
        fill: null,
        studioId: null,
        pcrRoomId: null,
        sortOrder: nextSortOrder(),
      },
    ]);
    setSelectedUid(uid);
  };

  const addPolygon = () => {
    const uid = `new-${Date.now()}`;
    setDraft((prev) => [
      ...prev,
      {
        uid,
        label: "New",
        shapeType: "polygon",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rx: 0,
        points: "300,200 390,200 390,270 300,270",
        labelX: null,
        labelY: null,
        fontSize: 14,
        fill: null,
        studioId: null,
        pcrRoomId: null,
        sortOrder: nextSortOrder(),
      },
    ]);
    setSelectedUid(uid);
  };

  const deleteSelected = () => {
    if (!selectedUid) return;
    setDraft((prev) => prev.filter((r) => r.uid !== selectedUid));
    setSelectedUid(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = draft.map((r) => ({
        label: r.label,
        shapeType: r.shapeType,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        rx: r.rx,
        points: r.shapeType === "polygon" ? r.points : null,
        labelX: r.labelX,
        labelY: r.labelY,
        fontSize: r.fontSize,
        fill: r.fill,
        studioId: r.studioId,
        pcrRoomId: r.pcrRoomId,
        sortOrder: r.sortOrder,
      }));
      await apiRequest("PUT", "/api/facility-map", payload);

      // Persist any pins that were dragged along with their studio's shape.
      const movedPins = pinDraft.filter((p) => {
        const orig = photoPins.find((o) => o.id === p.id);
        return orig && (orig.x !== p.x || orig.y !== p.y);
      });
      if (movedPins.length) {
        await Promise.all(
          movedPins.map((p) =>
            apiRequest("PATCH", `/api/studios/${p.studioId}/photos/${p.id}/position`, {
              x: Math.round(p.x),
              y: Math.round(p.y),
            }),
          ),
        );
        await queryClient.invalidateQueries({ queryKey: ["/api/facility-map/photo-pins"] });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/facility-map"] });
      toast({ title: "Layout saved", description: "Facility map updated." });
      setIsEditing(false);
      setDraft([]);
      setPinDraft([]);
      setSelectedUid(null);
    } catch (err: any) {
      // A pin PATCH may have committed after the map PUT (or vice versa); refetch
      // both so the UI reflects whatever actually persisted, not the draft.
      await queryClient.invalidateQueries({ queryKey: ["/api/facility-map"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/facility-map/photo-pins"] });
      toast({
        title: "Save failed",
        description: err?.message || "Could not save the layout.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Admin-only: download the current map layout as a JSON backup file.
  const downloadBackup = () => {
    const doc = {
      type: "bookstudio-facility-map",
      version: 1,
      exportedAt: new Date().toISOString(),
      rooms: rooms.map((r) => ({
        label: r.label,
        shapeType: r.shapeType,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        rx: r.rx,
        points: r.points,
        labelX: r.labelX,
        labelY: r.labelY,
        fontSize: r.fontSize,
        fill: r.fill,
        studioId: r.studioId,
        pcrRoomId: r.pcrRoomId,
        sortOrder: r.sortOrder,
      })),
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `facility-map-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "Backup downloaded", description: `Saved ${doc.rooms.length} room(s).` });
  };

  // Admin-only: restore a map layout from a previously downloaded JSON file.
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so selecting the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const roomsArr = Array.isArray(parsed) ? parsed : parsed?.rooms;
      if (!Array.isArray(roomsArr)) {
        throw new Error("This file does not contain a valid map configuration.");
      }
      const payload = roomsArr.map((r: any, i: number) => {
        if (typeof r !== "object" || r === null) {
          throw new Error(`Room ${i + 1} in the file is invalid.`);
        }
        const shapeType = r.shapeType === "polygon" ? "polygon" : "rect";
        return {
          label: String(r.label ?? ""),
          shapeType,
          x: Math.round(Number(r.x) || 0),
          y: Math.round(Number(r.y) || 0),
          width: Math.round(Number(r.width) || 0),
          height: Math.round(Number(r.height) || 0),
          rx: Math.round(Number(r.rx) || 0),
          points: shapeType === "polygon" ? (r.points ?? null) : null,
          // Label coords are only meaningful as a pair; drop them unless both are valid.
          labelX:
            Number.isFinite(Number(r.labelX)) && Number.isFinite(Number(r.labelY))
              ? Number(r.labelX)
              : null,
          labelY:
            Number.isFinite(Number(r.labelX)) && Number.isFinite(Number(r.labelY))
              ? Number(r.labelY)
              : null,
          fontSize: Math.round(Number(r.fontSize) || 14),
          fill: r.fill ?? null,
          // Drop links to studios / PCR rooms that no longer exist to avoid FK errors.
          studioId: studios.some((s) => s.id === r.studioId) ? r.studioId : null,
          pcrRoomId: pcrRooms.some((p) => p.id === r.pcrRoomId) ? r.pcrRoomId : null,
          sortOrder: Math.round(Number(r.sortOrder) || (i + 1) * 10),
        };
      });
      if (
        !window.confirm(
          `Restore ${payload.length} room(s) from this file? This replaces the entire current map layout.`,
        )
      ) {
        return;
      }
      setRestoring(true);
      await apiRequest("PUT", "/api/facility-map", payload);
      await queryClient.invalidateQueries({ queryKey: ["/api/facility-map"] });
      toast({ title: "Map restored", description: `Loaded ${payload.length} room(s) from backup.` });
    } catch (err: any) {
      toast({
        title: "Restore failed",
        description: err?.message || "Could not read the map file.",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  };

  const onShapeClick = (e: React.MouseEvent, room: DraftRoom) => {
    // Prevent the SVG background onClick (which deselects) from firing.
    e.stopPropagation();
    // In add-pin mode, clicking a studio drops a photo pin at the exact spot.
    if (addPinMode) {
      if (!room.studioId) {
        toast({
          title: "Pick a studio",
          description: "Photo pins must be placed on a studio room.",
          variant: "destructive",
        });
        return;
      }
      const { x, y } = toSvgCoords(e.clientX, e.clientY);
      setPendingPin({
        x,
        y,
        studioId: room.studioId,
        studioName: studios.find((s) => s.id === room.studioId)?.name || room.label,
      });
      return;
    }
    setSelectedUid(room.uid);
  };

  const closePinDialog = () => {
    setPendingPin(null);
    setPinPhoto(null);
    setPinCaption("");
  };

  const onPickPinPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPinUploading(true);
    try {
      setPinPhoto(await compressImage(file));
    } catch (err: any) {
      toast({
        title: "Couldn't load image",
        description: err?.message || "Please try a different photo.",
        variant: "destructive",
      });
    } finally {
      setPinUploading(false);
    }
  };

  const savePin = async () => {
    if (!pendingPin || !pinPhoto) return;
    setPinUploading(true);
    try {
      const res = await apiRequest("POST", `/api/studios/${pendingPin.studioId}/photos`, {
        photoData: pinPhoto,
        caption: pinCaption.trim() || undefined,
        x: pendingPin.x,
        y: pendingPin.y,
      });
      // Mirror the new pin into the edit draft so it renders immediately
      // (while editing, pins are drawn from pinDraft, not the live query).
      try {
        const created = (await res.json()) as PhotoPin;
        if (created && typeof created.x === "number" && typeof created.y === "number") {
          setPinDraft((prev) => [...prev, created]);
        }
      } catch {
        /* response body is optional for the draft sync */
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/facility-map/photo-pins"] });
      toast({ title: "Photo pin added", description: `Pinned to ${pendingPin.studioName}.` });
      closePinDialog();
      setAddPinMode(false);
    } catch (err: any) {
      toast({
        title: "Couldn't save pin",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPinUploading(false);
    }
  };

  const deletePin = async (pin: PhotoPin) => {
    if (!window.confirm("Delete this photo pin?")) return;
    try {
      await apiRequest("DELETE", `/api/studios/${pin.studioId}/photos/${pin.id}`);
      setPinDraft((prev) => prev.filter((p) => p.id !== pin.id));
      await queryClient.invalidateQueries({ queryKey: ["/api/facility-map/photo-pins"] });
      setPinViewer(null);
    } catch (err: any) {
      toast({
        title: "Couldn't delete pin",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add a vertex on the polygon edge nearest the double-clicked point.
  const addVertexAtPoint = (room: DraftRoom, clientX: number, clientY: number) => {
    if (!isEditing || room.shapeType !== "polygon") return;
    const { x, y } = toSvgCoords(clientX, clientY);
    setDraft((prev) =>
      prev.map((r) => {
        if (r.uid !== room.uid) return r;
        const pts = parsePoints(r.points);
        if (pts.length < 2) return r;
        const idx = nearestEdgeInsertIndex(pts, x, y);
        const next = [...pts];
        next.splice(idx + 1, 0, [Math.round(x), Math.round(y)]);
        return { ...r, points: serializePoints(next) };
      }),
    );
    setSelectedUid(room.uid);
  };

  // Remove a vertex (keep at least a triangle).
  const removeVertex = (room: DraftRoom, index: number) => {
    if (!isEditing || room.shapeType !== "polygon") return;
    setDraft((prev) =>
      prev.map((r) => {
        if (r.uid !== room.uid) return r;
        const pts = parsePoints(r.points);
        if (pts.length <= 3) return r;
        return { ...r, points: serializePoints(pts.filter((_, i) => i !== index)) };
      }),
    );
  };

  const openBooking = (room: DraftRoom) => {
    setBookingStudioId(room.studioId ?? undefined);
    setBookingPcrRoomId(room.pcrRoomId ?? undefined);
    setBookingOpen(true);
  };

  const renderShape = (room: DraftRoom) => {
    const status = resolveStatus(room);
    const style = STATUS_STYLE[status.key] ?? STATUS_STYLE.neutral;
    const fill = room.fill || style.fill;
    const isSel = selectedUid === room.uid;
    const { cx, cy } = shapeCenter(room);
    const cursor = addPinMode ? "crosshair" : isEditing ? "move" : "pointer";

    const shapeEl =
      room.shapeType === "rect" ? (
        <rect
          x={room.x}
          y={room.y}
          width={room.width}
          height={room.height}
          rx={room.rx}
          fill={fill}
          stroke={isSel ? "#2563EB" : style.stroke}
          strokeWidth={isSel ? 2 : 0.5}
        />
      ) : (
        <polygon
          points={room.points || ""}
          fill={fill}
          stroke={isSel ? "#2563EB" : style.stroke}
          strokeWidth={isSel ? 2 : 0.5}
        />
      );

    return (
      <g
        key={room.uid}
        style={{ cursor }}
        onClick={(e) => onShapeClick(e, room)}
        onDoubleClick={(e) =>
          isEditing && room.shapeType === "polygon"
            ? (e.stopPropagation(), addVertexAtPoint(room, e.clientX, e.clientY))
            : undefined
        }
        onPointerDown={(e) => (isEditing && !addPinMode ? startDrag(e, room, "move") : undefined)}
        className="transition-opacity hover:opacity-80"
      >
        {shapeEl}
        {room.label && (() => {
          const lx = room.labelX != null && room.labelY != null ? room.labelX : cx;
          const ly = room.labelX != null && room.labelY != null ? room.labelY : cy;
          const labelDraggable = isEditing && !addPinMode;
          return (
            <text
              x={lx}
              y={ly + room.fontSize / 3}
              textAnchor="middle"
              fontSize={room.fontSize}
              fontWeight={500}
              fill={style.text}
              style={{
                pointerEvents: labelDraggable ? "auto" : "none",
                cursor: labelDraggable ? "move" : "default",
                userSelect: "none",
              }}
              onPointerDown={(e) => (labelDraggable ? startDrag(e, room, "label") : undefined)}
            >
              {room.label}
            </text>
          );
        })()}
        {/* Edit handles */}
        {isEditing && isSel && room.shapeType === "rect" && (
          <rect
            x={room.x + room.width - 6}
            y={room.y + room.height - 6}
            width={12}
            height={12}
            fill="#2563EB"
            stroke="#fff"
            strokeWidth={1}
            style={{ cursor: "nwse-resize" }}
            onPointerDown={(e) => startDrag(e, room, "resize")}
          />
        )}
        {isEditing && isSel && room.shapeType === "polygon" &&
          parsePoints(room.points).map(([px, py], i) => (
            <circle
              key={i}
              cx={px}
              cy={py}
              r={5}
              fill="#2563EB"
              stroke="#fff"
              strokeWidth={1}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => startDrag(e, room, "vertex", i)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                removeVertex(room, i);
              }}
            />
          ))}
      </g>
    );
  };

  const selectedStatus = selected ? resolveStatus(selected) : null;
  const selectedStyle = selectedStatus ? STATUS_STYLE[selectedStatus.key] : null;

  // Next 15 days of bookings for the currently selected room. Bookings are
  // stored as absolute instants, so the window is an instant-based forward
  // range (ongoing + upcoming within 15 days).
  const selectedUpcoming = useMemo(() => {
    if (!selected || (!selected.studioId && !selected.pcrRoomId)) return [];
    const nowMs = Date.now();
    const windowEndMs = nowMs + 15 * 24 * 60 * 60 * 1000;
    return bookings
      .filter((b) => b.status !== "cancelled")
      .filter((b) =>
        selected.studioId
          ? b.studioId === selected.studioId ||
            bookingStudioLinks.some(
              (l) => l.bookingId === b.id && l.studioId === selected.studioId,
            )
          : b.pcrRoomId === selected.pcrRoomId,
      )
      .filter((b) => {
        const startMs = new Date(b.start).getTime();
        const endMs = new Date(b.end).getTime();
        return endMs > nowMs && startMs < windowEndMs;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [selected, bookings, bookingStudioLinks, nowTick]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS_STYLE.available.fill }} />
            Available
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS_STYLE["in-use"].fill }} />
            In Use
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS_STYLE.maintenance.fill }} />
            Maintenance
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS_STYLE.upcoming.fill }} />
            Upcoming
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {availableCount} of {linkedRooms.length} rooms available
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        {canEdit && !isEditing && (
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleRestoreFile}
                  data-testid="input-restore-map"
                />
                <Button size="sm" variant="outline" onClick={downloadBackup} data-testid="button-backup-map">
                  <Download className="h-4 w-4 mr-1.5" /> Backup
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={restoring}
                  data-testid="button-restore-map"
                >
                  <Upload className="h-4 w-4 mr-1.5" /> {restoring ? "Restoring…" : "Restore"}
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={enterEdit} data-testid="button-edit-map">
              <Pencil className="h-4 w-4 mr-1.5" /> Edit layout
            </Button>
          </div>
        )}
        {canEdit && isEditing && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={addRect} data-testid="button-add-rect">
              <Square className="h-4 w-4 mr-1.5" /> Rectangle
            </Button>
            <Button size="sm" variant="outline" onClick={addPolygon} data-testid="button-add-polygon">
              <Hexagon className="h-4 w-4 mr-1.5" /> Polygon
            </Button>
            {canManagePhotos && (
              <Button
                size="sm"
                variant={addPinMode ? "default" : "outline"}
                onClick={() => {
                  setAddPinMode((v) => !v);
                  setSelectedUid(null);
                }}
                data-testid="button-add-photo-pin"
              >
                <Camera className="h-4 w-4 mr-1.5" />
                {addPinMode ? "Click a studio…" : "Add photo pin"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={deleteSelected} disabled={!selectedUid} data-testid="button-delete-shape">
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} data-testid="button-cancel-edit">
              <X className="h-4 w-4 mr-1.5" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving} data-testid="button-save-map">
              <Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
        </div>
      </div>

      {addPinMode && (
        <p className="text-xs text-blue-600 dark:text-blue-400" data-testid="text-add-pin-hint">
          Click the spot on a studio where the photo was taken to drop a pin.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="img"
            aria-label="Facility map"
            style={{ display: "block", touchAction: "none" }}
            onClick={() => {
              if (isEditing) setSelectedUid(null);
            }}
          >
            {display.map((room) => renderShape(room))}
            {/* Photo pins — studio reference shots placed at exact spots.
                Visible to everyone in view mode; adding is editor-only.
                While editing, pins are drawn from the draft so they translate
                with their studio's shape. */}
            {displayPins.map((pin) => (
                <g
                  key={`pin-${pin.id}`}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinViewer(pin);
                  }}
                  onMouseEnter={() => setHoverPin(pin)}
                  onMouseLeave={() => setHoverPin((p) => (p?.id === pin.id ? null : p))}
                  className="transition-opacity hover:opacity-80"
                  data-testid={`photo-pin-${pin.id}`}
                >
                  <circle cx={pin.x} cy={pin.y} r={5.5} fill="#2563EB" stroke="#fff" strokeWidth={1} />
                  <rect x={pin.x - 2} y={pin.y - 1.25} width={4} height={3} rx={0.6} fill="#fff" />
                  <rect x={pin.x - 0.75} y={pin.y - 2} width={1.5} height={0.9} rx={0.25} fill="#fff" />
                  <circle cx={pin.x} cy={pin.y + 0.35} r={0.85} fill="#2563EB" />
                </g>
              ))}
            {/* Hover preview: load the angle photo right next to the pin */}
            {hoverPin && (() => {
              const pw = 150;
              const ph = 112;
              const pad = 3;
              let bx = hoverPin.x + 16;
              let by = hoverPin.y - ph - 10;
              if (bx + pw + pad > VIEW_W) bx = hoverPin.x - pw - 16;
              if (bx < pad) bx = pad;
              if (by < pad) by = hoverPin.y + 16;
              if (by + ph + pad > VIEW_H) by = VIEW_H - ph - pad;
              const clipId = `pin-clip-${hoverPin.id}`;
              return (
                <g style={{ pointerEvents: "none" }} data-testid={`photo-pin-preview-${hoverPin.id}`}>
                  <defs>
                    <clipPath id={clipId}>
                      <rect x={bx} y={by} width={pw} height={ph} rx={4} />
                    </clipPath>
                  </defs>
                  <rect
                    x={bx - pad}
                    y={by - pad}
                    width={pw + pad * 2}
                    height={ph + pad * 2}
                    rx={6}
                    fill="#ffffff"
                    stroke="#2563EB"
                    strokeWidth={1.5}
                  />
                  <image
                    href={hoverPin.photoData}
                    x={bx}
                    y={by}
                    width={pw}
                    height={ph}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#${clipId})`}
                  />
                  {hoverPin.caption && (
                    <>
                      <rect x={bx} y={by + ph - 18} width={pw} height={18} fill="rgba(0,0,0,0.55)" clipPath={`url(#${clipId})`} />
                      <text x={bx + 6} y={by + ph - 6} fontSize={9} fill="#ffffff">
                        {hoverPin.caption.length > 26 ? `${hoverPin.caption.slice(0, 26)}…` : hoverPin.caption}
                      </text>
                    </>
                  )}
                </g>
              );
            })()}
            {pendingPin && (
              <circle
                cx={pendingPin.x}
                cy={pendingPin.y}
                r={9}
                fill="none"
                stroke="#2563EB"
                strokeWidth={2}
                strokeDasharray="3 2"
              />
            )}
          </svg>
        </div>

        {/* Side panel */}
        <div className="lg:border-l lg:border-gray-200 lg:dark:border-neutral-700 lg:pl-6">
          {isEditing && selected ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm dark:text-white">Room properties</h3>
              <div className="space-y-1.5">
                <Label className="text-xs">Label</Label>
                <Input
                  value={selected.label}
                  onChange={(e) => updateDraft(selected.uid, { label: e.target.value })}
                  data-testid="input-room-label"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Font size</Label>
                <Input
                  type="number"
                  min={8}
                  max={48}
                  value={selected.fontSize}
                  onChange={(e) =>
                    updateDraft(selected.uid, { fontSize: parseInt(e.target.value) || 14 })
                  }
                  data-testid="input-room-fontsize"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Label position</Label>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const bb = boundingBox(selected);
                      updateDraft(selected.uid, {
                        labelX: bb.x + bb.w / 2,
                        labelY: bb.y + bb.h / 2,
                      });
                    }}
                    data-testid="button-center-label"
                  >
                    Center label
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateDraft(selected.uid, { labelX: null, labelY: null })}
                    disabled={selected.labelX == null && selected.labelY == null}
                  >
                    Reset
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400">
                  Drag the name on the map to position it, or center it in the room.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Linked studio</Label>
                <Select
                  value={selected.studioId ? String(selected.studioId) : "none"}
                  onValueChange={(v) =>
                    updateDraft(selected.uid, {
                      studioId: v === "none" ? null : parseInt(v),
                      pcrRoomId: v === "none" ? selected.pcrRoomId : null,
                    })
                  }
                >
                  <SelectTrigger data-testid="select-room-studio">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {studios.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Linked PCR room</Label>
                <Select
                  value={selected.pcrRoomId ? String(selected.pcrRoomId) : "none"}
                  onValueChange={(v) =>
                    updateDraft(selected.uid, {
                      pcrRoomId: v === "none" ? null : parseInt(v),
                      studioId: v === "none" ? selected.studioId : null,
                    })
                  }
                >
                  <SelectTrigger data-testid="select-room-pcr">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {pcrRooms.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fill color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="w-12 p-1 h-9"
                    value={selected.fill || "#1D9E75"}
                    onChange={(e) => updateDraft(selected.uid, { fill: e.target.value })}
                    data-testid="input-room-fill"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateDraft(selected.uid, { fill: null })}
                  >
                    Auto (status)
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400">
                  Leave on Auto to color the room from its live booking status.
                </p>
              </div>
              {selected.shapeType === "polygon" && (
                <div className="space-y-1.5 pt-1 border-t dark:border-neutral-700">
                  <Label className="text-xs">Shape points</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      addVertexAtPoint(
                        selected,
                        ...(() => {
                          // Insert a point at the longest edge's midpoint.
                          const pts = parsePoints(selected.points);
                          if (pts.length < 2) return [0, 0] as [number, number];
                          let li = 0;
                          let lmax = -1;
                          for (let i = 0; i < pts.length; i++) {
                            const a = pts[i];
                            const b = pts[(i + 1) % pts.length];
                            const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
                            if (d > lmax) {
                              lmax = d;
                              li = i;
                            }
                          }
                          const a = pts[li];
                          const b = pts[(li + 1) % pts.length];
                          const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
                          const svg = svgRef.current;
                          if (!svg) return mid;
                          // Convert SVG coords back to client coords for the handler.
                          const rect = svg.getBoundingClientRect();
                          const sx = rect.left + (mid[0] / VIEW_W) * rect.width;
                          const sy = rect.top + (mid[1] / VIEW_H) * rect.height;
                          return [sx, sy] as [number, number];
                        })(),
                      )
                    }
                    data-testid="button-add-point"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add point
                  </Button>
                  <p className="text-[11px] text-gray-400">
                    Double-click an edge to add a point there, or double-click a blue dot to remove
                    it (minimum 3 points).
                  </p>
                </div>
              )}
            </div>
          ) : isEditing ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a shape to edit it, or add a new Rectangle / Polygon. Drag shapes to move, drag
              the corner handle to resize a rectangle, and drag the blue dots to reshape polygons.
              Double-click a polygon edge to add a point, or double-click a dot to remove it.
            </p>
          ) : selected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: selected.fill || selectedStyle?.fill }}
                />
                <span className="font-semibold dark:text-white">
                  {selected.label || "Room"}
                </span>
                <span className="text-xs font-medium" style={{ color: selectedStyle?.fill }}>
                  {selectedStyle?.label}
                </span>
              </div>

              {(() => {
                const linkedStudio = selected.studioId
                  ? studios.find((s) => s.id === selected.studioId)
                  : undefined;
                const linkedPcr = selected.pcrRoomId
                  ? pcrRooms.find((p) => p.id === selected.pcrRoomId)
                  : undefined;
                return (
                  <>
                    {linkedStudio && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-600 dark:text-gray-300">Studio:</span>{" "}
                        {linkedStudio.name}
                        {linkedStudio.description && (
                          <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                            {linkedStudio.description}
                          </p>
                        )}
                      </div>
                    )}
                    {linkedPcr && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-600 dark:text-gray-300">PCR:</span>{" "}
                        {linkedPcr.name}
                        {linkedPcr.description && (
                          <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                            {linkedPcr.description}
                          </p>
                        )}
                      </div>
                    )}
                    {!linkedStudio && !linkedPcr && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        This shape isn't linked to a studio or control room.
                      </p>
                    )}
                  </>
                );
              })()}

              {selectedStatus?.currentBooking && (
                <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2.5 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
                    On air now
                  </div>
                  <div className="font-medium text-sm dark:text-gray-100">
                    {selectedStatus.currentBooking.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimeRange(
                      selectedStatus.currentBooking.start,
                      selectedStatus.currentBooking.end,
                    )}
                  </div>
                  {formatBookingType(selectedStatus.currentBooking.type) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Type: {formatBookingType(selectedStatus.currentBooking.type)}
                    </div>
                  )}
                  {getUserName(selectedStatus.currentBooking.userId) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Booked by: {getUserName(selectedStatus.currentBooking.userId)}
                    </div>
                  )}
                  {selectedStatus.currentBooking.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedStatus.currentBooking.description}
                    </div>
                  )}
                </div>
              )}

              {selectedStatus?.nextBooking && (
                <div className="rounded-md border border-gray-200 dark:border-gray-700 p-2.5 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-500">
                    Next up
                  </div>
                  <div className="font-medium text-sm dark:text-gray-100">
                    {selectedStatus.nextBooking.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimeRange(
                      selectedStatus.nextBooking.start,
                      selectedStatus.nextBooking.end,
                    )}
                  </div>
                  {formatBookingType(selectedStatus.nextBooking.type) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Type: {formatBookingType(selectedStatus.nextBooking.type)}
                    </div>
                  )}
                  {getUserName(selectedStatus.nextBooking.userId) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Booked by: {getUserName(selectedStatus.nextBooking.userId)}
                    </div>
                  )}
                </div>
              )}

              {(selected.studioId || selected.pcrRoomId) && (
                <div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                    Next 15 days
                  </div>
                  {selectedUpcoming.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      No bookings in the next 15 days.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
                      {selectedUpcoming.map((b) => {
                        const isNow = isBookingActive(b);
                        return (
                          <li
                            key={b.id}
                            className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300"
                          >
                            <span
                              className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                                isNow ? "bg-red-500" : "bg-gray-300 dark:bg-gray-600"
                              }`}
                            />
                            <span>
                              <span className="text-gray-500 dark:text-gray-400">
                                {new Date(b.start).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "numeric",
                                  day: "numeric",
                                  timeZone: FACILITY_TIMEZONE,
                                })}{" "}
                                {formatTimeRange(b.start, b.end)}
                              </span>{" "}
                              — <span className="font-medium">{b.title}</span>
                              {formatBookingType(b.type) && (
                                <span className="text-gray-400 dark:text-gray-500">
                                  {" "}
                                  ({formatBookingType(b.type)})
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {(selected.studioId || selected.pcrRoomId) && (
                <Button size="sm" className="w-full" onClick={() => openBooking(selected)} data-testid="button-book-room">
                  <CalendarPlus className="h-4 w-4 mr-1.5" /> Book {selected.label}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a room to see its status.
            </p>
          )}
        </div>
      </div>

      {bookingOpen && (
        <BookingModal
          isOpen={bookingOpen}
          onClose={() => setBookingOpen(false)}
          selectedStudio={bookingStudioId}
          selectedPcrRoom={bookingPcrRoomId}
        />
      )}

      {/* Add photo pin: choose the angle photo + optional label for the clicked spot */}
      <Dialog open={!!pendingPin} onOpenChange={(open) => !open && closePinDialog()}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add photo pin — {pendingPin?.studioName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              ref={pinFileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPickPinPhoto}
              data-testid="input-pin-photo"
            />
            {pinPhoto ? (
              <img
                src={pinPhoto}
                alt="Selected angle"
                className="w-full max-h-64 object-contain rounded-md border border-gray-200 dark:border-gray-700"
                data-testid="img-pin-preview"
              />
            ) : (
              <button
                type="button"
                onClick={() => pinFileRef.current?.click()}
                disabled={pinUploading}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 py-10 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400"
                data-testid="button-choose-pin-photo"
              >
                <Camera className="h-6 w-6" />
                {pinUploading ? "Processing…" : "Take or choose a photo"}
              </button>
            )}
            {pinPhoto && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => pinFileRef.current?.click()}
                disabled={pinUploading}
                data-testid="button-replace-pin-photo"
              >
                <Camera className="h-4 w-4 mr-1.5" /> Choose a different photo
              </Button>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Angle label (optional)</Label>
              <Input
                value={pinCaption}
                onChange={(e) => setPinCaption(e.target.value)}
                placeholder="e.g. Front, Stage left, From PCR"
                maxLength={120}
                data-testid="input-pin-caption"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={closePinDialog} data-testid="button-cancel-pin">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={savePin}
                disabled={!pinPhoto || pinUploading}
                data-testid="button-save-pin"
              >
                <Save className="h-4 w-4 mr-1.5" /> {pinUploading ? "Saving…" : "Save pin"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pin viewer: any authenticated user can open a pin to view that angle */}
      {pinViewer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPinViewer(null)}
          data-testid="pin-viewer"
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-white/15 p-2 text-white"
            onClick={() => setPinViewer(null)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <figure className="max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={pinViewer.photoData}
              alt={pinViewer.caption || "Studio angle"}
              className="max-h-[80vh] w-auto rounded-lg"
            />
            <figcaption className="mt-2 flex items-center justify-center gap-3 text-sm text-white/90">
              <span>
                {studios.find((s) => s.id === pinViewer.studioId)?.name || "Studio"}
                {pinViewer.caption ? ` — ${pinViewer.caption}` : ""}
              </span>
              {canManagePhotos && (
                <button
                  type="button"
                  onClick={() => deletePin(pinViewer)}
                  className="inline-flex items-center gap-1 rounded bg-red-600/80 px-2 py-1 text-xs text-white hover:bg-red-600"
                  data-testid="button-delete-pin"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
