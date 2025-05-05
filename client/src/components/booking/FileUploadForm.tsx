import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, FileUp } from "lucide-react";
import { useFileAttachments } from "@/hooks/use-file-attachments";
import { cn } from "@/lib/utils";

interface FileUploadFormProps {
  bookingId: number;
  onUploadComplete?: () => void;
}

export function FileUploadForm({ bookingId, onUploadComplete }: FileUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useFileAttachments(bookingId);

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!file) return;

    uploadFile(
      { bookingId, file, description },
      {
        onSuccess: () => {
          // Reset form
          setFile(null);
          setDescription("");
          if (onUploadComplete) {
            onUploadComplete();
          }
        },
      }
    );
  };

  // Clear selected file
  const clearFile = () => {
    setFile(null);
    if (inputFileRef.current) {
      inputFileRef.current.value = "";
    }
  };

  // Handle drag events
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-primary/50",
          file ? "bg-green-50 border-green-200" : ""
        )}
        onClick={() => inputFileRef.current?.click()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={inputFileRef}
          onChange={handleFileChange}
          className="hidden"
          accept="*/*" // Accept all file types
        />

        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <FileUp className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove file</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Drag and drop a file or click to browse</p>
              <p className="text-xs text-gray-500">
                Maximum file size: 100MB
              </p>
            </div>
          </div>
        )}
      </div>

      {file && (
        <>
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description (optional)
            </label>
            <Textarea
              id="description"
              placeholder="Add a description for this file..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>

          <Button 
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? "Uploading..." : "Upload File"}
          </Button>
        </>
      )}
    </div>
  );
}