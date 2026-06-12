import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StudioPhoto {
  id: number;
  studioId: number;
  photoData: string;
  caption: string | null;
  uploadedBy: number;
  createdAt: string;
}

const MAX_PHOTOS = 12;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1000;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const TARGET = 600_000;
      let quality = 0.75;
      let result = canvas.toDataURL("image/jpeg", quality);
      while (result.length > TARGET && quality > 0.2) {
        quality = Math.round((quality - 0.07) * 100) / 100;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

interface StudioPhotosProps {
  studioId: number;
  studioName: string;
  canManage: boolean;
}

export default function StudioPhotos({ studioId, studioName, canManage }: StudioPhotosProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [viewer, setViewer] = useState<StudioPhoto | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: photos = [], isLoading } = useQuery<StudioPhoto[]>({
    queryKey: ["/api/studios", studioId, "photos"],
    queryFn: () =>
      fetch(`/api/studios/${studioId}/photos`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load photos");
        return r.json();
      }),
  });

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "photos"] });

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (photos.length >= MAX_PHOTOS) {
      toast({ title: `Maximum ${MAX_PHOTOS} photos per studio`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const photoData = await compressImage(file);
      await apiRequest("POST", `/api/studios/${studioId}/photos`, {
        photoData,
        caption: caption.trim() || undefined,
      });
      setCaption("");
      await refetch();
      toast({ title: "Photo added", description: `Added to ${studioName}.` });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message || "Could not add photo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (photo: StudioPhoto) => {
    if (!window.confirm("Delete this photo?")) return;
    setDeletingId(photo.id);
    try {
      await apiRequest("DELETE", `/api/studios/${studioId}/photos/${photo.id}`);
      await refetch();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message || "Could not delete photo.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div data-testid="studio-photos">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Studio photos{photos.length ? ` (${photos.length})` : ""}
        </div>
        {canManage && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPick}
              data-testid="input-studio-photo"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={uploading || photos.length >= MAX_PHOTOS}
              onClick={() => fileRef.current?.click()}
              data-testid="button-add-studio-photo"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5 mr-1" />
              )}
              {uploading ? "Adding…" : "Add"}
            </Button>
          </>
        )}
      </div>

      {canManage && (
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Optional angle label (e.g. Front, Stage left)"
          className="h-7 text-xs mb-2"
          maxLength={120}
          data-testid="input-studio-photo-caption"
        />
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No photos yet{canManage ? " — add angle shots above." : "."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <div key={p.id} className="relative group">
              <button
                type="button"
                onClick={() => setViewer(p)}
                className="block w-full aspect-square overflow-hidden rounded-md border border-gray-200 dark:border-gray-700"
                data-testid={`thumb-studio-photo-${p.id}`}
              >
                <img
                  src={p.photoData}
                  alt={p.caption || studioName}
                  className="w-full h-full object-cover"
                />
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  disabled={deletingId === p.id}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`button-delete-studio-photo-${p.id}`}
                  aria-label="Delete photo"
                >
                  {deletingId === p.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              )}
              {p.caption && (
                <div className="absolute bottom-0 inset-x-0 truncate rounded-b-md bg-black/55 px-1 py-0.5 text-[10px] text-white">
                  {p.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {viewer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewer(null)}
          data-testid="studio-photo-viewer"
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-white/15 p-2 text-white"
            onClick={() => setViewer(null)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <figure className="max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewer.photoData}
              alt={viewer.caption || studioName}
              className="max-h-[80vh] w-auto rounded-lg"
            />
            {viewer.caption && (
              <figcaption className="mt-2 text-center text-sm text-white/90">
                {viewer.caption}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </div>
  );
}
