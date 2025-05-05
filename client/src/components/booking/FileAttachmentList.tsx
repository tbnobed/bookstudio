import { useState } from "react";
import { useFileAttachments } from "@/hooks/use-file-attachments";
import { Button } from "@/components/ui/button";
import { 
  FileText, Download, Trash2, AlertCircle, 
  Loader2, Plus, FilePlus, FileIcon
} from "lucide-react";
import { FileAttachment } from "@shared/schema";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { FileUploadForm } from "./FileUploadForm";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileAttachmentListProps {
  bookingId: number;
  readOnly?: boolean;
}

export function FileAttachmentList({ bookingId, readOnly = false }: FileAttachmentListProps) {
  const { 
    attachments, 
    isLoading, 
    downloadFile, 
    deleteFile 
  } = useFileAttachments(bookingId);
  
  const [fileToDelete, setFileToDelete] = useState<FileAttachment | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle file deletion
  const handleDeleteFile = async (file: FileAttachment) => {
    deleteFile(file.id);
    setFileToDelete(null);
  };

  // Get icon for file type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <FileIcon className="h-5 w-5 text-blue-500" />;
    } else if (mimeType.startsWith("application/pdf")) {
      return <FileText className="h-5 w-5 text-red-500" />;
    } else if (mimeType.startsWith("video/")) {
      return <FileIcon className="h-5 w-5 text-purple-500" />;
    } else if (mimeType.startsWith("audio/")) {
      return <FileIcon className="h-5 w-5 text-green-500" />;
    } else {
      return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </h3>
        
        {!readOnly && (
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-4 w-4" />
                Add File
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload File Attachment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <FileUploadForm 
                  bookingId={bookingId} 
                  onUploadComplete={() => setUploadDialogOpen(false)}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500 border rounded-lg border-dashed">
          <FilePlus className="h-12 w-12 mb-2 text-gray-400" />
          <h3 className="text-sm font-medium">No attachments yet</h3>
          <p className="text-xs mt-1 max-w-xs">
            {readOnly 
              ? "There are no files attached to this booking."
              : "Upload files to share important documents related to this booking."
            }
          </p>
          {!readOnly && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add File
            </Button>
          )}
        </div>
      ) : (
        <ScrollArea className="h-[300px] rounded-md border p-2">
          <div className="space-y-2">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded-md border hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    {getFileIcon(file.mimeType)}
                  </div>
                  <div className="space-y-1 max-w-[200px] sm:max-w-[300px]">
                    <p className="font-medium text-sm truncate" title={file.fileName}>
                      {file.fileName}
                    </p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
                      <span title={formatFileSize(file.fileSize)}>{formatFileSize(file.fileSize)}</span>
                      <span title={format(new Date(file.uploadedAt), "PPP")}>
                        {format(new Date(file.uploadedAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    {file.description && (
                      <p className="text-xs text-gray-500 truncate" title={file.description}>
                        {file.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => downloadFile(file.id, file.fileName)}
                    title="Download file"
                  >
                    <Download className="h-4 w-4" />
                    <span className="sr-only">Download</span>
                  </Button>
                  
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setFileToDelete(file)}
                      title="Delete file"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file "{fileToDelete?.fileName}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => fileToDelete && handleDeleteFile(fileToDelete)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}