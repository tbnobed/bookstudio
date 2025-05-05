import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db';
import { fileAttachments, type InsertFileAttachment } from '../../shared/schema';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import multer from 'multer';

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(path.join(__dirname, '..', '..', 'uploads'));

// Make sure the uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper function to get a unique filename
function getUniqueFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  const safeName = basename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = Date.now();
  const uniqueId = createId();
  return `${safeName}_${timestamp}_${uniqueId}${ext}`;
}

/**
 * Save an uploaded file to the filesystem and database
 */
export async function saveFile(
  file: MulterFile,
  bookingId: number,
  userId: number,
  description?: string
) {
  // Generate a unique filename
  const uniqueFilename = getUniqueFilename(file.originalname);
  const filePath = path.join(UPLOADS_DIR, uniqueFilename);
  
  // Save the file to the filesystem
  if (file.buffer) {
    await fs.promises.writeFile(filePath, file.buffer);
  } else if (file.path) {
    // If the file was already saved by multer, just copy it to our destination
    const tempPath = file.path;
    await fs.promises.copyFile(tempPath, filePath);
    // Remove the temporary file
    await fs.promises.unlink(tempPath);
  } else {
    throw new Error('No file data available');
  }
  
  // Insert file record into database
  const fileData: InsertFileAttachment = {
    bookingId,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
    path: uniqueFilename, // Store just the filename, not the full path
    uploadedBy: userId,
    description
  };
  
  const [savedFile] = await db.insert(fileAttachments).values(fileData).returning();
  return savedFile;
}

/**
 * Retrieve a file by its ID
 */
export async function getFileById(fileId: number) {
  const [file] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, fileId));
  if (!file) {
    return null;
  }
  return file;
}

/**
 * Get the physical path to a file
 */
export function getFilePath(filename: string) {
  return path.join(UPLOADS_DIR, filename);
}

/**
 * Get all attachments for a booking
 */
export async function getAttachmentsByBookingId(bookingId: number) {
  return await db
    .select()
    .from(fileAttachments)
    .where(eq(fileAttachments.bookingId, bookingId))
    .orderBy(fileAttachments.uploadedAt);
}

/**
 * Delete a file by its ID
 */
export async function deleteFile(fileId: number) {
  // Get file details first
  const [file] = await db
    .select()
    .from(fileAttachments)
    .where(eq(fileAttachments.id, fileId));
  
  if (!file) {
    throw new Error('File not found');
  }
  
  // Delete from filesystem
  const filePath = getFilePath(file.path);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
  
  // Delete from database
  await db
    .delete(fileAttachments)
    .where(eq(fileAttachments.id, fileId));
    
  return true;
}