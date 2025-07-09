import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import * as fs from 'fs';
import * as path from 'path';
import { storage } from "./storage";
import { fileService, upload } from "./services/fileService";
import { 
  insertUserSchema, 
  insertStudioSchema, 
  insertPcrRoomSchema,
  insertTemplateSchema, 
  insertBookingSchema, 
  insertAlertSchema,
  insertNotificationSchema,
  insertNotificationGroupSchema,
  insertBookingTypeSchema
} from "@shared/schema";
import { z } from "zod";
import { ValidationError } from "zod-validation-error";
import { ZodError } from "zod";
import { setupAuth, hashPassword } from "./auth";
import { backupManager } from "./backup-simple";
import { 
  sendBookingConfirmation, 
  sendBookingUpdate, 
  sendBookingCancellation, 
  sendMaintenanceAlert,
  sendSiteManagerNotification
} from "./services/emailService";

import {
  sendBookingNotificationToGroups,
  sendMaintenanceAlertToGroups,
  sendFacilityAlertToGroups,
  sendCustomNotificationToGroups,

  sendFileAttachmentNotificationToGroups
} from "./services/notificationGroupService";
import { 
  generatePasswordResetToken, 
  verifyPasswordResetToken, 
  invalidatePasswordResetToken, 
  sendPasswordResetEmail,
  generateInviteToken,
  sendInviteEmail,
  verifyInviteToken,
  invalidateInviteToken
} from "./email";
import { migrateTemplatesApi } from "./migrate-templates-api";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Setup authentication with passport
  setupAuth(app);

  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Middleware to check user role
  const hasRole = (roles: string[]) => {
    return (req: Request, res: Response, next: Function) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = req.user as any;
      if (!roles.includes(user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      next();
    };
  };

  // User routes
  app.get("/api/users", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
      
  // Route for site managers to get only producers
  app.get("/api/users/producers", isAuthenticated, hasRole(["site_manager"]), async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const producers = allUsers.filter(user => user.role === "producer");
      res.json(producers);
    } catch (error) {
      console.error("Error fetching producers:", error);
      res.status(500).json({ message: "Error fetching producers" });
    }
  });
  
  // Validate invite token
  app.get("/api/invite/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Verify the invite token
      const inviteInfo = await verifyInviteToken(token);
      
      if (!inviteInfo) {
        return res.status(400).json({ 
          valid: false,
          message: "Invalid or expired invitation link"
        });
      }
      
      // Return the invite info (excluding sensitive data)
      res.json({
        valid: true,
        email: inviteInfo.email,
        role: inviteInfo.role
      });
    } catch (error) {
      console.error("Error validating invite token:", error);
      res.status(500).json({ 
        valid: false,
        message: "Error validating invitation"
      });
    }
  });

  // Endpoint for admins and site managers to generate invite links
  app.post("/api/invite", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const user = req.user as Express.User;
      let parsedData;
      
      // Site managers can only invite producers
      if (user.role === "site_manager") {
        parsedData = z.object({
          email: z.string().email(),
          role: z.literal("producer")
        }).parse(req.body);
      } else {
        // Admins can invite any role
        parsedData = z.object({
          email: z.string().email(),
          role: z.enum(["admin", "producer", "engineer", "it", "site_manager", "viewer"])
        }).parse(req.body);
      }
      
      const { email, role } = parsedData;
      
      const admin = req.user as Express.User;
      
      // Generate invite token
      const token = await generateInviteToken(role, email, admin.id);
      
      // Generate invite path
      const invitePath = `/invite/${token}`;
      
      // Send invite email
      const origin = req.body.origin || null;
      const emailSent = await sendInviteEmail(email, role, invitePath, admin.name, origin);
      
      if (!emailSent) {
        return res.status(500).json({
          success: false,
          message: "Failed to send invitation email. Please try again later."
        });
      }
      
      res.json({ 
        success: true,
        message: `Invitation sent to ${email} with role: ${role}`,
        inviteLink: invitePath
      });
    } catch (error) {
      console.error("Failed to create invitation:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid data. Email and role are required.",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Failed to create invitation."
      });
    }
  });

  app.post("/api/users", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userData = insertUserSchema.parse(req.body);
      
      // Site managers cannot create admin users
      if (currentUser.role === "site_manager" && userData.role === "admin") {
        return res.status(403).json({ message: "Forbidden: Site managers cannot create administrator accounts" });
      }
      
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  app.patch("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      
      // Check if the user is updating their own profile or has admin/site_manager rights
      if (currentUser.id !== id && currentUser.role !== "admin" && currentUser.role !== "site_manager") {
        return res.status(403).json({ message: "Forbidden: You can only update your own profile unless you have management rights" });
      }
      
      // If user is updating password, include it in the update
      let dataToUpdate = {...req.body};
      
      // Admin and site_manager can update any field, but regular users can only update certain fields
      if (currentUser.role !== "admin" && currentUser.role !== "site_manager" && currentUser.id === id) {
        // Regular users can only update their own name, email and password
        const { name, email, password } = req.body;
        dataToUpdate = { name, email };
        
        // Only include password if it's being changed
        if (password) {
          dataToUpdate.password = password;
        }
      }
      
      // Site managers cannot change someone's role to admin
      if (currentUser.role === "site_manager" && dataToUpdate.role === "admin") {
        return res.status(403).json({ message: "Forbidden: Site managers cannot assign admin role" });
      }
      
      // Hash the password if it's being updated
      if (dataToUpdate.password) {
        // Use the imported hashPassword function
        dataToUpdate.password = await hashPassword(dataToUpdate.password);
      }
      
      const updatedUser = await storage.updateUser(id, dataToUpdate);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  app.delete("/api/users/:id", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      const force = req.query.force === 'true'; // Allow force deletion via query parameter
      
      // Prevent self-deletion
      if (req.user && req.user.id === id) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }
      
      // Get the user to be deleted to check their role
      const userToDelete = await storage.getUser(id);
      
      if (!userToDelete) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Site managers cannot delete admin users
      if (currentUser.role === "site_manager" && userToDelete.role === "admin") {
        return res.status(403).json({ message: "Forbidden: Site managers cannot delete administrator accounts" });
      }
      
      const deleted = await storage.deleteUser(id, force);
      
      if (!deleted) {
        return res.status(404).json({ message: "User not found or could not be deleted" });
      }
      
      const message = force 
        ? "User deleted successfully (associated bookings and templates reassigned to admin)"
        : "User deleted successfully";
      
      res.status(200).json({ message });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      
      // Handle dependency-related errors that can be resolved with force delete
      const errorMessage = error.message || "";
      const isConstraintError = error.code === '23503' || errorMessage.includes("foreign key constraint");
      const isDependencyError = errorMessage.includes("associated bookings") || 
                               errorMessage.includes("associated templates") || 
                               errorMessage.includes("notifications_user_id_fkey") ||
                               errorMessage.includes("file_attachments_uploaded_by_fkey");
      
      if (isDependencyError || isConstraintError) {
        return res.status(400).json({ 
          message: errorMessage.includes("associated") ? errorMessage : "Cannot delete user: User has associated data that must be reassigned first.",
          canForceDelete: true,
          forceDeleteHint: "Add ?force=true to reassign associated data and force delete"
        });
      }
      
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Password reset routes
  app.post("/api/forgot-password", async (req, res) => {
    try {
      // Validate request body
      const { email, origin } = z.object({ 
        email: z.string().email(),
        origin: z.string().optional()
      }).parse(req.body);
      
      console.log("Received origin from client:", origin);
      
      // Find user by email
      const users = await storage.getAllUsers();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      // If no user is found, we still return success (for security reasons)
      if (!user) {
        return res.json({ success: true });
      }
      
      // Generate password reset token
      const token = await generatePasswordResetToken(user.id);
      
      // Generate reset link path
      const resetPath = `/reset-password/${token}`;
      
      // Send password reset email
      const emailSent = await sendPasswordResetEmail(user.email, resetPath, origin);
      
      if (!emailSent) {
        console.error(`Failed to send password reset email to ${user.email}`);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to send password reset email. Please try again later." 
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Forgot password error:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid email address" 
        });
      }
      res.status(500).json({ 
        success: false, 
        message: "An error occurred. Please try again later." 
      });
    }
  });
  
  app.get("/api/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Verify token
      const userId = await verifyPasswordResetToken(token);
      
      if (!userId) {
        return res.json({ valid: false });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.json({ valid: false });
      }
      
      res.json({ valid: true });
    } catch (error) {
      console.error("Reset password token validation error:", error);
      res.status(500).json({ 
        valid: false, 
        message: "An error occurred while validating the token." 
      });
    }
  });
  
  app.post("/api/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = z.object({ password: z.string().min(6) }).parse(req.body);
      
      // Verify token
      const userId = await verifyPasswordResetToken(token);
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid or expired token. Please request a new password reset link." 
        });
      }
      
      // Get user
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }
      
      // Hash the new password using imported function
      const hashedPassword = await hashPassword(password);
      
      // Update user's password
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
      
      if (!updatedUser) {
        return res.status(500).json({ 
          success: false, 
          message: "Failed to update password" 
        });
      }
      
      // Invalidate token
      await invalidatePasswordResetToken(token);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Reset password error:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Password must be at least 6 characters long" 
        });
      }
      res.status(500).json({ 
        success: false, 
        message: "An error occurred while resetting your password. Please try again." 
      });
    }
  });

  // Studio routes
  app.get("/api/studios", async (req, res) => {
    try {
      const studios = await storage.getAllStudios();
      res.json(studios);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch studios" });
    }
  });

  app.post("/api/studios", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const studioData = insertStudioSchema.parse(req.body);
      const studio = await storage.createStudio(studioData);
      res.status(201).json(studio);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid studio data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create studio" });
    }
  });

  app.patch("/api/studios/:id/status", isAuthenticated, hasRole(["admin", "engineer", "it", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = z.object({ status: z.string() }).parse(req.body);
      
      const updatedStudio = await storage.updateStudioStatus(id, status);
      if (!updatedStudio) {
        return res.status(404).json({ message: "Studio not found" });
      }
      
      res.json(updatedStudio);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid status data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update studio status" });
    }
  });
  
  app.patch("/api/studios/:id", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Allow updating name, description and status
      const updateSchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        status: z.string().optional()
      });
      
      const updateData = updateSchema.parse(req.body);
      
      const updatedStudio = await storage.updateStudio(id, updateData);
      if (!updatedStudio) {
        return res.status(404).json({ message: "Studio not found" });
      }
      
      res.json(updatedStudio);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid studio data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update studio" });
    }
  });
  
  app.delete("/api/studios/:id", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check for active bookings on this studio
      const studioBookings = await storage.getBookingsByStudio(id);
      if (studioBookings.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete studio with active bookings. Please remove all bookings first."
        });
      }
      
      const deleted = await storage.deleteStudio(id);
      if (!deleted) {
        return res.status(404).json({ message: "Studio not found or could not be deleted" });
      }
      
      res.status(200).json({ message: "Studio deleted successfully" });
    } catch (error) {
      console.error(`Error deleting studio:`, error);
      res.status(500).json({ message: "Failed to delete studio" });
    }
  });

  // PCR Room routes
  app.get("/api/pcr-rooms", async (req, res) => {
    try {
      const pcrRooms = await storage.getAllPcrRooms();
      res.json(pcrRooms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch PCR rooms" });
    }
  });

  app.post("/api/pcr-rooms", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const pcrRoomData = insertPcrRoomSchema.parse(req.body);
      const pcrRoom = await storage.createPcrRoom(pcrRoomData);
      res.status(201).json(pcrRoom);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid PCR room data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create PCR room" });
    }
  });

  app.patch("/api/pcr-rooms/:id/status", isAuthenticated, hasRole(["admin", "engineer", "it", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = z.object({ status: z.string() }).parse(req.body);
      
      const updatedPcrRoom = await storage.updatePcrRoomStatus(id, status);
      if (!updatedPcrRoom) {
        return res.status(404).json({ message: "PCR room not found" });
      }
      
      res.json(updatedPcrRoom);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid status data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update PCR room status" });
    }
  });
  
  app.patch("/api/pcr-rooms/:id", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Allow updating name, description and status
      const updateSchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        status: z.string().optional()
      });
      
      const updateData = updateSchema.parse(req.body);
      
      const updatedPcrRoom = await storage.updatePcrRoom(id, updateData);
      if (!updatedPcrRoom) {
        return res.status(404).json({ message: "PCR room not found" });
      }
      
      res.json(updatedPcrRoom);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid PCR room data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update PCR room" });
    }
  });
  
  app.delete("/api/pcr-rooms/:id", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // The deletePcrRoom method already checks for active bookings
      const success = await storage.deletePcrRoom(id);
      
      if (success) {
        return res.json({ message: "PCR room deleted successfully" });
      } else {
        return res.status(400).json({ 
          message: "Cannot delete PCR room. It may have active bookings or might not exist."
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete PCR room" });
    }
  });

  // Template routes
  app.get("/api/templates", isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getAllTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/user", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const templates = await storage.getTemplatesByUser(user.id);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user templates" });
    }
  });

  app.post("/api/templates", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const templateData = insertTemplateSchema.parse({
        ...req.body,
        createdBy: user.id
      });
      
      const template = await storage.createTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.patch("/api/templates/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      const user = req.user as any;
      // Only the creator or admin can update a template
      if (template.createdBy !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Validate the update data
      const updateData = insertTemplateSchema.partial().parse(req.body);
      const updatedTemplate = await storage.updateTemplate(id, updateData);
      
      if (updatedTemplate) {
        res.json(updatedTemplate);
      } else {
        res.status(500).json({ message: "Failed to update template" });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const force = req.query.force === 'true'; // Allow force deletion via query parameter
      const template = await storage.getTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      const user = req.user as any;
      // Only the creator or admin can delete a template
      if (template.createdBy !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const success = await storage.deleteTemplate(id, force);
      if (success) {
        const message = force 
          ? "Template deleted successfully (removed from associated bookings)"
          : "Template deleted successfully";
        return res.json({ message });
      } else {
        return res.status(500).json({ message: "Failed to delete template" });
      }
    } catch (error: any) {
      console.error("Error deleting template:", error);
      if (error.message && error.message.includes("associated bookings")) {
        return res.status(400).json({ 
          message: error.message,
          canForceDelete: true,
          forceDeleteHint: "Add ?force=true to remove template from bookings and force delete"
        });
      }
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Booking routes
  app.get("/api/bookings", isAuthenticated, async (req, res) => {
    try {
      let bookings;
      
      // Filter by date range if provided
      if (req.query.start && req.query.end) {
        const start = new Date(req.query.start as string);
        const end = new Date(req.query.end as string);
        bookings = await storage.getBookingsByDateRange(start, end);
      } else {
        bookings = await storage.getAllBookings();
      }
      
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });
  
  // Public API for calendar view - no authentication required
  app.get("/api/public/bookings", async (req, res) => {
    try {
      let bookings;
      
      console.log("[Public Bookings] Request query params:", req.query);
      
      // Filter by date range if provided
      if (req.query.start && req.query.end) {
        const start = new Date(req.query.start as string);
        const end = new Date(req.query.end as string);
        console.log(`[Public Bookings] Date range: ${start.toISOString()} - ${end.toISOString()}`);
        
        bookings = await storage.getBookingsByDateRange(start, end);
        console.log(`[Public Bookings] Found ${bookings.length} bookings in date range`);
      } else {
        console.log("[Public Bookings] No date range provided, fetching all bookings");
        bookings = await storage.getAllBookings();
        console.log(`[Public Bookings] Found ${bookings.length} bookings total`);
      }
      
      // Remove any sensitive information for the public view
      const sanitizedBookings = bookings.map(booking => ({
        id: booking.id,
        title: booking.title,
        description: booking.description,
        start: booking.start,
        end: booking.end,
        studioId: booking.studioId,
        type: booking.type,
        severity: booking.severity,
        pcrRoomId: booking.pcrRoomId, // Include PCR room ID so it appears in the public view
        color: booking.color, // Include color for consistent display in calendar
        status: booking.status, // Include status for tentative bookings
        // Exclude userId, templateId, notifyList, and other private data
      }));
      
      console.log(`[Public Bookings] Returning ${sanitizedBookings.length} bookings`);
      if (sanitizedBookings.length > 0) {
        console.log(`[Public Bookings] First booking:`, JSON.stringify(sanitizedBookings[0]));
      }
      
      res.json(sanitizedBookings);
    } catch (error) {
      console.error("[Public Bookings] Error:", error);
      res.status(500).json({ message: "Failed to fetch public bookings" });
    }
  });

  app.get("/api/bookings/user", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const bookings = await storage.getBookingsByUser(user.id);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user bookings" });
    }
  });

  app.get("/api/bookings/studio/:id", async (req, res) => {
    try {
      const studioId = parseInt(req.params.id);
      const bookings = await storage.getBookingsByStudio(studioId);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch studio bookings" });
    }
  });
  
  // Get booking-studio links for a booking or all links
  app.get("/api/booking-studios", isAuthenticated, async (req, res) => {
    try {
      const bookingId = req.query.bookingId ? parseInt(req.query.bookingId as string) : null;
      
      if (bookingId) {
        // Get links for a specific booking
        const links = await storage.getBookingStudioLinks(bookingId);
        return res.json(links);
      } else {
        // Get all booking-studio links for the calendar view
        const links = await storage.getAllBookingStudioLinks();
        return res.json(links);
      }
    } catch (error) {
      console.error("Error getting booking-studio links:", error);
      return res.status(500).json({ message: "Failed to fetch booking-studio links" });
    }
  });
  
  // Public endpoint for booking-studio links - no authentication required
  app.get("/api/public/booking-studios", async (req, res) => {
    try {
      const bookingId = req.query.bookingId ? parseInt(req.query.bookingId as string) : null;
      
      if (bookingId) {
        // Get links for a specific booking
        const links = await storage.getBookingStudioLinks(bookingId);
        return res.json(links);
      } else {
        // Get all booking-studio links for the calendar view
        const links = await storage.getAllBookingStudioLinks();
        console.log(`[Public API] Returning ${links.length} booking-studio links`);
        return res.json(links);
      }
    } catch (error) {
      console.error("Error getting public booking-studio links:", error);
      return res.status(500).json({ message: "Failed to fetch booking-studio links" });
    }
  });
  
  // Get all studios for a booking
  app.get("/api/bookings/:id/studios", isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const studios = await storage.getStudiosForBooking(bookingId);
      return res.json(studios);
    } catch (error) {
      console.error("Error getting studios for booking:", error);
      return res.status(500).json({ message: "Failed to fetch studios for booking" });
    }
  });

  app.post("/api/bookings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Check role permissions based on booking types
      if (req.body.type === "maintenance" || req.body.type === "all-day:maintenance") {
        // Only admin, engineers, IT staff, and site managers can create maintenance bookings
        if (!["admin", "engineer", "it", "site_manager"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin, engineers, IT staff, and site managers can create maintenance bookings" });
        }
      } else if (req.body.type === "it_support") {
        // Only admin, IT staff, and site managers can create IT support bookings
        if (!["admin", "it", "site_manager"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin, IT staff, and site managers can create IT support bookings" });
        }
      } else {
        // For regular production bookings, ensure producers and site managers have access
        if (user.role !== "admin" && user.role !== "producer" && user.role !== "site_manager") {
          return res.status(403).json({ message: "Only admin, producers, and site managers can create regular bookings" });
        }
      }
      
      console.log("=== BOOKING CREATION DEBUG START ===");
      console.log("Booking request data:", JSON.stringify(req.body));
      console.log("User creating booking:", user.username, "ID:", user.id);
      console.log("CRITICAL: About to process booking creation - notification debugging enabled");
      
      // Extract studio IDs for conflict checking and junction table
      const studioIds = req.body.studioIds || [];
      const mainStudioId = typeof req.body.studioId === 'string' ? parseInt(req.body.studioId) : req.body.studioId;
      
      // Enhanced multi-studio debugging with body inspection
      const bodyKeys = Object.keys(req.body || {});
      console.log("[MULTI-STUDIO DEBUG] Request body keys:", bodyKeys);
      console.log(`[MULTI-STUDIO DEBUG] Raw request data:`, {
        studioIds: req.body.studioIds,
        studioId: req.body.studioId,
        extractedStudioIds: studioIds,
        extractedMainStudioId: mainStudioId,
        studioIdsType: typeof req.body.studioIds,
        studioIdsLength: studioIds?.length,
        hasStudioIdsProperty: 'studioIds' in req.body,
        bodyString: JSON.stringify(req.body)
      });
      
      // Ensure studioId is a number and proper date formats
      const requestData = {
        ...req.body,
        userId: user.id,
        studioId: mainStudioId
      };
      
      console.log("Modified request data:", JSON.stringify(requestData));
      console.log("Extracted notifyList from request:", req.body.notifyList);
      
      // Fix foreign key constraints - set to null if 0 or undefined
      const cleanedData = {
        ...requestData,
        studioId: requestData.studioId === 0 || requestData.studioId === undefined ? null : requestData.studioId,
        templateId: requestData.templateId === 0 || requestData.templateId === undefined ? null : requestData.templateId,
        pcrRoomId: requestData.pcrRoomId === 0 || requestData.pcrRoomId === undefined ? null : requestData.pcrRoomId
      };
      
      // Validate studio selection for regular bookings (not maintenance alerts)
      if (cleanedData.type !== "maintenance" && cleanedData.type !== "all-day:maintenance" && 
          (!cleanedData.studioId && (!studioIds || studioIds.length === 0))) {
        return res.status(400).json({ 
          message: "Studio selection is required for regular bookings" 
        });
      }
      
      const bookingData = insertBookingSchema.parse(cleanedData);
      
      // Check for booking conflicts for all studios in the request
      let conflict = false;
      let conflictingStudio = null;
      
      // Only check for conflicts if we have studio selections
      if (studioIds && studioIds.length > 0) {
        const start = new Date(bookingData.start);
        const end = new Date(bookingData.end);
        
        // Check each studio for conflicts
        for (const studioIdStr of studioIds) {
          const studioId = parseInt(studioIdStr);
          const existingBookings = await storage.getBookingsByStudio(studioId);
          
          const hasConflict = existingBookings.some(booking => {
            // Skip cancelled bookings - they don't create conflicts
            if (booking.status === 'cancelled') {
              return false;
            }
            
            const bookingStart = new Date(booking.start);
            const bookingEnd = new Date(booking.end);
            
            return (
              (start >= bookingStart && start < bookingEnd) ||
              (end > bookingStart && end <= bookingEnd) ||
              (start <= bookingStart && end >= bookingEnd)
            );
          });
          
          if (hasConflict) {
            conflict = true;
            conflictingStudio = studioId;
            break;
          }
        }
      }
      
      if (conflict) {
        // Get the studio name for better error message
        const studio = await storage.getStudio(conflictingStudio);
        return res.status(409).json({ 
          message: `There is a booking conflict for ${studio ? studio.name : `studio ID ${conflictingStudio}`} during this time slot`
        });
      }
      
      // Check for PCR room conflicts if a PCR room is assigned
      if (bookingData.pcrRoomId) {
        const start = new Date(bookingData.start);
        const end = new Date(bookingData.end);
        
        console.log(`Checking PCR room conflicts for room ${bookingData.pcrRoomId} from ${start.toISOString()} to ${end.toISOString()}`);
        
        const pcrConflicts = await storage.checkPcrRoomConflicts(bookingData.pcrRoomId, start, end, null);
        
        console.log(`Found ${pcrConflicts.length} PCR room conflicts:`, pcrConflicts.map(b => ({ id: b.id, title: b.title, start: b.start, end: b.end })));
        
        if (pcrConflicts.length > 0) {
          // Get the PCR room name for better error message
          const pcrRoom = await storage.getPcrRoom(bookingData.pcrRoomId);
          return res.status(409).json({ 
            message: `There is a PCR room conflict for ${pcrRoom ? pcrRoom.name : `PCR room ID ${bookingData.pcrRoomId}`} during this time slot`
          });
        }
      }
      
      const booking = await storage.createBooking(bookingData);
      console.log("=== BOOKING CREATED ===");
      console.log("Created booking:", JSON.stringify(booking));
      console.log("Booking notifyList after creation:", booking.notifyList);
      console.log("[EMAIL DEBUG] About to check if email notifications should be sent...");
      
      // Create entries in the junction table for each selected studio
      if (studioIds && studioIds.length > 0) {
        try {
          const parsedStudioIds = studioIds.map(id => typeof id === 'string' ? parseInt(id) : id);
          console.log(`[MULTI-STUDIO DEBUG] Creating studio links for booking ${booking.id} with studios:`, parsedStudioIds);
          const createdLinks = await storage.createBookingStudioLinks(booking.id, parsedStudioIds);
          console.log(`[MULTI-STUDIO DEBUG] Successfully created ${createdLinks.length} studio links:`, createdLinks);
          
          // Verify the links were created by fetching them back
          const verificationLinks = await storage.getBookingStudioLinks(booking.id);
          console.log(`[MULTI-STUDIO DEBUG] Verification - fetched ${verificationLinks.length} links for booking ${booking.id}:`, verificationLinks);
        } catch (error) {
          console.error("[MULTI-STUDIO DEBUG] Error creating studio links:", error);
          console.error("[MULTI-STUDIO DEBUG] Error stack:", error.stack);
          // Continue with the response even if junction table entries fail
        }
      } else {
        console.log(`[MULTI-STUDIO DEBUG] No studioIds provided or empty array. studioIds:`, studioIds, `Length: ${studioIds?.length}, Type: ${typeof studioIds}`);
      }
      
      // Handle facility-wide maintenance alerts (send to ALL notification groups + site managers)
      // These are recognized by null studioId and maintenance or it_support type
      if (booking.studioId === null && (booking.type === "maintenance" || booking.type === "it_support" || 
          booking.type === "all-day:maintenance")) {
        try {
          console.log(`Processing facility-wide maintenance alert: ${booking.title}`);
          
          // Get ALL notification groups for maintenance alerts
          const allNotificationGroups = await storage.getAllNotificationGroups();
          const allGroupIds = allNotificationGroups.map(group => group.id);
          
          console.log(`[MAINTENANCE ALERT] Found ${allNotificationGroups.length} notification groups:`, allNotificationGroups.map(g => `${g.name} (${g.email}, enabled: ${g.enabled})`));
          console.log(`[MAINTENANCE ALERT] Sending maintenance alert to ALL ${allGroupIds.length} notification groups + site managers`);
          
          if (allGroupIds.length > 0) {
            try {
              // Send maintenance alert to ALL groups + site managers (always true for maintenance)
              console.log(`[MAINTENANCE ALERT] About to call sendMaintenanceAlertToGroups with group IDs: [${allGroupIds.join(', ')}]`);
              const emailResults = await sendMaintenanceAlertToGroups(booking, allGroupIds, true);
              console.log(`[MAINTENANCE ALERT] Email results received:`, emailResults);
              console.log(`[MAINTENANCE ALERT] Successfully sent maintenance alert to all ${allGroupIds.length} notification groups + site managers`);
            } catch (emailError) {
              console.error("[MAINTENANCE ALERT] Error sending maintenance alert emails:", emailError);
              // Continue even if emails fail
            }
          } else {
            console.log("[MAINTENANCE ALERT] ERROR: No notification groups found for maintenance alert");
          }
        } catch (error) {
          console.error("Error processing facility-wide maintenance alert:", error);
          // Continue with the response even if facility alert processing fails
        }
      }
      
      // Create notifications for the booking creator
      try {
        await storage.createNotification({
          userId: user.id,
          title: "Booking Confirmation",
          message: `Your booking for ${booking.title} has been created successfully.`,
          type: "booking_created",
          bookingId: booking.id
        });
        
        // Send email confirmation if this is a standard booking with a studio
        // Skip regular booking notifications for facility-wide maintenance alerts
        if (booking.studioId && !(booking.type === "maintenance" || booking.type === "it_support" || booking.type === "all-day:maintenance")) {
          try {
            const studio = await storage.getStudio(booking.studioId);
            if (studio) {
              console.log(`Sending booking confirmation email to user ${user.email} for booking "${booking.title}"`);
              try {
                await sendBookingConfirmation(booking, studio, user);
                console.log(`[BookingCreation] Booking confirmation email sent successfully`);
              } catch (confirmationError) {
                console.error(`[BookingCreation] Error sending booking confirmation:`, confirmationError);
                // Continue execution even if confirmation email fails
              }
              
              // Send notification to notification groups if they exist
              console.log(`[BookingCreation] ===== NOTIFICATION PROCESSING START =====`);
              console.log(`[BookingCreation] Raw booking.notifyList:`, booking.notifyList);
              console.log(`[BookingCreation] Type of notifyList:`, typeof booking.notifyList);
              console.log(`[BookingCreation] Is Array:`, Array.isArray(booking.notifyList));
              console.log(`[BookingCreation] String value:`, JSON.stringify(booking.notifyList));
              
              // Handle different notifyList formats - it might be JSON string or array
              let notifyGroupIds: number[] = [];
              
              if (booking.notifyList) {
                if (Array.isArray(booking.notifyList)) {
                  notifyGroupIds = booking.notifyList as number[];
                } else if (typeof booking.notifyList === 'string') {
                  try {
                    const parsed = JSON.parse(booking.notifyList);
                    if (Array.isArray(parsed)) {
                      notifyGroupIds = parsed;
                    }
                  } catch (parseError) {
                    console.error(`[BookingCreation] Error parsing notifyList string:`, parseError);
                  }
                }
              }
              
              console.log(`[BookingCreation] Final notification group IDs:`, notifyGroupIds);
              
              if (notifyGroupIds.length > 0) {
                try {
                  console.log(`[BookingCreation] Sending notification to ${notifyGroupIds.length} groups:`, notifyGroupIds);
                  const result = await sendBookingNotificationToGroups(
                    booking,
                    studio,
                    notifyGroupIds,
                    'created',
                    false  // Disable automatic site manager notifications since notifySiteManagers handles this
                  );
                  console.log(`[BookingCreation] Notification result:`, result);
                  console.log(`Notification sent to ${notifyGroupIds.length} groups about new booking`);
                } catch (notifyError) {
                  console.error("Error sending notification to groups:", notifyError);
                  // Continue execution even if notification failed
                }
              } else {
                console.log(`[BookingCreation] Skipping notification groups - no valid notification group IDs found`);
              }
              console.log(`[BookingCreation] ===== NOTIFICATION PROCESSING END =====`);
            }
          } catch (emailError) {
            console.error("Error sending booking confirmation email:", emailError);
            // Continue even if the email fails
          }
        }
      } catch (notificationError) {
        console.error("Error creating notification for new booking:", notificationError);
        // Continue with the response even if notification creation fails
      }
      
      // If there's a notify list, create notifications for those users too
      if (booking.notifyList && Array.isArray(booking.notifyList)) {
        for (const userId of booking.notifyList as number[]) {
          if (userId !== null && userId !== undefined) {
            try {
              await storage.createNotification({
                userId,
                title: "New Booking Notification",
                message: `A new booking "${booking.title}" has been created that requires your attention.`,
                type: "booking_created",
                bookingId: booking.id
              });
            } catch (notifyError) {
              console.error(`Error creating notification for user ${userId} in notify list:`, notifyError);
              // Continue with the next notification
            }
          }
        }
      }
      
      // Send site manager notification for regular bookings ONLY (not for facility-wide maintenance alerts)
      // Facility-wide maintenance alerts are handled separately above
      if (!(booking.studioId === null && (booking.type === "maintenance" || booking.type === "it_support" || booking.type === "all-day:maintenance"))) {
        console.log('[BookingCreation] ===== SITE MANAGER EMAIL NOTIFICATION START =====');
        try {
          const studios = await storage.getBookingStudios(booking.id);
          const bookingUser = await storage.getUser(booking.userId);
          if (bookingUser) {
            console.log(`[BookingCreation] Sending site manager email notification for regular booking ${booking.id}`);
            console.log('[BookingCreation] User for notification:', bookingUser.username, bookingUser.email);
            console.log('[BookingCreation] Studios for notification:', studios.map(s => s.name));
            console.log('[BookingCreation] Booking details:', {
              title: booking.title,
              type: booking.type,
              start: booking.start,
              end: booking.end
            });
            
            const siteManagerResult = await sendSiteManagerNotification(booking, studios, bookingUser, 'created');
            console.log('[BookingCreation] Site manager email notification result:', siteManagerResult);
          } else {
            console.log('[BookingCreation] ERROR: Missing booking user for site manager notification');
          }
        } catch (siteManagerError) {
          console.error('[BookingCreation] ERROR sending site manager email notification:', siteManagerError);
          console.error('[BookingCreation] Site manager error stack:', siteManagerError.stack);
          // Continue with response even if site manager notification fails
        }
        console.log('[BookingCreation] ===== SITE MANAGER EMAIL NOTIFICATION END =====');
      } else {
        console.log('[BookingCreation] Skipping regular site manager notification for facility-wide maintenance alert - handled by maintenance alert system');
      }
      
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("ZodError:", JSON.stringify(error.errors));
        return res.status(400).json({ 
          message: "Invalid booking data: " + error.errors.map(e => `${e.path}: ${e.message}`).join(', '),
          errors: error.errors 
        });
      }
      console.error("Booking error:", error);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });
  
  // Copy a booking to multiple dates
  app.post("/api/bookings/copy", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { bookingId, dates, titleSuffix } = req.body;
      
      if (!bookingId || !dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({ message: "Invalid request. Booking ID and at least one date required." });
      }
      
      // Fetch the original booking
      const originalBooking = await storage.getBooking(bookingId);
      if (!originalBooking) {
        return res.status(404).json({ message: "Original booking not found" });
      }
      
      // Check if user has permission to copy this booking
      const canCopy = 
        user.role === "admin" || 
        (user.role === "producer" && (originalBooking.userId === user.id || originalBooking.type === "production" || originalBooking.type === "rehearsal")) ||
        (user.role === "engineer" && (originalBooking.type === "maintenance")) ||
        (user.role === "site_manager") || // Site managers can copy any booking
        (user.role === "it" && (originalBooking.type === "maintenance" || originalBooking.type === "it_support"));
      
      if (!canCopy) {
        return res.status(403).json({ message: "You don't have permission to copy this booking" });
      }
      
      console.log(`Copying booking ${bookingId} to ${dates.length} dates`);
      
      // Convert date strings to Date objects with proper timezone handling
      const datesToCopy = dates.map(dateStr => {
        // Ensure we're working with just the date portion (YYYY-MM-DD)
        // Some browsers/frameworks might send dates with time components
        const datePart = dateStr.split('T')[0];
        
        // Create date at midnight UTC for the specified date
        // This ensures we pass a clean date to the storage function
        const [year, month, day] = datePart.split('-').map(num => parseInt(num));
        const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        
        console.log(`Processing target date: ${dateStr} => ${date.toISOString()}`);
        console.log(`Target date parsed as: Year=${year}, Month=${month}, Day=${day}`);
        return date;
      });
      
      // Use the storage method to copy the booking
      const newBookings = await storage.copyBookingToMultipleDates(bookingId, datesToCopy);
      
      // Apply title suffix if provided
      if (titleSuffix && newBookings.length > 0) {
        for (const newBooking of newBookings) {
          await storage.updateBooking(
            newBooking.id, 
            { title: `${newBooking.title} - ${titleSuffix}` }
          );
        }
      }
      
      // Format results in the expected format for the client
      const results = newBookings.map(booking => ({
        date: booking.start.toISOString().split('T')[0],
        success: true,
        booking
      }));
      
      // Add failed entries for dates that weren't processed
      // (This would happen if a date was the same as the original booking)
      const processedDates = new Set(newBookings.map(b => new Date(b.start).toDateString()));
      const failedResults = datesToCopy
        .filter(d => !processedDates.has(d.toDateString()))
        .map(d => ({
          date: d.toISOString().split('T')[0],
          success: false,
          error: "Date is the same as original booking or had a conflict"
        }));
      
      const allResults = [...results, ...failedResults];
      const successCount = results.length;
      const failCount = failedResults.length;
      
      res.status(201).json({ 
        success: successCount > 0,
        message: `Copied booking to ${successCount} dates${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        results: allResults
      });
    } catch (error) {
      console.error("Error copying booking:", error);
      res.status(500).json({ message: "Failed to copy booking" });
    }
  });

  app.patch("/api/bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      const user = req.user as any;
      
      // Check permissions based on booking type and role
      if (booking.type === "maintenance" || booking.type === "all-day:maintenance") {
        // Only admin, engineers, IT staff, and site managers can update maintenance bookings
        if (!["admin", "engineer", "it", "site_manager"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin, engineers, IT staff, and site managers can update maintenance bookings" });
        }
      } else if (booking.type === "it_support") {
        // Only admin, IT staff, and site managers can update IT support bookings
        if (!["admin", "it", "site_manager"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin, IT staff, and site managers can update IT support bookings" });
        }
      } else {
        // For regular production bookings, only the creator, admin, producers, engineers, or site managers can update
        if (booking.userId !== user.id && user.role !== "admin" && user.role !== "producer" && user.role !== "engineer" && user.role !== "site_manager") {
          return res.status(403).json({ message: "You don't have permission to update this booking" });
        }
      }
      
      // Validate the update data
      let updateData = { ...req.body };
      
      // Check if we have any meaningful data to update
      const hasUpdates = Object.keys(updateData).some(key => 
        key !== 'studioIds' && updateData[key] !== undefined && updateData[key] !== null
      );
      
      // Extract studio IDs for conflict checking and junction table
      const studioIds = updateData.studioIds || [];
      
      // If no meaningful updates and no studio changes, return the current booking
      if (!hasUpdates && studioIds.length === 0) {
        console.log("No updates provided, returning current booking");
        return res.json(booking);
      }
      
      // Convert date strings to Date objects
      if (updateData.start && typeof updateData.start === 'string') {
        updateData.start = new Date(updateData.start);
      }
      
      if (updateData.end && typeof updateData.end === 'string') {
        updateData.end = new Date(updateData.end);
      }
      
      // Fix foreign key constraints - set to null if 0 or undefined (same as POST route)
      updateData = {
        ...updateData,
        studioId: updateData.studioId === 0 || updateData.studioId === undefined ? null : updateData.studioId,
        templateId: updateData.templateId === 0 || updateData.templateId === undefined ? null : updateData.templateId,
        pcrRoomId: updateData.pcrRoomId === 0 || updateData.pcrRoomId === undefined ? null : updateData.pcrRoomId
      };
      
      console.log("Processing update with data:", updateData);
      
      // Check for booking conflicts for all studios in the request
      let conflict = false;
      let conflictingStudio = null;
      
      // Only check for conflicts if we have studio selections and date is changing
      if (studioIds.length > 0 && (updateData.start || updateData.end)) {
        const start = updateData.start || new Date(booking.start);
        const end = updateData.end || new Date(booking.end);
        
        // Check each studio for conflicts
        for (const studioIdStr of studioIds) {
          const studioId = parseInt(studioIdStr);
          const existingBookings = await storage.getBookingsByStudio(studioId);
          
          const hasConflict = existingBookings.some(b => {
            if (b.id === id) return false; // Skip the current booking
            // Skip cancelled bookings - they don't create conflicts
            if (b.status === 'cancelled') return false;
            
            const bookingStart = new Date(b.start);
            const bookingEnd = new Date(b.end);
            
            return (
              (start >= bookingStart && start < bookingEnd) ||
              (end > bookingStart && end <= bookingEnd) ||
              (start <= bookingStart && end >= bookingEnd)
            );
          });
          
          if (hasConflict) {
            conflict = true;
            conflictingStudio = studioId;
            break;
          }
        }
      }
      // If no studioIds provided, but dates and studioId are changing, check for conflicts the old way
      else if ((updateData.start || updateData.end) && 
               (updateData.studioId !== null && booking.studioId !== null)) {
        const start = updateData.start || new Date(booking.start);
        const end = updateData.end || new Date(booking.end);
        const studioId = updateData.studioId !== undefined ? updateData.studioId : booking.studioId;
        
        if (studioId !== null) {
          const existingBookings = await storage.getBookingsByStudio(studioId);
          
          const hasConflict = existingBookings.some(b => {
            if (b.id === id) return false; // Skip the current booking
            // Skip cancelled bookings - they don't create conflicts
            if (b.status === 'cancelled') return false;
            
            const bookingStart = new Date(b.start);
            const bookingEnd = new Date(b.end);
            
            return (
              (start >= bookingStart && start < bookingEnd) ||
              (end > bookingStart && end <= bookingEnd) ||
              (start <= bookingStart && end >= bookingEnd)
            );
          });
          
          if (hasConflict) {
            conflict = true;
            conflictingStudio = studioId;
          }
        }
      }
      
      if (conflict) {
        // Get the studio name for better error message
        const studio = await storage.getStudio(conflictingStudio);
        return res.status(409).json({ 
          message: `There is a booking conflict for ${studio ? studio.name : `studio ID ${conflictingStudio}`} during this time slot`
        });
      }
      
      // Check for PCR room conflicts if a PCR room is assigned and dates are changing
      if ((updateData.pcrRoomId !== undefined || booking.pcrRoomId) && (updateData.start || updateData.end)) {
        const start = updateData.start || new Date(booking.start);
        const end = updateData.end || new Date(booking.end);
        const pcrRoomId = updateData.pcrRoomId !== undefined ? updateData.pcrRoomId : booking.pcrRoomId;
        
        if (pcrRoomId) {
          const pcrConflicts = await storage.checkPcrRoomConflicts(pcrRoomId, start, end, id);
          
          if (pcrConflicts.length > 0) {
            // Get the PCR room name for better error message
            const pcrRoom = await storage.getPcrRoom(pcrRoomId);
            return res.status(409).json({ 
              message: `There is a PCR room conflict for ${pcrRoom ? pcrRoom.name : `PCR room ID ${pcrRoomId}`} during this time slot`
            });
          }
        }
      }
      
      // Parse studioIds to ensure they're all numbers
      const parsedStudioIds = studioIds && studioIds.length > 0 
        ? studioIds.map(id => typeof id === 'string' ? parseInt(id) : id)
        : undefined;
        
      // Use the updated version of updateBooking that handles studio links
      const updatedBooking = await storage.updateBooking(id, updateData, parsedStudioIds);
      
      if (parsedStudioIds && parsedStudioIds.length > 0) {
        console.log(`Updated studio links for booking ${id}: ${parsedStudioIds.join(', ')}`);
      }
      
      // Check if this is a facility-wide maintenance alert (null studioId and maintenance/IT related type)
      if (updatedBooking && updatedBooking.studioId === null && 
          (updatedBooking.type === "maintenance" || updatedBooking.type === "it_support" || 
           updatedBooking.type === "all-day:maintenance")) {
        try {
          console.log(`Processing updated facility-wide maintenance alert: ${updatedBooking.title}`);
          
          // Get ALL notification groups for maintenance alerts
          const allNotificationGroups = await storage.getAllNotificationGroups();
          const allGroupIds = allNotificationGroups.map(group => group.id);
          
          console.log(`Sending updated maintenance alert to ALL ${allGroupIds.length} notification groups + site managers`);
          
          if (allGroupIds.length > 0) {
            try {
              // Send maintenance alert to ALL groups + site managers (always true for maintenance)
              await sendMaintenanceAlertToGroups(updatedBooking, allGroupIds, true);
              console.log(`Updated maintenance alert sent to all ${allGroupIds.length} notification groups + site managers`);
            } catch (emailError) {
              console.error("Error sending updated maintenance alert emails:", emailError);
              // Continue even if emails fail
            }
          } else {
            console.log("No notification groups found for updated maintenance alert");
          }
        } catch (error) {
          console.error("Error processing updated facility-wide maintenance alert:", error);
          // Continue with the response even if facility alert processing fails
        }
      }
      
      // Only create notification if there's a valid user associated with this booking
      // Facility-wide alerts may not have a specific user
      console.log(`Booking user ID before notification check: ${booking.userId}`);
      
      if (booking.userId !== null && booking.userId !== undefined) {
        try {
          console.log(`Creating notification for user ID: ${booking.userId}`);
          await storage.createNotification({
            userId: booking.userId,
            title: "Booking Updated",
            message: `Your booking for "${booking.title}" has been updated.`,
            type: "booking_updated",
            bookingId: booking.id
          });
          
          // Send email notification about the update if this is a standard booking with a studio
          if (updatedBooking && updatedBooking.studioId) {
            try {
              // Get the user and studio info
              const bookingUser = await storage.getUser(booking.userId);
              const studio = await storage.getStudio(updatedBooking.studioId);
              
              if (bookingUser && studio) {
                console.log(`Sending booking update email to user ${bookingUser.email} for booking "${updatedBooking.title}"`);
                await sendBookingUpdate(updatedBooking, studio, bookingUser);
                
                // Send notification to notification groups if they exist
                // Use the notification list from updateData if provided, otherwise use the original booking's list
                const notifyList = updateData.notifyList !== undefined ? updateData.notifyList : booking.notifyList;
                console.log(`[BookingUpdate] Checking notification groups - notifyList:`, notifyList);
                console.log(`[BookingUpdate] notifyList type:`, typeof notifyList, 'isArray:', Array.isArray(notifyList));
                
                if (notifyList && Array.isArray(notifyList) && notifyList.length > 0) {
                  try {
                    console.log(`[BookingUpdate] Sending notification to ${notifyList.length} groups:`, notifyList);
                    await sendBookingNotificationToGroups(
                      updatedBooking,
                      studio,
                      notifyList as number[],
                      'updated',
                      false  // Disable automatic site manager notifications since sendSiteManagerNotification handles this
                    );
                    console.log(`Notification sent to ${notifyList.length} groups about booking update`);
                  } catch (notifyError) {
                    console.error("Error sending notification to groups:", notifyError);
                    // Continue execution even if notification failed
                  }
                } else {
                  console.log(`[BookingUpdate] Skipping notification groups - no valid notifyList found`);
                }
              }
            } catch (emailError) {
              console.error("Error sending booking update email:", emailError);
              // Continue even if the email fails
            }
          }
        } catch (notificationError) {
          console.error("Error creating notification:", notificationError);
          // Continue with the response even if notification creation fails
        }
      } else {
        console.log(`Skipping notification creation - no valid userId found (userId = ${booking.userId})`);
      }
      
      // Send site manager notification for booking update
      try {
        const studios = [];
        if (parsedStudioIds && parsedStudioIds.length > 0) {
          for (const studioId of parsedStudioIds) {
            const studio = await storage.getStudio(studioId);
            if (studio) studios.push(studio);
          }
        } else if (updatedBooking && updatedBooking.studioId) {
          const studio = await storage.getStudio(updatedBooking.studioId);
          if (studio) studios.push(studio);
        }
        
        if (studios.length > 0 && updatedBooking) {
          const bookingUser = booking.userId ? await storage.getUser(booking.userId) : req.user;
          if (bookingUser) {
            // Track what was changed for the notification
            const changes = {};
            Object.keys(updateData).forEach(key => {
              if (updateData[key] !== undefined) {
                changes[key] = updateData[key];
              }
            });
            
            await sendSiteManagerNotification(updatedBooking, studios, bookingUser, 'updated', changes);
            console.log(`Site manager notification sent for updated booking ${updatedBooking.id}`);
          }
        }
      } catch (siteManagerError) {
        console.error("Error sending site manager notification for booking update:", siteManagerError);
        // Continue execution even if site manager notification fails
      }
      
      res.json(updatedBooking);
    } catch (error) {
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  app.delete("/api/bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      const user = req.user as any;
      
      // Check permissions based on booking type and role
      if (booking.type === "maintenance" || booking.type === "all-day:maintenance") {
        // Only admin, engineers, IT staff, and site managers can delete maintenance bookings
        if (!["admin", "engineer", "it", "site_manager"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin, engineers, IT staff, and site managers can delete maintenance bookings" });
        }
      } else if (booking.type === "it_support") {
        // Only admin, IT staff, and site managers can delete IT support bookings
        if (!["admin", "it", "site_manager"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin, IT staff, and site managers can delete IT support bookings" });
        }
      } else {
        // For regular production bookings, only the creator, admin, producers, or site managers can delete
        if (booking.userId !== user.id && user.role !== "admin" && user.role !== "producer" && user.role !== "site_manager") {
          return res.status(403).json({ message: "You don't have permission to delete this booking" });
        }
      }
      
      const success = await storage.deleteBooking(id);
      
      if (success) {
        // Create notification for the booking owner if not the deleter
        // and if there is a valid userId (facility-wide alerts might not have one)
        if (booking.userId !== null && booking.userId !== undefined && booking.userId !== user.id) {
          let deletedByRole = "administrator";
          if (["engineer", "it"].includes(user.role)) {
            deletedByRole = user.role === "engineer" ? "an engineer" : "IT support";
          }
          
          try {
            await storage.createNotification({
              userId: booking.userId,
              title: booking.studioId === null ? "Alert Deleted" : "Booking Deleted",
              message: booking.studioId === null
                ? `Your facility alert "${booking.title}" has been deleted by ${deletedByRole}.`
                : `Your booking for "${booking.title}" has been deleted by ${deletedByRole}.`,
              type: "booking_deleted",
              bookingId: booking.id
            });
            
            // Send email notification about the deletion if this is a standard booking with a studio
            if (booking.studioId) {
              try {
                // Get the user and studio info
                const bookingUser = await storage.getUser(booking.userId);
                const studio = await storage.getStudio(booking.studioId);
                
                if (bookingUser && studio) {
                  console.log(`Sending booking cancellation email to user ${bookingUser.email} for booking "${booking.title}"`);
                  await sendBookingCancellation(booking, studio, bookingUser);
                  
                  // Send notification to notification groups if they exist
                  if (booking.notifyList && Array.isArray(booking.notifyList) && booking.notifyList.length > 0) {
                    try {
                      await sendBookingNotificationToGroups(
                        booking,
                        studio,
                        booking.notifyList as number[],
                        'cancelled'
                      );
                      console.log(`Notification sent to ${booking.notifyList.length} groups about booking cancellation`);
                    } catch (notifyError) {
                      console.error("Error sending cancellation notification to groups:", notifyError);
                      // Continue execution even if notification failed
                    }
                  }
                }
              } catch (emailError) {
                console.error("Error sending booking cancellation email:", emailError);
                // Continue even if the email fails
              }
            }
          } catch (notificationError) {
            console.error("Error creating notification for deletion:", notificationError);
            // Continue with the response even if notification creation fails
          }
        }
        
        // Send site manager notification for booking deletion
        try {
          const studios = [];
          // Get studio information for the deleted booking
          if (booking.studioId) {
            const studio = await storage.getStudio(booking.studioId);
            if (studio) studios.push(studio);
          } else {
            // For multi-studio bookings, get all associated studios
            try {
              const bookingStudios = await storage.getStudiosForBooking(booking.id);
              studios.push(...bookingStudios);
            } catch (studioError) {
              console.error("Error getting studios for deleted booking:", studioError);
            }
          }
          
          if (studios.length > 0) {
            const deletingUser = user;
            await sendSiteManagerNotification(booking, studios, deletingUser, 'deleted');
            console.log(`Site manager notification sent for deleted booking ${booking.id}`);
          }
        } catch (siteManagerError) {
          console.error("Error sending site manager notification for booking deletion:", siteManagerError);
          // Continue execution even if site manager notification fails
        }
        
        return res.json({ message: "Booking deleted successfully" });
      } else {
        return res.status(500).json({ message: "Failed to delete booking" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete booking" });
    }
  });

  // ALERT ROUTES - Completely separate from booking system
  // Alerts handle facility-wide notifications (maintenance, IT support, emergency alerts)
  // These routes do NOT interact with studios, PCR rooms, or booking-specific fields
  
  // GET /api/alerts - Get all alerts
  app.get("/api/alerts", isAuthenticated, async (req, res) => {
    try {
      const alerts = await storage.getAllAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });
  
  // GET /api/alerts/range - Get alerts by date range
  app.get("/api/alerts/range", isAuthenticated, async (req, res) => {
    try {
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({ message: "Start and end dates are required" });
      }
      
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      const alerts = await storage.getAlertsByDateRange(startDate, endDate);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts by date range:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });
  
  // GET /api/alerts/:id - Get specific alert
  app.get("/api/alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid alert ID" });
      }
      
      const alert = await storage.getAlert(id);
      
      if (!alert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      
      res.json(alert);
    } catch (error) {
      console.error("Error fetching alert:", error);
      res.status(500).json({ message: "Failed to fetch alert" });
    }
  });
  
  // POST /api/alerts - Create new alert
  app.post("/api/alerts", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Only admin, engineers, IT staff, and site managers can create alerts
      if (!["admin", "engineer", "it", "site_manager"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only admin, engineers, IT staff, and site managers can create alerts" 
        });
      }
      
      // Validate alert data using Zod schema
      const alertData = insertAlertSchema.parse({
        ...req.body,
        createdBy: user.id
      });
      
      const alert = await storage.createAlert(alertData);
      
      console.log(`Alert created by ${user.username} (ID: ${user.id}): "${alert.title}"`);
      
      // Send facility-wide notifications for all alerts
      try {
        console.log(`Processing facility-wide alert notification: ${alert.title}`);
        
        // Get ALL notification groups for facility alerts  
        const allNotificationGroups = await storage.getAllNotificationGroups();
        const allGroupIds = allNotificationGroups.map(group => group.id);
        
        console.log(`[ALERT NOTIFICATION] Found ${allNotificationGroups.length} notification groups:`, allNotificationGroups.map(g => `${g.name} (${g.email}, enabled: ${g.enabled})`));
        console.log(`[ALERT NOTIFICATION] Sending facility alert to ALL ${allGroupIds.length} notification groups + site managers`);
        
        if (allGroupIds.length > 0) {
          // Convert alert to booking format for email compatibility
          const alertAsBooking = {
            id: alert.id,
            title: alert.title,
            description: alert.description || '',
            start: alert.start,
            end: alert.end,
            type: alert.alertType,
            severity: alert.severity,
            studioId: null, // Alerts don't have studios
            pcrRoomId: null,
            userId: alert.createdBy,
            notifyList: [],
            status: alert.status,
            templateId: null,
            createdAt: alert.createdAt,
            color: '#f44336'
          };
          
          try {
            // Send facility alert to ALL groups + site managers (always true for alerts)
            console.log(`[ALERT NOTIFICATION] About to call sendMaintenanceAlertToGroups with group IDs: [${allGroupIds.join(', ')}]`);
            const emailResults = await sendMaintenanceAlertToGroups(alertAsBooking, allGroupIds, true);
            console.log(`[ALERT NOTIFICATION] Email results received:`, emailResults);
            console.log(`[ALERT NOTIFICATION] Successfully sent facility alert to all ${allGroupIds.length} notification groups + site managers`);
          } catch (emailError) {
            console.error("[ALERT NOTIFICATION] Error sending facility alert emails:", emailError);
            // Continue even if emails fail
          }
        } else {
          console.log("[ALERT NOTIFICATION] ERROR: No notification groups found for facility alert");
        }
      } catch (error) {
        console.error("Error processing facility-wide alert notification:", error);
        // Continue with the response even if alert notification processing fails
      }
      
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating alert:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid alert data", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create alert" });
    }
  });
  
  // PATCH /api/alerts/:id - Update alert
  app.patch("/api/alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as any;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid alert ID" });
      }
      
      // Get existing alert to check permissions
      const existingAlert = await storage.getAlert(id);
      
      if (!existingAlert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      
      // Permission check: Only creator, admin, engineers, IT staff, and site managers can update
      if (existingAlert.createdBy !== user.id && 
          !["admin", "engineer", "it", "site_manager"].includes(user.role)) {
        return res.status(403).json({ 
          message: "You don't have permission to update this alert" 
        });
      }
      
      // Clean and validate update data
      const updateData = { ...req.body };
      delete updateData.id; // Prevent ID modification
      delete updateData.createdBy; // Prevent creator modification
      delete updateData.createdAt; // Prevent creation date modification
      
      console.log(`Attempting to update alert ${id} with data:`, updateData);
      console.log(`Existing alert:`, existingAlert);
      
      const updatedAlert = await storage.updateAlert(id, updateData);
      
      if (!updatedAlert) {
        console.error(`Update alert ${id} returned null/undefined`);
        return res.status(500).json({ message: "Failed to update alert" });
      }
      
      console.log(`Alert ${id} updated successfully by ${user.username} (ID: ${user.id})`);
      
      // Send facility-wide notifications for updated alerts 
      try {
        console.log(`Processing facility-wide alert update notification: ${updatedAlert.title}`);
        
        // Get ALL notification groups for facility alerts  
        const allNotificationGroups = await storage.getAllNotificationGroups();
        const allGroupIds = allNotificationGroups.map(group => group.id);
        
        console.log(`[ALERT UPDATE NOTIFICATION] Found ${allNotificationGroups.length} notification groups:`, allNotificationGroups.map(g => `${g.name} (${g.email}, enabled: ${g.enabled})`));
        console.log(`[ALERT UPDATE NOTIFICATION] Sending updated facility alert to ALL ${allGroupIds.length} notification groups + site managers`);
        
        if (allGroupIds.length > 0) {
          // Convert alert to booking format for email compatibility
          const alertAsBooking = {
            id: updatedAlert.id,
            title: updatedAlert.title,
            description: updatedAlert.description || '',
            start: updatedAlert.start,
            end: updatedAlert.end,
            type: updatedAlert.alertType,
            severity: updatedAlert.severity,
            studioId: null, // Alerts don't have studios
            pcrRoomId: null,
            userId: updatedAlert.createdBy,
            notifyList: [],
            status: updatedAlert.status,
            templateId: null,
            createdAt: updatedAlert.createdAt,
            color: '#f44336'
          };
          
          try {
            // Send updated facility alert to ALL groups + site managers (always true for alerts)
            console.log(`[ALERT UPDATE NOTIFICATION] About to call sendMaintenanceAlertToGroups with group IDs: [${allGroupIds.join(', ')}]`);
            const emailResults = await sendMaintenanceAlertToGroups(alertAsBooking, allGroupIds, true);
            console.log(`[ALERT UPDATE NOTIFICATION] Email results received:`, emailResults);
            console.log(`[ALERT UPDATE NOTIFICATION] Successfully sent updated facility alert to all ${allGroupIds.length} notification groups + site managers`);
          } catch (emailError) {
            console.error("[ALERT UPDATE NOTIFICATION] Error sending updated facility alert emails:", emailError);
            // Continue even if emails fail
          }
        } else {
          console.log("[ALERT UPDATE NOTIFICATION] ERROR: No notification groups found for updated facility alert");
        }
      } catch (error) {
        console.error("Error processing facility-wide alert update notification:", error);
        // Continue with the response even if alert notification processing fails
      }
      
      res.json(updatedAlert);
    } catch (error) {
      console.error("Error updating alert - detailed error:", error);
      console.error("Error stack:", error.stack);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      
      // Provide more specific error messages
      if (error.message?.includes('schema') || error.message?.includes('constraint')) {
        return res.status(400).json({ 
          message: "Invalid alert data format", 
          details: error.message 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to update alert",
        details: error.message || "Unknown error"
      });
    }
  });
  
  // DELETE /api/alerts/:id - Delete alert
  app.delete("/api/alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as any;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid alert ID" });
      }
      
      // Get existing alert to check permissions
      const existingAlert = await storage.getAlert(id);
      
      if (!existingAlert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      
      // Permission check: Only creator, admin, engineers, IT staff, and site managers can delete
      if (existingAlert.createdBy !== user.id && 
          !["admin", "engineer", "it", "site_manager"].includes(user.role)) {
        return res.status(403).json({ 
          message: "You don't have permission to delete this alert" 
        });
      }
      
      const success = await storage.deleteAlert(id);
      
      if (success) {
        console.log(`Alert ${id} deleted by ${user.username} (ID: ${user.id})`);
        res.json({ message: "Alert deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete alert" });
      }
    } catch (error) {
      console.error("Error deleting alert:", error);
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  // Notification routes
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const notifications = await storage.getNotificationsByUser(user.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedNotification = await storage.markNotificationAsRead(id);
      
      if (!updatedNotification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json(updatedNotification);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Notification Group routes
  app.get("/api/notification-groups", isAuthenticated, async (req, res) => {
    try {
      const groups = await storage.getAllNotificationGroups();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notification groups" });
    }
  });

  app.get("/api/notification-groups/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const group = await storage.getNotificationGroup(id);
      
      if (!group) {
        return res.status(404).json({ message: "Notification group not found" });
      }
      
      res.json(group);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notification group" });
    }
  });

  app.get("/api/notification-groups/type/:groupType", isAuthenticated, async (req, res) => {
    try {
      const { groupType } = req.params;
      const group = await storage.getNotificationGroupByType(groupType);
      
      if (!group) {
        return res.status(404).json({ message: "Notification group not found" });
      }
      
      res.json(group);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notification group by type" });
    }
  });

  app.post("/api/notification-groups", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Only admins, engineers, and IT can manage notification groups
      if (!["admin", "engineer", "it", "site_manager"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only administrators, engineers, IT support, and site managers can manage notification groups" 
        });
      }
      
      // Validate request body
      const groupData = insertNotificationGroupSchema.parse(req.body);
      const newGroup = await storage.createNotificationGroup(groupData);
      res.status(201).json(newGroup);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ZodError) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create notification group" });
    }
  });

  app.patch("/api/notification-groups/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id);
      
      console.log(`[NotificationGroup] Update request for ID ${id} by user ${user.username}:`, req.body);
      
      // Only admins, engineers, and IT can manage notification groups
      if (!["admin", "engineer", "it", "site_manager"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only administrators, engineers, IT support, and site managers can manage notification groups" 
        });
      }
      
      const group = await storage.getNotificationGroup(id);
      if (!group) {
        return res.status(404).json({ message: "Notification group not found" });
      }
      
      const updateData = req.body;
      console.log(`[NotificationGroup] Updating group ${id} with data:`, updateData);
      
      const updatedGroup = await storage.updateNotificationGroup(id, updateData);
      console.log(`[NotificationGroup] Update result:`, updatedGroup);
      
      res.json(updatedGroup);
    } catch (error) {
      console.error(`[NotificationGroup] Update error for ID ${req.params.id}:`, error);
      if (error instanceof ValidationError || error instanceof ZodError) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update notification group" });
    }
  });

  app.delete("/api/notification-groups/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id);
      
      // Only admins, engineers, IT, and site managers can manage notification groups
      if (!["admin", "engineer", "it", "site_manager"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only administrators, engineers, IT support, and site managers can manage notification groups" 
        });
      }
      
      const group = await storage.getNotificationGroup(id);
      if (!group) {
        return res.status(404).json({ message: "Notification group not found" });
      }
      
      const success = await storage.deleteNotificationGroup(id);
      if (success) {
        res.status(204).end();
      } else {
        res.status(500).json({ message: "Failed to delete notification group" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete notification group" });
    }
  });

  // Configure multer for file uploads with our custom configuration
  
  // File attachment routes
  app.post(
    "/api/bookings/:bookingId/attachments",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const bookingId = parseInt(req.params.bookingId);
        const user = req.user as Express.User;
        const description = req.body.description;

        // Check if booking exists and user has permission
        const booking = await storage.getBooking(bookingId);
        if (!booking) {
          return res.status(404).json({ message: "Booking not found" });
        }

        // Only booking owner, admin, engineer, IT, site manager, or producer can add attachments
        if (
          booking.userId !== user.id &&
          !["admin", "engineer", "it", "site_manager", "producer"].includes(user.role)
        ) {
          return res.status(403).json({
            message: "You don't have permission to add attachments to this booking",
          });
        }

        // Save the file metadata to database
        const savedFile = await fileService.saveFileMetadata(req.file, bookingId, user.id, description);

        // Send email notifications to distribution groups if booking has notification list
        try {
          if (booking.notifyList && Array.isArray(booking.notifyList) && booking.notifyList.length > 0) {
            await sendFileAttachmentNotificationToGroups(
              booking,
              savedFile,
              user,
              booking.notifyList,
              true // Always notify site managers
            );
            console.log(`File attachment notifications sent to ${booking.notifyList.length} groups for booking ${bookingId}`);
          } else {
            console.log(`No notification groups configured for booking ${bookingId}`);
          }
        } catch (emailError) {
          console.error('Failed to send file attachment notifications:', emailError);
          // Don't fail the upload if email fails
        }

        res.status(201).json(savedFile);
      } catch (error: any) {
        console.error("Error uploading file:", error);
        if (error.message === "File too large") {
          return res.status(413).json({ message: "File exceeds the 100MB size limit" });
        }
        res.status(500).json({ message: "Failed to upload file" });
      }
    }
  );

  // Get all attachments for a booking
  app.get("/api/bookings/:bookingId/attachments", isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.bookingId);
      console.log(`[API] Fetching attachments for booking ID: ${bookingId}`);

      // Check if booking exists
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        console.log(`[API] Booking not found with ID: ${bookingId}`);
        return res.status(404).json({ message: "Booking not found" });
      }

      // Get attachments from fileService
      const attachments = await fileService.getFileAttachments(bookingId);
      console.log(`[API] Found ${attachments.length} attachments for booking ID: ${bookingId}`);
      
      // Return only the attachments
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ message: "Failed to fetch attachments" });
    }
  });

  // Download a file attachment
  app.get("/api/attachments/:fileId", isAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const user = req.user as Express.User;
      
      // Check permissions
      const hasPermission = await fileService.userHasPermission(
        fileId, 
        user.id, 
        user.role === 'admin' || user.role === 'engineer' || user.role === 'it' || user.role === 'site_manager'
      );
      
      if (!hasPermission) {
        return res.status(403).json({ message: "You don't have permission to access this file" });
      }
      
      const file = await fileService.getFileById(fileId);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check if file exists
      if (!fs.existsSync(file.path)) {
        return res.status(404).json({ message: "File not found on server" });
      }

      // Set appropriate headers
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
      res.setHeader('Content-Type', file.mimeType);
      
      // Stream the file to the client
      const fileStream = fs.createReadStream(file.path);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Delete a file attachment
  app.delete("/api/attachments/:fileId", isAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const user = req.user as Express.User;

      // Check permissions
      const hasPermission = await fileService.userHasPermission(
        fileId, 
        user.id, 
        user.role === 'admin' || user.role === 'site_manager'
      );
      
      if (!hasPermission) {
        return res.status(403).json({ message: "You don't have permission to delete this file" });
      }
      
      // Delete the file
      await fileService.deleteFile(fileId);

      res.json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // System Settings routes
  app.get("/api/system/site-name", async (req, res) => {
    try {
      const siteName = await storage.getSiteName();
      res.json({ siteName });
    } catch (error) {
      console.error("Error getting site name:", error);
      res.status(500).json({ message: "Failed to fetch site name" });
    }
  });

  app.put("/api/system/site-name", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const { siteName } = req.body;
      
      if (!siteName || typeof siteName !== 'string') {
        return res.status(400).json({ message: "Site name is required and must be a string" });
      }
      
      const setting = await storage.setSiteName(siteName);
      res.json({ siteName: setting.value, message: "Site name updated successfully" });
    } catch (error) {
      console.error("Error setting site name:", error);
      res.status(500).json({ message: "Failed to update site name" });
    }
  });

  app.get("/api/system/settings", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error getting all system settings:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  // System timezone routes
  app.get("/api/system/timezone", async (req, res) => {
    try {
      const timezoneSetting = await storage.getSystemSetting('facilityTimezone');
      const dbTimezone = timezoneSetting?.value || null;
      
      // If no database setting, return the server environment variable
      const envTimezone = process.env.VITE_FACILITY_TIMEZONE || process.env.FACILITY_TIMEZONE;
      const timezone = dbTimezone || envTimezone;
      
      res.json({ 
        timezone,
        source: dbTimezone ? 'database' : 'environment',
        environment: envTimezone 
      });
    } catch (error) {
      console.error("Error getting facility timezone:", error);
      res.status(500).json({ message: "Failed to fetch facility timezone" });
    }
  });

  app.put("/api/system/timezone", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const { timezone } = req.body;
      
      if (!timezone || typeof timezone !== 'string') {
        return res.status(400).json({ message: "Timezone is required and must be a string" });
      }
      
      // Validate timezone (basic validation)
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch (e) {
        return res.status(400).json({ message: "Invalid timezone identifier" });
      }
      
      const setting = await storage.upsertSystemSetting({ 
        key: 'facilityTimezone', 
        value: timezone 
      });
      
      res.json({ timezone: setting.value, message: "Facility timezone updated successfully" });
    } catch (error) {
      console.error("Error setting facility timezone:", error);
      res.status(500).json({ message: "Failed to update facility timezone" });
    }
  });

  app.delete("/api/system/timezone", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const deleted = await storage.deleteSystemSetting('facilityTimezone');
      
      if (deleted) {
        res.json({ message: "Facility timezone cleared successfully" });
      } else {
        res.json({ message: "No timezone setting found to clear" });
      }
    } catch (error) {
      console.error("Error clearing facility timezone:", error);
      res.status(500).json({ message: "Failed to clear facility timezone" });
    }
  });

  // Backup Management API routes
  app.get("/api/backup/status", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const status = backupManager.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get backup status" });
    }
  });

  app.post("/api/backup/create", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const result = await backupManager.createBackup();
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to create backup" });
    }
  });

  app.get("/api/backup/list", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const backups = await backupManager.listBackups();
      res.json(backups);
    } catch (error) {
      res.status(500).json({ message: "Failed to list backups" });
    }
  });

  app.post("/api/backup/restore/:filename", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const { filename } = req.params;
      const result = await backupManager.restoreBackup(filename);
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to restore backup" });
    }
  });

  // Booking Types routes
  app.get("/api/booking-types", isAuthenticated, async (req, res) => {
    try {
      const bookingTypes = await storage.getAllBookingTypes();
      res.json(bookingTypes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch booking types" });
    }
  });

  app.get("/api/booking-types/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const bookingType = await storage.getBookingType(id);
      
      if (!bookingType) {
        return res.status(404).json({ message: "Booking type not found" });
      }
      
      res.json(bookingType);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch booking type" });
    }
  });

  app.post("/api/booking-types", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Only admins can manage booking types
      if (user.role !== "admin") {
        return res.status(403).json({ 
          message: "Only administrators can manage booking types" 
        });
      }
      
      const bookingTypeData = insertBookingTypeSchema.parse(req.body);
      const newBookingType = await storage.createBookingType(bookingTypeData);
      res.status(201).json(newBookingType);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ZodError) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create booking type" });
    }
  });

  app.patch("/api/booking-types/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id);
      
      console.log(`[PATCH /api/booking-types/${id}] Request body:`, req.body);
      console.log(`[PATCH /api/booking-types/${id}] User role:`, user.role);
      
      // Only admins can manage booking types
      if (user.role !== "admin") {
        return res.status(403).json({ 
          message: "Only administrators can manage booking types" 
        });
      }
      
      const bookingType = await storage.getBookingType(id);
      if (!bookingType) {
        console.log(`[PATCH /api/booking-types/${id}] Booking type not found in database`);
        return res.status(404).json({ message: "Booking type not found" });
      }
      
      console.log(`[PATCH /api/booking-types/${id}] Current booking type:`, bookingType);
      
      // Validate the request body using the schema
      const updateData = insertBookingTypeSchema.partial().parse(req.body);
      console.log(`[PATCH /api/booking-types/${id}] Validated update data:`, updateData);
      
      const updatedBookingType = await storage.updateBookingType(id, updateData);
      
      if (!updatedBookingType) {
        console.log(`[PATCH /api/booking-types/${id}] Update failed - returned null`);
        return res.status(404).json({ message: "Booking type not found" });
      }
      
      console.log(`[PATCH /api/booking-types/${id}] Successfully updated:`, updatedBookingType);
      res.json(updatedBookingType);
    } catch (error) {
      console.error(`[PATCH /api/booking-types/${id}] Error:`, error);
      if (error instanceof ValidationError || error instanceof ZodError) {
        return res.status(400).json({ message: error.message, errors: error.errors || error });
      }
      res.status(500).json({ message: "Failed to update booking type", error: error.message });
    }
  });

  app.delete("/api/booking-types/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id);
      
      // Only admins can manage booking types
      if (user.role !== "admin") {
        return res.status(403).json({ 
          message: "Only administrators can manage booking types" 
        });
      }
      
      const bookingType = await storage.getBookingType(id);
      if (!bookingType) {
        return res.status(404).json({ message: "Booking type not found" });
      }
      
      // Check if booking type is in use
      const usage = await storage.getBookingTypeUsage(id);
      if (usage > 0) {
        return res.status(400).json({ 
          message: `Cannot delete booking type "${bookingType.name}" - it is used by ${usage} booking(s)` 
        });
      }
      
      const deleted = await storage.deleteBookingType(id);
      if (!deleted) {
        return res.status(404).json({ message: "Booking type not found" });
      }
      
      res.json({ message: "Booking type deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete booking type" });
    }
  });

  app.get("/api/booking-types/:id/usage", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const usage = await storage.getBookingTypeUsage(id);
      res.json({ usage });
    } catch (error) {
      res.status(500).json({ message: "Failed to get booking type usage" });
    }
  });

  return httpServer;
}
