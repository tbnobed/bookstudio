import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import { createId } from '@paralleldrive/cuid2';
import { fileAttachments, insertFileAttachmentSchema, bookings } from '@shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate a unique filename using cuid2 and keep the original extension
    const uniqueId = createId();
    const extension = path.extname(file.originalname);
    const filename = `${uniqueId}${extension}`;
    cb(null, filename);
  }
});

// Set file size limit to 100MB (100 * 1024 * 1024 bytes)
export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

// Service for file operations
export const fileService = {
  // Save file metadata to database
  async saveFileMetadata(file: Express.Multer.File, bookingId: number, userId: number, description?: string) {
    try {
      const fileData = {
        bookingId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        path: file.path,
        uploadedBy: userId,
        description,
      };
      
      // Validate file data
      const validatedData = insertFileAttachmentSchema.parse(fileData);
      
      // Insert into database
      const [savedFile] = await db
        .insert(fileAttachments)
        .values(validatedData)
        .returning();
      
      return savedFile;
    } catch (error) {
      console.error('Error saving file metadata:', error);
      throw error;
    }
  },
  
  // Get file attachments for a booking
  async getFileAttachments(bookingId: number) {
    try {
      const files = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.bookingId, bookingId));
      
      return files;
    } catch (error) {
      console.error('Error getting file attachments:', error);
      throw error;
    }
  },
  
  // Get a single file by ID
  async getFileById(fileId: number) {
    try {
      const [file] = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, fileId));
      
      return file;
    } catch (error) {
      console.error('Error getting file by ID:', error);
      throw error;
    }
  },
  
  // Delete a file
  async deleteFile(fileId: number) {
    try {
      // Get the file to delete
      const [file] = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, fileId));
      
      if (!file) {
        throw new Error('File not found');
      }
      
      // Delete the physical file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      // Delete from database
      await db
        .delete(fileAttachments)
        .where(eq(fileAttachments.id, fileId));
      
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },
  
  // Check if user has permission to access a file
  async userHasPermission(fileId: number, userId: number, isAdmin: boolean = false) {
    try {
      // Admin users can access any file
      if (isAdmin) {
        return true;
      }
      
      // Get the file
      const [file] = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, fileId));
      
      if (!file) {
        return false;
      }
      
      // File uploader can access their own files
      if (file.uploadedBy === userId) {
        return true;
      }
      
      // Import the bookings table from schema to avoid naming conflicts
      const bookingsTable = bookings;
      
      // Get the booking to check ownership
      const bookingResults = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, file.bookingId));
      
      const booking = bookingResults[0];
      
      if (!booking) {
        return false;
      }
      
      // Booking owner can access attached files
      return booking.userId === userId;
    } catch (error) {
      console.error('Error checking file permission:', error);
      return false;
    }
  }
};