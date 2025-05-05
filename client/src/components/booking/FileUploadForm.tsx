import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUp, Loader2, X } from "lucide-react";
import { useFileAttachments } from "@/hooks/use-file-attachments";
import { useToast } from "@/hooks/use-toast";

interface FileUploadFormProps {
  bookingId: number;
  onUploadComplete?: () => void;
}

export function FileUploadForm({ bookingId, onUploadComplete }: FileUploadFormProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadFile, isUploading } = useFileAttachments(bookingId);
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };
  
  // Validate file size and type
  const validateAndSetFile = (selectedFile: File) => {
    // 100MB limit
    const maxSize = 100 * 1024 * 1024;
    
    if (selectedFile.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 100MB",
        variant: "destructive"
      });
      return;
    }
    
    setFile(selectedFile);
  };
  
  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await uploadFile({ 
        bookingId,
        file,
        description: description.trim() || undefined
      });
      
      toast({
        title: "Success",
        description: "File uploaded successfully",
        variant: "default"
      });
      
      // Reset form
      setFile(null);
      setDescription('');
      
      // Call callback if provided
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const clearFileSelection = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${
            isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          
          {file ? (
            <div className="flex items-center justify-between">
              <div className="truncate">
                <p className="font-medium text-sm truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFileSelection();
                }}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove file</span>
              </Button>
            </div>
          ) : (
            <>
              <FileUp className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm font-medium">
                Drag and drop a file here, or click to browse
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Maximum file size: 100MB
              </p>
            </>
          )}
        </div>
        
        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Add a description for this file"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none"
            rows={3}
          />
        </div>
        
        <div className="flex justify-end">
          <Button type="submit" disabled={!file || isUploading}>
            {isUploading ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </span>
            ) : (
              'Upload File'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}