import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import * as fs from 'fs';
import * as path from 'path';
import { storage } from "./storage";
import { pool } from "./db";
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
  insertBookingTypeSchema,
  insertAuditLogSchema
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
  sendMaintenanceAlert
} from "./services/emailService";

import {
  sendBookingNotificationToGroups,
  sendMaintenanceAlertToGroups,
  sendFacilityAlertToGroups,
  sendCustomNotificationToGroups,
  sendMultiDateAlertToGroups,
  sendMultiDateBookingCopyToGroups,
  sendFileAttachmentNotificationToGroups,
  sendAssetNotification
} from "./services/notificationGroupService";
import { AuditService, getAuditContext } from "./services/auditService";
import { 
  generatePasswordResetToken, 
  verifyPasswordResetToken, 
  invalidatePasswordResetToken, 
  sendPasswordResetEmail,
  generateInviteToken,
  sendInviteEmail,
  verifyInviteToken,
  invalidateInviteToken,
  getPendingInvites,
  deleteInviteToken
} from "./email";
import { migrateTemplatesApi } from "./migrate-templates-api";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Setup authentication with passport
  setupAuth(app);

  // Serve dedicated HTML for /mobile/assets so iOS Safari reads the correct
  // manifest and apple-mobile-web-app-title BEFORE any JS runs.
  // In development, pass through to Vite so it can inject the React Fast Refresh
  // preamble and HMR client (serving raw HTML skips that pipeline and breaks the page).
  app.get("/mobile/assets", async (_req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
      return next();
    }
    try {
      const htmlPath = path.resolve(import.meta.dirname, "public", "index.html");
      let html = await fs.promises.readFile(htmlPath, "utf-8");

      // Swap manifest link
      html = html.replace(
        /(<link\s[^>]*rel=["']manifest["'][^>]*href=["'])[^"']+["']/,
        '$1/manifest-assets.json"'
      );
      // Swap apple-mobile-web-app-title
      html = html.replace(
        /(<meta\s[^>]*name=["']apple-mobile-web-app-title["'][^>]*content=["'])[^"']+(["'])/,
        '$1Studio Assets$2'
      );
      // Swap application-name
      html = html.replace(
        /(<meta\s[^>]*name=["']application-name["'][^>]*content=["'])[^"']+(["'])/,
        '$1Studio Assets$2'
      );
      // Swap page title
      html = html.replace(/<title>[^<]*<\/title>/, "<title>Studio Assets</title>");

      res.status(200).set("Content-Type", "text/html").end(html);
    } catch (e) {
      res.status(500).send("Failed to load page.");
    }
  });

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

  // Endpoint to get user names for booking display - accessible to all authenticated users
  app.get("/api/users/names", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Return only id, name, and username for privacy
      const userNames = users.map(user => ({
        id: user.id,
        name: user.name || user.username,
        username: user.username
      }));
      res.json(userNames);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user names" });
    }
  });

  // Get user team memberships for team name resolution
  app.get("/api/users/team-memberships", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      // Get all users for team members who can see team bookings
      const users = await storage.getAllUsers();
      const userTeamMemberships: { [userId: number]: { id: number; name: string }[] } = {};
      
      for (const user of users) {
        const teams = await storage.getUserTeams(user.id);
        userTeamMemberships[user.id] = teams.map(team => ({
          id: team.id,
          name: team.name
        }));
      }
      
      res.json(userTeamMemberships);
    } catch (error) {
      console.error("Error fetching user team memberships:", error);
      res.status(500).json({ message: "Failed to fetch team memberships" });
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
          role: z.enum(["admin", "producer", "production", "engineer", "it", "site_manager", "viewer"])
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
      
      // Add audit log
      await AuditService.log('invite_sent', 'user', 'User Invitation', req, {
        targetEmail: email,
        targetRole: role
      });
      
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

  app.get("/api/invites/pending", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const pending = await getPendingInvites();
      res.json(pending);
    } catch (error) {
      console.error("Failed to fetch pending invites:", error);
      res.status(500).json({ message: "Failed to fetch pending invites." });
    }
  });

  app.delete("/api/invites/:id", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid invite ID" });
      await deleteInviteToken(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to revoke invite:", error);
      res.status(500).json({ message: "Failed to revoke invite." });
    }
  });

  app.post("/api/invites/:id/resend", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid invite ID" });

      // Find the existing invite
      const pending = await getPendingInvites();
      const invite = pending.find(i => i.id === id);
      if (!invite) return res.status(404).json({ message: "Invite not found or already used." });

      // Delete the old token and issue a fresh one
      await deleteInviteToken(id);
      const admin = req.user as Express.User;
      const newToken = await generateInviteToken(invite.role, invite.email, admin.id);
      const invitePath = `/invite/${newToken}`;
      const origin = req.body.origin || null;
      const emailSent = await sendInviteEmail(invite.email, invite.role, invitePath, admin.name, origin);

      if (!emailSent) {
        return res.status(500).json({ success: false, message: "Failed to resend invitation email." });
      }

      await AuditService.log('invite_sent', 'user', 'User Invitation', req, {
        targetEmail: invite.email,
        targetRole: invite.role,
        resent: true,
      });

      res.json({ success: true, message: `Invitation resent to ${invite.email}.` });
    } catch (error) {
      console.error("Failed to resend invite:", error);
      res.status(500).json({ message: "Failed to resend invite." });
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
      
      // Add audit log
      await AuditService.log('created', 'user', user.username, req, {
        userId: user.id,
        role: user.role,
        email: user.email
      });
      
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
      
      // Get original user data for audit logging
      const originalUser = await storage.getUser(id);
      if (!originalUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
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
      
      // Add audit log with changes detected
      const changes: any = {};
      if (req.body.name && req.body.name !== originalUser.name) changes.name = { from: originalUser.name, to: req.body.name };
      if (req.body.email && req.body.email !== originalUser.email) changes.email = { from: originalUser.email, to: req.body.email };
      if (req.body.role && req.body.role !== originalUser.role) changes.role = { from: originalUser.role, to: req.body.role };
      if (req.body.password) changes.password = 'changed';
      
      await AuditService.log('updated', 'user', updatedUser.username, req, {
        userId: updatedUser.id,
        changes
      });
      
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
      
      // Add audit log
      await AuditService.log('deleted', 'user', userToDelete.username, req, {
        userId: userToDelete.id,
        role: userToDelete.role,
        email: userToDelete.email,
        forceDelete: force
      });
      
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
      
      // Add audit log (no user context since they're not logged in)
      await AuditService.log('password_reset', 'user', user.username, req, {
        userId: user.id,
        method: 'token_reset'
      });
      
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
      
      // Add audit log
      await AuditService.log('created', 'studio', studio.name, req, {
        studioId: studio.id,
        description: studio.description
      });
      
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
      
      // Get current studio for audit logging
      const currentStudio = await storage.getStudio(id);
      if (!currentStudio) {
        return res.status(404).json({ message: "Studio not found" });
      }
      
      const updatedStudio = await storage.updateStudioStatus(id, status);
      if (!updatedStudio) {
        return res.status(404).json({ message: "Studio not found" });
      }
      
      // Add audit log
      await AuditService.log('status_updated', 'studio', updatedStudio.name, req, {
        studioId: id,
        oldStatus: currentStudio.status,
        newStatus: status
      });
      
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
      
      // Get current studio for audit logging
      const currentStudio = await storage.getStudio(id);
      if (!currentStudio) {
        return res.status(404).json({ message: "Studio not found" });
      }
      
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
      
      // Detect changes for audit logging
      const changes: any = {};
      if (req.body.name && req.body.name !== currentStudio.name) changes.name = { from: currentStudio.name, to: req.body.name };
      if (req.body.description !== undefined && req.body.description !== currentStudio.description) changes.description = { from: currentStudio.description, to: req.body.description };
      if (req.body.status && req.body.status !== currentStudio.status) changes.status = { from: currentStudio.status, to: req.body.status };
      
      await AuditService.log('updated', 'studio', updatedStudio.name, req, {
        studioId: id,
        changes
      });
      
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
      
      // Add audit log
      await AuditService.log('created', 'pcr_room', pcrRoom.name, req, {
        pcrRoomId: pcrRoom.id,
        description: pcrRoom.description
      });
      
      res.status(201).json(pcrRoom);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid PCR room data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create PCR room" });
    }
  });

  app.patch("/api/pcr-rooms/:id/status", isAuthenticated, hasRole(["admin", "engineer", "production", "it", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = z.object({ status: z.string() }).parse(req.body);
      
      // Get current PCR room for audit logging
      const currentPcrRoom = await storage.getPcrRoom(id);
      if (!currentPcrRoom) {
        return res.status(404).json({ message: "PCR room not found" });
      }
      
      const updatedPcrRoom = await storage.updatePcrRoomStatus(id, status);
      if (!updatedPcrRoom) {
        return res.status(404).json({ message: "PCR room not found" });
      }
      
      // Add audit log
      await AuditService.log('status_updated', 'pcr_room', updatedPcrRoom.name, req, {
        pcrRoomId: id,
        oldStatus: currentPcrRoom.status,
        newStatus: status
      });
      
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
      
      // Get current PCR room for audit logging
      const currentPcrRoom = await storage.getPcrRoom(id);
      if (!currentPcrRoom) {
        return res.status(404).json({ message: "PCR room not found" });
      }
      
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
      
      // Detect changes for audit logging
      const changes: any = {};
      if (req.body.name && req.body.name !== currentPcrRoom.name) changes.name = { from: currentPcrRoom.name, to: req.body.name };
      if (req.body.description !== undefined && req.body.description !== currentPcrRoom.description) changes.description = { from: currentPcrRoom.description, to: req.body.description };
      if (req.body.status && req.body.status !== currentPcrRoom.status) changes.status = { from: currentPcrRoom.status, to: req.body.status };
      
      await AuditService.log('updated', 'pcr_room', updatedPcrRoom.name, req, {
        pcrRoomId: id,
        changes
      });
      
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
      
      // Get PCR room for audit logging before deletion
      const pcrRoom = await storage.getPcrRoom(id);
      
      // The deletePcrRoom method already checks for active bookings
      const success = await storage.deletePcrRoom(id);
      
      if (success && pcrRoom) {
        // Add audit log
        await AuditService.log('deleted', 'pcr_room', pcrRoom.name, req, {
          pcrRoomId: id,
          description: pcrRoom.description
        });
        
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
      
      // Add audit log before sending response
      try {
        const context = {
          userId: user.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent')
        };
        
        await AuditService.log(context, 'created', 'template', template.id, template.name, {
          templateId: template.id,
          isShared: template.isShared,
          type: template.type,
          duration: template.duration
        });
      } catch (auditError) {
        console.error('Failed to log template creation audit:', auditError);
        // Continue with response even if audit logging fails
      }
      
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
      // Only the creator, admin, or site manager can update a template
      if (template.createdBy !== user.id && user.role !== "admin" && user.role !== "site_manager") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Validate the update data
      const updateData = insertTemplateSchema.partial().parse(req.body);
      const updatedTemplate = await storage.updateTemplate(id, updateData);
      
      if (updatedTemplate) {
        // Detect changes for audit logging
        const changes: any = {};
        if (req.body.name && req.body.name !== template.name) changes.name = { from: template.name, to: req.body.name };
        if (req.body.isShared !== undefined && req.body.isShared !== template.isShared) changes.isShared = { from: template.isShared, to: req.body.isShared };
        if (req.body.data && JSON.stringify(req.body.data) !== JSON.stringify(template.data)) changes.data = 'modified';
        
        await AuditService.log('updated', 'template', updatedTemplate.name, req, {
          templateId: id,
          changes
        });
        
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
      // Only the creator, admin, or site manager can delete a template
      if (template.createdBy !== user.id && user.role !== "admin" && user.role !== "site_manager") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const success = await storage.deleteTemplate(id, force);
      if (success) {
        const message = force 
          ? "Template deleted successfully (removed from associated bookings)"
          : "Template deleted successfully";
        
        // Add audit log before sending response
        try {
          const context = {
            userId: user.id,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent')
          };
          
          await AuditService.log(context, 'deleted', 'template', template.id, template.name, {
            templateId: id,
            isShared: template.isShared,
            forceDelete: force
          });
        } catch (auditError) {
          console.error('Failed to log template deletion audit:', auditError);
          // Continue with response even if audit logging fails
        }
        
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
  // Get linked bookings by linkedGroupId
  app.get("/api/bookings/linked/:linkedGroupId", isAuthenticated, async (req, res) => {
    try {
      const { linkedGroupId } = req.params;
      const linkedBookings = await storage.getLinkedBookings(linkedGroupId);
      res.json(linkedBookings);
    } catch (error) {
      console.error("Error fetching linked bookings:", error);
      res.status(500).json({ message: "Failed to fetch linked bookings" });
    }
  });

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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const fromToday = req.query.fromToday === 'true';
      
      const result = await storage.getBookingsByUserPaginated(user.id, { page, limit, fromToday });
      res.json(result);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
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
      
      // Log the creation to audit logs
      try {
        await AuditService.log(
          getAuditContext(req),
          "CREATE",
          "booking",
          booking.id,
          booking.title,
          {
            bookingType: booking.type,
            studioId: booking.studioId,
            studioIds: studioIds,
            startTime: booking.start,
            endTime: booking.end,
            pcrRoomId: booking.pcrRoomId,
            templateId: booking.templateId,
            linkedGroupId: booking.linkedGroupId,
            notifyList: booking.notifyList
          }
        );
      } catch (auditError) {
        console.error("Failed to log booking creation:", auditError);
      }
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
              
              try {
                console.log(`[BookingCreation] Sending notification to ${notifyGroupIds.length} groups (+ site managers):`, notifyGroupIds);
                const result = await sendBookingNotificationToGroups(
                  booking,
                  studio,
                  notifyGroupIds,
                  'created',
                  true  // Always include site managers via notification group system
                );
                console.log(`[BookingCreation] Notification result:`, result);
              } catch (notifyError) {
                console.error("Error sending notification to groups:", notifyError);
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
              // Validate that the user exists before creating notification
              const user = await storage.getUser(userId);
              if (user) {
                await storage.createNotification({
                  userId,
                  title: "New Booking Notification",
                  message: `A new booking "${booking.title}" has been created that requires your attention.`,
                  type: "booking_created",
                  bookingId: booking.id
                });
                console.log(`[BookingCreation] Notification created for user ${userId} (${user.username})`);
              } else {
                console.warn(`[BookingCreation] Skipping notification - User ${userId} not found in database`);
              }
            } catch (notifyError) {
              console.error(`Error creating notification for user ${userId} in notify list:`, notifyError);
              // Continue with the next notification
            }
          }
        }
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
      const { bookingId, dates, titleSuffix, createLinked } = req.body;
      
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
      const newBookings = await storage.copyBookingToMultipleDates(bookingId, datesToCopy, createLinked);
      
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
      
      // Send ONE consolidated email listing all copied dates (only if copies succeeded)
      if (successCount > 0) {
        try {
          const copiedDates = newBookings
            .map(b => ({ start: b.start, end: b.end }))
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
          
          // Get the studio name for the email
          const bookingStudios = await storage.getBookingStudios(bookingId);
          let studioName = 'Multiple Studios';
          if (bookingStudios && bookingStudios.length > 0) {
            const studioNames: string[] = [];
            for (const bs of bookingStudios) {
              const studio = await storage.getStudio(bs.studioId);
              if (studio) studioNames.push(studio.name);
            }
            studioName = studioNames.length > 0 ? studioNames.join(', ') : 'Multiple Studios';
          }
          
          // Determine notification group IDs from the booking's notifyList
          let notifyGroupIds: number[] = [];
          if (originalBooking.notifyList && Array.isArray(originalBooking.notifyList) && originalBooking.notifyList.length > 0) {
            notifyGroupIds = originalBooking.notifyList
              .map((id: any) => typeof id === 'string' ? parseInt(id) : id)
              .filter((id: any) => !isNaN(id) && id > 0);
          }
          
          // Send consolidated email (site managers are always included via alwaysNotifySiteManagers=true)
          await sendMultiDateBookingCopyToGroups(
            originalBooking,
            studioName,
            copiedDates,
            notifyGroupIds,
            true
          );
          console.log(`[BookingCopy] Sent ONE consolidated email covering ${copiedDates.length} copied date(s)`);
        } catch (emailError) {
          console.error("[BookingCopy] Error sending consolidated copy email:", emailError);
        }
      }
      
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
        // For regular production bookings, check multiple permission levels
        const isOwner = booking.userId === user.id;
        const isAdmin = user.role === "admin";
        const isAuthorizedRole = ["producer", "engineer", "site_manager"].includes(user.role);
        
        // Check if user is a team member with the booking creator
        let isTeamMember = false;
        if (!isOwner && !isAdmin && !isAuthorizedRole) {
          const bookingCreatorTeams = await storage.getUserTeams(booking.userId);
          const currentUserTeams = await storage.getUserTeams(user.id);
          
          // Check if they share any team
          isTeamMember = bookingCreatorTeams.some(creatorTeam => 
            currentUserTeams.some(userTeam => userTeam.id === creatorTeam.id)
          );
        }
        
        // Allow editing if: owner, admin, authorized role, or team member
        if (!isOwner && !isAdmin && !isAuthorizedRole && !isTeamMember) {
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
        
      // Check if this booking is part of a linked group
      let linkedBookings: Booking[] = [];
      if (booking.linkedGroupId) {
        try {
          linkedBookings = await storage.getLinkedBookings(booking.linkedGroupId);
          console.log(`Found ${linkedBookings.length} linked bookings for group ${booking.linkedGroupId}`);
        } catch (error) {
          console.error("Error fetching linked bookings:", error);
          // Continue with single booking update if linked fetch fails
        }
      }

      // Use the updated version of updateBooking that handles studio links
      const updatedBooking = await storage.updateBooking(id, updateData, parsedStudioIds);

      // Log the update to audit logs
      try {
        await AuditService.log(
          getAuditContext(req),
          "UPDATE",
          "booking",
          id,
          updatedBooking.title,
          {
            originalBooking: {
              title: booking.title,
              type: booking.type,
              studioId: booking.studioId,
              startTime: booking.start,
              endTime: booking.end,
              status: booking.status
            },
            updatedFields: updateData,
            studioIds: parsedStudioIds,
            linkedGroupId: booking.linkedGroupId,
            hasLinked: booking.linkedGroupId && linkedBookings.length > 1
          }
        );
      } catch (auditError) {
        console.error("Failed to log booking update:", auditError);
      }

      // If this booking is part of a linked group, update all other linked bookings
      if (booking.linkedGroupId && linkedBookings.length > 1) {
        try {
          console.log(`Updating ${linkedBookings.length - 1} linked bookings...`);
          
          const updatePromises = linkedBookings
            .filter(linkedBooking => linkedBooking.id !== id) // Don't update the original booking again
            .map(async (linkedBooking) => {
              // Calculate the time difference between the original booking and this linked booking
              const originalStart = new Date(booking.start);
              const originalEnd = new Date(booking.end);
              const linkedStart = new Date(linkedBooking.start);
              const linkedEnd = new Date(linkedBooking.end);
              
              // Prepare update data for linked booking
              const linkedUpdateData = { ...updateData };
              
              // If updating times, adjust them relative to each linked booking's date
              if (updateData.start || updateData.end) {
                const newStart = updateData.start ? new Date(updateData.start) : originalStart;
                const newEnd = updateData.end ? new Date(updateData.end) : originalEnd;
                
                // Calculate the date offset
                const dateOffset = linkedStart.getDate() - originalStart.getDate();
                const monthOffset = linkedStart.getMonth() - originalStart.getMonth();
                const yearOffset = linkedStart.getFullYear() - originalStart.getFullYear();
                
                // Apply the same time but on the linked booking's date
                const adjustedStart = new Date(newStart);
                adjustedStart.setDate(newStart.getDate() + dateOffset);
                adjustedStart.setMonth(newStart.getMonth() + monthOffset);
                adjustedStart.setFullYear(newStart.getFullYear() + yearOffset);
                
                const adjustedEnd = new Date(newEnd);
                adjustedEnd.setDate(newEnd.getDate() + dateOffset);
                adjustedEnd.setMonth(newEnd.getMonth() + monthOffset);
                adjustedEnd.setFullYear(newEnd.getFullYear() + yearOffset);
                
                linkedUpdateData.start = adjustedStart;
                linkedUpdateData.end = adjustedEnd;
              }
              
              return await storage.updateBooking(linkedBooking.id, linkedUpdateData, parsedStudioIds);
            });
            
          await Promise.all(updatePromises);
          console.log(`Successfully updated all linked bookings for group ${booking.linkedGroupId}`);
        } catch (error) {
          console.error("Error updating linked bookings:", error);
          // Continue with the response even if linked updates fail
        }
      }
      
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
          // Validate that the user exists before creating notification
          const user = await storage.getUser(booking.userId);
          if (user) {
            console.log(`Creating notification for user ID: ${booking.userId}`);
            await storage.createNotification({
              userId: booking.userId,
              title: "Booking Updated",
              message: `Your booking for "${booking.title}" has been updated.`,
              type: "booking_updated",
              bookingId: booking.id
            });
          } else {
            console.warn(`[BookingUpdate] Skipping notification - User ${booking.userId} not found in database`);
          }
          
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
                
                try {
                  const groupIds = (notifyList && Array.isArray(notifyList)) ? notifyList as number[] : [];
                  console.log(`[BookingUpdate] Sending notification to ${groupIds.length} groups (+ site managers):`, groupIds);
                  await sendBookingNotificationToGroups(
                    updatedBooking,
                    studio,
                    groupIds,
                    'updated',
                    true  // Always include site managers via notification group system
                  );
                } catch (notifyError) {
                  console.error("Error sending notification to groups:", notifyError);
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
      
      res.json(updatedBooking);
    } catch (error) {
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  app.delete("/api/bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { deleteLinked } = req.query; // Query parameter to delete all linked bookings
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
      
      // Check if this is a linked booking and handle accordingly
      let success = false;
      let deletedCount = 0;
      
      if (deleteLinked === 'true' && booking.linkedGroupId) {
        // Delete all bookings with the same linkedGroupId
        const linkedBookings = await storage.getLinkedBookings(booking.linkedGroupId);
        console.log(`Deleting ${linkedBookings.length} linked bookings for group ${booking.linkedGroupId}`);
        
        for (const linkedBooking of linkedBookings) {
          const deleteResult = await storage.deleteBooking(linkedBooking.id);
          if (deleteResult) deletedCount++;
        }
        success = deletedCount > 0;
      } else {
        // Delete only this specific booking
        success = await storage.deleteBooking(id);
        deletedCount = success ? 1 : 0;
      }
      
      if (success) {
        // Log the deletion to audit logs
        try {
          await AuditService.log(
            getAuditContext(req),
            "DELETE",
            "booking",
            id,
            booking.title,
            {
              deletedBookingIds: deleteLinked === 'true' && booking.linkedGroupId ? 
                (await storage.getLinkedBookings(booking.linkedGroupId)).map(b => b.id) : [id],
              bookingTitle: booking.title,
              bookingType: booking.type,
              studioId: booking.studioId,
              startTime: booking.start,
              endTime: booking.end,
              linkedGroupId: booking.linkedGroupId,
              deleteLinked: deleteLinked === 'true',
              deletedCount
            }
          );
        } catch (auditError) {
          console.error("Failed to log booking deletion:", auditError);
        }

        // Create notification for the booking owner if not the deleter
        // and if there is a valid userId (facility-wide alerts might not have one)
        if (booking.userId !== null && booking.userId !== undefined && booking.userId !== user.id) {
          let deletedByRole = "administrator";
          if (["engineer", "it"].includes(user.role)) {
            deletedByRole = user.role === "engineer" ? "an engineer" : "IT support";
          }
          
          try {
            // Validate that the user exists before creating notification
            const bookingUser = await storage.getUser(booking.userId);
            if (bookingUser) {
              await storage.createNotification({
                userId: booking.userId,
                title: booking.studioId === null ? "Alert Deleted" : "Booking Deleted",
                message: booking.studioId === null
                  ? `Your facility alert "${booking.title}" has been deleted by ${deletedByRole}.`
                  : `Your booking for "${booking.title}" has been deleted by ${deletedByRole}.`,
                type: "booking_deleted",
                bookingId: booking.id
              });
            } else {
              console.warn(`[BookingDeletion] Skipping notification - User ${booking.userId} not found in database`);
            }
            
            // Send email notification about the deletion if this is a standard booking with a studio
            if (booking.studioId) {
              try {
                // Get the user and studio info
                const bookingUser = await storage.getUser(booking.userId);
                const studio = await storage.getStudio(booking.studioId);
                
                if (bookingUser && studio) {
                  console.log(`Sending booking cancellation email to user ${bookingUser.email} for booking "${booking.title}"`);
                  await sendBookingCancellation(booking, studio, bookingUser);
                  
                  try {
                    const groupIds = (booking.notifyList && Array.isArray(booking.notifyList)) ? booking.notifyList as number[] : [];
                    await sendBookingNotificationToGroups(
                      booking,
                      studio,
                      groupIds,
                      'cancelled',
                      true  // Always include site managers
                    );
                  } catch (notifyError) {
                    console.error("Error sending cancellation notification to groups:", notifyError);
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
        
        const message = deletedCount > 1 
          ? `Successfully deleted ${deletedCount} linked bookings` 
          : "Booking deleted successfully";
        return res.json({ message });
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
      
      // Add audit log
      await AuditService.log('created', 'alert', alert.title, req, {
        alertId: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        start: alert.start,
        end: alert.end
      });
      
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
  
  // POST /api/alerts/bulk - Create multiple alerts (one per date) with a single consolidated email
  app.post("/api/alerts/bulk", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!["admin", "engineer", "it", "site_manager"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only admin, engineers, IT staff, and site managers can create alerts" 
        });
      }
      
      const { alerts: alertItems } = req.body;
      
      if (!Array.isArray(alertItems) || alertItems.length === 0) {
        return res.status(400).json({ message: "No alert data provided" });
      }
      
      console.log(`[BULK ALERT] Creating ${alertItems.length} alert(s) with single notification`);
      
      const parsedAlerts: any[] = [];
      for (const item of alertItems) {
        const alertData = insertAlertSchema.parse({
          ...item,
          createdBy: user.id
        });
        parsedAlerts.push(alertData);
      }
      
      const createdAlerts: any[] = [];
      const dateRanges: Array<{ start: Date; end: Date }> = [];
      
      // Step 1: Create all alerts sequentially (no audit logging yet to avoid connection corruption)
      for (let i = 0; i < parsedAlerts.length; i++) {
        try {
          const alert = await storage.createAlert(parsedAlerts[i]);
          createdAlerts.push(alert);
          dateRanges.push({ start: new Date(alert.start), end: new Date(alert.end) });
          console.log(`[BULK ALERT] Created alert ID ${alert.id} (${i + 1}/${parsedAlerts.length})`);
        } catch (itemError: any) {
          console.error(`[BULK ALERT] Error creating alert ${i + 1}/${parsedAlerts.length}:`, itemError);
        }
      }
      
      if (createdAlerts.length === 0) {
        return res.status(500).json({ message: "Failed to create any alerts" });
      }
      
      // Step 2: Log audit entries after all alerts are created (fire-and-forget to avoid connection issues)
      for (const alert of createdAlerts) {
        AuditService.log('created', 'alert', alert.title, req, {
          alertId: alert.id,
          alertType: alert.alertType,
          severity: alert.severity,
          start: alert.start,
          end: alert.end,
          bulkCreation: true,
          totalInBatch: parsedAlerts.length
        }).catch(err => console.error(`[BULK ALERT] Audit log error for alert ${alert.id}:`, err.message));
      }
      
      // Step 3: Send ONE consolidated email notification for all dates
      try {
        const allNotificationGroups = await storage.getAllNotificationGroups();
        const allGroupIds = allNotificationGroups.map(group => group.id);
        
        if (allGroupIds.length > 0) {
          const firstAlert = createdAlerts[0];
          await sendMultiDateAlertToGroups(
            {
              title: firstAlert.title,
              description: firstAlert.description || '',
              alertType: firstAlert.alertType,
              severity: firstAlert.severity || 'medium'
            },
            dateRanges,
            allGroupIds,
            true
          );
          console.log(`[BULK ALERT] Sent ONE consolidated email covering ${dateRanges.length} date(s)`);
        }
      } catch (emailError) {
        console.error("[BULK ALERT] Error sending consolidated email:", emailError);
      }
      
      res.status(201).json({ 
        alerts: createdAlerts, 
        count: createdAlerts.length,
        message: `Created ${createdAlerts.length} alert(s) with a single notification`
      });
    } catch (error: any) {
      console.error("Error creating bulk alerts:", error);
      res.status(500).json({ message: "Failed to create alerts" });
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
      
      // Detect changes for audit logging
      const changes: any = {};
      if (req.body.title && req.body.title !== existingAlert.title) changes.title = { from: existingAlert.title, to: req.body.title };
      if (req.body.description && req.body.description !== existingAlert.description) changes.description = 'modified';
      if (req.body.severity && req.body.severity !== existingAlert.severity) changes.severity = { from: existingAlert.severity, to: req.body.severity };
      if (req.body.status && req.body.status !== existingAlert.status) changes.status = { from: existingAlert.status, to: req.body.status };
      
      await AuditService.log('updated', 'alert', updatedAlert.title, req, {
        alertId: id,
        changes
      });
      
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
        
        // Add audit log
        await AuditService.log('deleted', 'alert', existingAlert.title, req, {
          alertId: id,
          alertType: existingAlert.alertType,
          severity: existingAlert.severity
        });
        
        res.json({ message: "Alert deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete alert" });
      }
    } catch (error) {
      console.error("Error deleting alert:", error);
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  // Admin booking ownership management routes
  app.get("/api/admin/booking-ownership/stats", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const stats = await storage.getBookingOwnershipStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting booking ownership stats:", error);
      res.status(500).json({ error: "Failed to get ownership statistics" });
    }
  });

  app.get("/api/admin/booking-ownership/admin-bookings", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const bookings = await storage.getAdminOwnedBookings();
      res.json(bookings);
    } catch (error) {
      console.error("Error getting admin bookings:", error);
      res.status(500).json({ error: "Failed to get admin bookings" });
    }
  });

  app.post("/api/admin/booking-ownership/update", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { booking_ids, new_user_id } = req.body;
      
      if (!Array.isArray(booking_ids) || !new_user_id) {
        return res.status(400).json({ error: "booking_ids array and new_user_id are required" });
      }

      const result = await storage.updateBookingOwnership(booking_ids, new_user_id, req.user!.id);
      
      // Log the ownership change with proper entityType
      await AuditService.log('updated', 'booking', null, req, {
        action: 'bulk_ownership_transfer',
        booking_ids,
        new_user_id,
        updated_count: result.updated_count,
        summary: `Updated ownership of ${result.updated_count} bookings to user ${new_user_id}`
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error updating booking ownership:", error);
      res.status(500).json({ error: "Failed to update booking ownership" });
    }
  });

  // Database Health Monitoring Routes
  app.get("/api/admin/database-health/metrics", hasRole(['admin']), async (req, res) => {
    try {
      const metrics = await storage.getDatabaseHealthMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching database health metrics:", error);
      res.status(500).json({ error: "Failed to fetch database health metrics" });
    }
  });

  app.get("/api/admin/database-health/issues", hasRole(['admin']), async (req, res) => {
    try {
      const issues = await storage.getDatabaseHealthIssues();
      res.json(issues);
    } catch (error) {
      console.error("Error fetching database health issues:", error);
      res.status(500).json({ error: "Failed to fetch database health issues" });
    }
  });

  app.post("/api/admin/database-health/fix/:issueId", hasRole(['admin']), async (req, res) => {
    try {
      const issueId = req.params.issueId;
      const result = await storage.autoFixDatabaseIssue(issueId);
      
      // Log the fix attempt
      await AuditService.log('fixed', 'database_issue', issueId, req, {
        issue_id: issueId,
        fix_result: result
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error auto-fixing database issue:", error);
      res.status(500).json({ error: "Failed to auto-fix database issue" });
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
      
      // Add audit log
      await AuditService.log('created', 'notification_group', newGroup.name, req, {
        groupId: newGroup.id,
        groupType: newGroup.groupType,
        email: newGroup.email,
        enabled: newGroup.enabled
      });
      
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
      
      // Detect changes for audit logging
      const changes: any = {};
      if (req.body.name && req.body.name !== group.name) changes.name = { from: group.name, to: req.body.name };
      if (req.body.email && req.body.email !== group.email) changes.email = { from: group.email, to: req.body.email };
      if (req.body.enabled !== undefined && req.body.enabled !== group.enabled) changes.enabled = { from: group.enabled, to: req.body.enabled };
      if (req.body.groupType && req.body.groupType !== group.groupType) changes.groupType = { from: group.groupType, to: req.body.groupType };
      
      await AuditService.log('updated', 'notification_group', updatedGroup.name, req, {
        groupId: id,
        changes
      });
      
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
        // Add audit log
        await AuditService.log('deleted', 'notification_group', group.name, req, {
          groupId: id,
          groupType: group.groupType,
          email: group.email
        });
        
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
      
      // Get current site name for audit logging
      const currentSiteName = await storage.getSiteName();
      
      const setting = await storage.setSiteName(siteName);
      
      // Add audit log
      await AuditService.log('updated', 'system_setting', 'Site Name', req, {
        settingKey: 'siteName',
        oldValue: currentSiteName,
        newValue: siteName
      });
      
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
      
      // Get current timezone for audit logging
      const currentTimezoneSetting = await storage.getSystemSetting('facilityTimezone');
      const currentTimezone = currentTimezoneSetting?.value || process.env.VITE_FACILITY_TIMEZONE || process.env.FACILITY_TIMEZONE;
      
      const setting = await storage.upsertSystemSetting({ 
        key: 'facilityTimezone', 
        value: timezone 
      });
      
      // Add audit log
      await AuditService.log('updated', 'system_setting', 'Facility Timezone', req, {
        settingKey: 'facilityTimezone',
        oldValue: currentTimezone,
        newValue: timezone
      });
      
      res.json({ timezone: setting.value, message: "Facility timezone updated successfully" });
    } catch (error) {
      console.error("Error setting facility timezone:", error);
      res.status(500).json({ message: "Failed to update facility timezone" });
    }
  });

  app.delete("/api/system/timezone", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      // Get current timezone for audit logging
      const currentTimezoneSetting = await storage.getSystemSetting('facilityTimezone');
      const currentTimezone = currentTimezoneSetting?.value;
      
      const deleted = await storage.deleteSystemSetting('facilityTimezone');
      
      if (deleted && currentTimezone) {
        // Add audit log only if there was actually a timezone to delete
        await AuditService.log('deleted', 'system_setting', 'Facility Timezone', req, {
          settingKey: 'facilityTimezone',
          deletedValue: currentTimezone
        });
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

  // AUDIT LOG ROUTES - Only accessible to admin and site_manager roles
  
  // GET /api/audit-logs - Get audit logs with filtering and pagination
  app.get("/api/audit-logs", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const {
        userId,
        action,
        entityType,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = req.query;

      const filters: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      if (userId) filters.userId = parseInt(userId as string);
      if (action) filters.action = action as string;
      if (entityType) filters.entityType = entityType as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const auditLogs = await storage.getAuditLogs(filters);
      const totalCount = await storage.getAuditLogCount(filters);

      res.json({
        logs: auditLogs,
        pagination: {
          total: totalCount,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: filters.offset + filters.limit < totalCount
        }
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // GET /api/audit-logs/stats - Get audit log statistics
  app.get("/api/audit-logs/stats", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const {
        startDate,
        endDate
      } = req.query;

      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      // Get counts by action type
      const actions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED'];
      const actionStats = await Promise.all(
        actions.map(async (action) => ({
          action,
          count: await storage.getAuditLogCount({ ...filters, action })
        }))
      );

      // Get counts by entity type
      const entities = ['booking', 'user', 'alert', 'template', 'authentication', 'system_setting'];
      const entityStats = await Promise.all(
        entities.map(async (entityType) => ({
          entityType,
          count: await storage.getAuditLogCount({ ...filters, entityType })
        }))
      );

      // Get total count
      const totalCount = await storage.getAuditLogCount(filters);

      res.json({
        total: totalCount,
        byAction: actionStats.filter(stat => stat.count > 0),
        byEntity: entityStats.filter(stat => stat.count > 0)
      });
    } catch (error) {
      console.error("Error fetching audit log stats:", error);
      res.status(500).json({ message: "Failed to fetch audit log statistics" });
    }
  });

  // POST /api/audit-logs/cleanup - Cleanup old audit logs (admin only)
  app.post("/api/audit-logs/cleanup", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const { daysToKeep = 90 } = req.body;
      
      if (typeof daysToKeep !== 'number' || daysToKeep < 1) {
        return res.status(400).json({ message: "Days to keep must be a positive number" });
      }

      const deletedCount = await storage.cleanupOldAuditLogs(daysToKeep);
      
      // Log the cleanup action
      const auditContext = getAuditContext(req);
      await AuditService.log(
        auditContext,
        "CLEANUP",
        "audit_logs",
        undefined,
        "Audit Log Cleanup",
        { deletedCount, daysToKeep }
      );

      res.json({
        message: `Successfully cleaned up ${deletedCount} old audit log entries`,
        deletedCount,
        daysToKeep
      });
    } catch (error) {
      console.error("Error cleaning up audit logs:", error);
      res.status(500).json({ message: "Failed to cleanup audit logs" });
    }
  });

  // Team Management Routes
  
  // GET /api/teams - Get all teams (admin/site_manager only)
  app.get("/api/teams", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const teams = await storage.getAllTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // GET /api/teams/my - Get teams the current user belongs to
  app.get("/api/teams/my", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const teams = await storage.getUserTeams(user.id);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching user teams:", error);
      res.status(500).json({ message: "Failed to fetch user teams" });
    }
  });

  // POST /api/teams - Create a new team
  app.post("/api/teams", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const user = req.user as any;
      const teamData = { ...req.body, createdBy: user.id };
      
      const team = await storage.createTeam(teamData);
      
      // Log the creation
      await AuditService.log(
        getAuditContext(req),
        "CREATE",
        "team",
        team.id,
        team.name,
        { teamData }
      );
      
      res.status(201).json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  // PUT /api/teams/:id - Update a team
  app.put("/api/teams/:id", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedTeam = await storage.updateTeam(id, req.body);
      
      if (!updatedTeam) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      // Log the update
      await AuditService.log(
        getAuditContext(req),
        "UPDATE",
        "team",
        id,
        updatedTeam.name,
        { updatedFields: req.body }
      );
      
      res.json(updatedTeam);
    } catch (error) {
      console.error("Error updating team:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  // DELETE /api/teams/:id - Delete a team
  app.delete("/api/teams/:id", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const team = await storage.getTeam(id);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const success = await storage.deleteTeam(id);
      
      if (success) {
        // Log the deletion
        await AuditService.log(
          getAuditContext(req),
          "DELETE",
          "team",
          id,
          team.name,
          {}
        );
        
        res.json({ message: "Team deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete team" });
      }
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Team Membership Routes
  
  // GET /api/teams/:id/members - Get team members
  app.get("/api/teams/:id/members", isAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const user = req.user as any;
      
      // Check if user is team member or has admin/site_manager role
      const isMember = await storage.isUserTeamMember(teamId, user.id);
      const isAdmin = user.role === 'admin' || user.role === 'site_manager';
      
      if (!isMember && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const members = await storage.getTeamMembers(teamId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  // POST /api/teams/:id/members - Add team member
  app.post("/api/teams/:id/members", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const { userId, role = 'member' } = req.body;
      
      const member = await storage.addTeamMember({ teamId, userId, role });
      
      // Log the addition
      const user = await storage.getUser(userId);
      await AuditService.log(
        getAuditContext(req),
        "CREATE",
        "team_member",
        member.id,
        `${user?.name || userId} added to team`,
        { teamId, userId, role }
      );
      
      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding team member:", error);
      res.status(500).json({ message: "Failed to add team member" });
    }
  });

  // PUT /api/teams/:teamId/members/:userId - Update team member role
  app.put("/api/teams/:teamId/members/:userId", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const userId = parseInt(req.params.userId);
      const { role } = req.body;
      
      const updatedMember = await storage.updateTeamMember(teamId, userId, { role });
      
      if (!updatedMember) {
        return res.status(404).json({ message: "Team member not found" });
      }
      
      // Log the update
      const user = await storage.getUser(userId);
      await AuditService.log(
        getAuditContext(req),
        "UPDATE",
        "team_member",
        updatedMember.id,
        `${user?.name || userId} role updated`,
        { teamId, userId, newRole: role }
      );
      
      res.json(updatedMember);
    } catch (error) {
      console.error("Error updating team member:", error);
      res.status(500).json({ message: "Failed to update team member" });
    }
  });

  // DELETE /api/teams/:teamId/members/:userId - Remove team member
  app.delete("/api/teams/:teamId/members/:userId", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const userId = parseInt(req.params.userId);
      
      const success = await storage.removeTeamMember(teamId, userId);
      
      if (success) {
        // Log the removal
        const user = await storage.getUser(userId);
        await AuditService.log(
          getAuditContext(req),
          "DELETE",
          "team_member",
          undefined,
          `${user?.name || userId} removed from team`,
          { teamId, userId }
        );
        
        res.json({ message: "Team member removed successfully" });
      } else {
        res.status(404).json({ message: "Team member not found" });
      }
    } catch (error) {
      console.error("Error removing team member:", error);
      res.status(500).json({ message: "Failed to remove team member" });
    }
  });

  // GET /api/bookings/team - Get team bookings for current user
  app.get("/api/bookings/team", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const fromToday = req.query.fromToday === 'true';
      
      const result = await storage.getTeamBookings(user.id, { page, limit, fromToday });
      res.json(result);
    } catch (error) {
      console.error("Error fetching team bookings:", error);
      res.status(500).json({ message: "Failed to fetch team bookings" });
    }
  });

  // ─── Asset Management ────────────────────────────────────────────────────────
  // Ensure asset_photos table exists (idempotent — safe to run every startup)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asset_photos (
        id         SERIAL PRIMARY KEY,
        asset_id   INTEGER NOT NULL,
        photo_data TEXT    NOT NULL,
        uploaded_by INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
  } catch (e) {
    console.error("asset_photos table init error:", e);
  }

  // Ensure booking_assets planning table exists (idempotent)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_assets (
        id         SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL,
        asset_id   INTEGER NOT NULL,
        added_by   INTEGER NOT NULL,
        added_at   TIMESTAMPTZ DEFAULT now(),
        UNIQUE (booking_id, asset_id)
      )
    `);
  } catch (e) {
    console.error("booking_assets table init error:", e);
  }

  app.get("/api/assets", isAuthenticated, async (req, res) => {
    try {
      const allAssets = await storage.getAllAssets();
      res.json(allAssets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.get("/api/assets/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const asset = await storage.getAsset(id);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      res.json(asset);
    } catch (error) {
      console.error("Error fetching asset:", error);
      res.status(500).json({ message: "Failed to fetch asset" });
    }
  });

  app.post("/api/assets", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const data = { ...req.body, createdBy: user.id };
      const asset = await storage.createAsset(data);
      res.status(201).json(asset);
      // Audit + notify (fire-and-forget)
      const ctx = getAuditContext(req);
      const actor = await storage.getUser(user.id);
      const actorName = actor?.fullName || actor?.username || `User #${user.id}`;
      AuditService.log(ctx, 'CREATE', 'asset', asset.id, asset.name, {
        category: asset.category, status: asset.status, location: asset.location,
      }).catch(console.error);
      sendAssetNotification(asset.name, 'created', actorName).catch(console.error);
    } catch (error) {
      console.error("Error creating asset:", error);
      res.status(500).json({ message: "Failed to create asset" });
    }
  });

  app.put("/api/assets/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const prevAsset = await storage.getAsset(id);
      const asset = await storage.updateAsset(id, req.body);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      res.json(asset);
      // Audit + notify (fire-and-forget)
      const userId = (req.user as any).id;
      const ctx = getAuditContext(req);
      const user = await storage.getUser(userId);
      const userName = user?.fullName || user?.username || `User #${userId}`;
      const isDecommission = asset.status === 'retired' && !!(asset as any).decommissionReason
        && prevAsset?.status !== 'retired';
      const tagChanged = prevAsset && prevAsset.assetTag !== asset.assetTag;
      if (isDecommission) {
        AuditService.log(ctx, 'DECOMMISSION', 'asset', asset.id, asset.name, {
          reason: (asset as any).decommissionReason,
          previousStatus: prevAsset?.status,
        }).catch(console.error);
        sendAssetNotification(asset.name, 'decommissioned', userName, {
          Reason: (asset as any).decommissionReason,
        }).catch(console.error);
      } else {
        if (tagChanged) {
          AuditService.log(ctx, 'TAG_CHANGED', 'asset', asset.id, asset.name, {
            previousTag: prevAsset.assetTag ?? '(none)',
            newTag: asset.assetTag ?? '(none)',
          }).catch(console.error);
          sendAssetNotification(asset.name, 'tag_changed', userName, {
            'Previous Tag': prevAsset.assetTag ?? '(none)',
            'New Tag': asset.assetTag ?? '(none)',
          }).catch(console.error);
        } else {
          AuditService.log(ctx, 'UPDATE', 'asset', asset.id, asset.name, {
            changes: prevAsset ? { from: { status: prevAsset.status }, to: { status: asset.status } } : {},
          }).catch(console.error);
          sendAssetNotification(asset.name, 'modified', userName).catch(console.error);
        }
      }
    } catch (error) {
      console.error("Error updating asset:", error);
      res.status(500).json({ message: "Failed to update asset" });
    }
  });

  app.patch("/api/assets/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const prevAsset = await storage.getAsset(id);
      const asset = await storage.updateAsset(id, req.body);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      res.json(asset);
      // Audit + notify (fire-and-forget)
      const userId = (req.user as any).id;
      const ctx = getAuditContext(req);
      const user = await storage.getUser(userId);
      const userName = user?.fullName || user?.username || `User #${userId}`;
      const isDecommission = asset.status === 'retired' && !!(asset as any).decommissionReason
        && prevAsset?.status !== 'retired';
      const tagChanged = prevAsset && prevAsset.assetTag !== asset.assetTag;
      if (isDecommission) {
        AuditService.log(ctx, 'DECOMMISSION', 'asset', asset.id, asset.name, {
          reason: (asset as any).decommissionReason,
          previousStatus: prevAsset?.status,
        }).catch(console.error);
        sendAssetNotification(asset.name, 'decommissioned', userName, {
          Reason: (asset as any).decommissionReason,
        }).catch(console.error);
      } else {
        if (tagChanged) {
          AuditService.log(ctx, 'TAG_CHANGED', 'asset', asset.id, asset.name, {
            previousTag: prevAsset.assetTag ?? '(none)',
            newTag: asset.assetTag ?? '(none)',
          }).catch(console.error);
          sendAssetNotification(asset.name, 'tag_changed', userName, {
            'Previous Tag': prevAsset.assetTag ?? '(none)',
            'New Tag': asset.assetTag ?? '(none)',
          }).catch(console.error);
        } else {
          AuditService.log(ctx, 'UPDATE', 'asset', asset.id, asset.name, {
            changes: prevAsset ? { from: { status: prevAsset.status }, to: { status: asset.status } } : {},
          }).catch(console.error);
          sendAssetNotification(asset.name, 'modified', userName).catch(console.error);
        }
      }
    } catch (error) {
      console.error("Error updating asset:", error);
      res.status(500).json({ message: "Failed to update asset" });
    }
  });

  app.delete("/api/assets/:id", isAuthenticated, hasRole(["admin", "site_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assetToDelete = await storage.getAsset(id);
      const deleted = await storage.deleteAsset(id);
      if (!deleted) return res.status(404).json({ message: "Asset not found" });
      res.json({ message: "Asset deleted successfully" });
      // Audit + notify (fire-and-forget)
      if (assetToDelete) {
        const userId = (req.user as any).id;
        const ctx = getAuditContext(req);
        const user = await storage.getUser(userId);
        const userName = user?.fullName || user?.username || `User #${userId}`;
        AuditService.log(ctx, 'DELETE', 'asset', assetToDelete.id, assetToDelete.name, {
          category: assetToDelete.category, status: assetToDelete.status,
        }).catch(console.error);
        sendAssetNotification(assetToDelete.name, 'deleted', userName).catch(console.error);
      }
    } catch (error) {
      console.error("Error deleting asset:", error);
      res.status(500).json({ message: "Failed to delete asset" });
    }
  });

  // ─── Kit member routes ────────────────────────────────────────────────────────
  app.get("/api/assets/:id/members", isAuthenticated, async (req, res) => {
    try {
      const kitId = parseInt(req.params.id);
      if (isNaN(kitId)) return res.status(400).json({ message: "Invalid kit ID" });
      const members = await storage.getAssetKitMembers(kitId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching kit members:", error);
      res.status(500).json({ message: "Failed to fetch kit members" });
    }
  });

  app.post("/api/assets/:id/members", isAuthenticated, async (req, res) => {
    try {
      const kitId = parseInt(req.params.id);
      const assetId = parseInt(req.body.assetId);
      if (isNaN(kitId) || isNaN(assetId)) return res.status(400).json({ message: "Invalid ID" });
      const kit = await storage.getAsset(kitId);
      if (!kit || !kit.isKit) return res.status(400).json({ message: "Target is not a kit" });
      const updated = await storage.addAssetToKit(assetId, kitId);
      if (!updated) return res.status(404).json({ message: "Asset not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error adding asset to kit:", error);
      res.status(500).json({ message: "Failed to add asset to kit" });
    }
  });

  app.delete("/api/assets/:id/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      if (isNaN(memberId)) return res.status(400).json({ message: "Invalid member ID" });
      const updated = await storage.removeAssetFromKit(memberId);
      if (!updated) return res.status(404).json({ message: "Asset not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error removing asset from kit:", error);
      res.status(500).json({ message: "Failed to remove asset from kit" });
    }
  });

  // Asset checkout history
  app.get("/api/assets/:id/checkouts", isAuthenticated, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const checkouts = await storage.getAssetCheckouts(assetId);
      const allUsers = await storage.getAllUsers();
      const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.fullName || u.username]));
      const enriched = checkouts.map(c => ({
        ...c,
        checkedOutByName: userMap[c.checkedOutBy] ?? `User #${c.checkedOutBy}`,
        checkedInByName: c.checkedInBy ? (userMap[c.checkedInBy] ?? `User #${c.checkedInBy}`) : null,
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching asset checkouts:", error);
      res.status(500).json({ message: "Failed to fetch checkout history" });
    }
  });

  // Active checkouts for all assets — includes bookingEnded flag for overdue detection
  app.get("/api/assets/checkouts/active", isAuthenticated, async (req, res) => {
    try {
      const checkouts = await storage.getAllActiveCheckouts();
      const allUsers = await storage.getAllUsers();
      const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.fullName || u.username]));

      // Detect overdue: find bookings that have ended whose title matches a checkout purpose
      const now = new Date();
      let endedBookingTitles = new Set<string>();
      try {
        const result = await pool.query(
          `SELECT LOWER(title) AS title FROM bookings WHERE "end" < $1`,
          [now]
        );
        endedBookingTitles = new Set(result.rows.map((r: any) => r.title));
      } catch (e) {
        // Non-fatal — overdue detection degrades gracefully
      }

      const enriched = checkouts.map(c => ({
        ...c,
        checkedOutByName: userMap[c.checkedOutBy] ?? `User #${c.checkedOutBy}`,
        bookingEnded: c.purpose ? endedBookingTitles.has(c.purpose.toLowerCase()) : false,
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching active checkouts:", error);
      res.status(500).json({ message: "Failed to fetch active checkouts" });
    }
  });

  // ── Booking Asset Plans ──────────────────────────────────────────────────────
  // GET planned gear list for a booking
  app.get("/api/bookings/:id/assets", isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      if (isNaN(bookingId)) return res.status(400).json({ message: "Invalid booking ID" });
      const assets = await storage.getBookingAssets(bookingId);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching booking assets:", error);
      res.status(500).json({ message: "Failed to fetch booking assets" });
    }
  });

  // POST add asset to booking plan (no checkout side effects)
  app.post("/api/bookings/:id/assets", isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { assetId } = req.body;
      if (isNaN(bookingId) || !assetId) return res.status(400).json({ message: "Invalid parameters" });
      const userId = (req.user as any).id;
      await storage.addBookingAsset(bookingId, assetId, userId);
      res.status(201).json({ message: "Asset added to booking plan" });
    } catch (error) {
      console.error("Error adding asset to booking plan:", error);
      res.status(500).json({ message: "Failed to add asset to booking plan" });
    }
  });

  // DELETE remove asset from booking plan
  app.delete("/api/bookings/:id/assets/:assetId", isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const assetId = parseInt(req.params.assetId);
      if (isNaN(bookingId) || isNaN(assetId)) return res.status(400).json({ message: "Invalid parameters" });
      await storage.removeBookingAsset(bookingId, assetId);
      res.json({ message: "Asset removed from booking plan" });
    } catch (error) {
      console.error("Error removing asset from booking plan:", error);
      res.status(500).json({ message: "Failed to remove asset from booking plan" });
    }
  });

  // GET upcoming bookings that have this asset in their plan
  app.get("/api/assets/:id/planned-bookings", isAuthenticated, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      if (isNaN(assetId)) return res.status(400).json({ message: "Invalid asset ID" });
      const { pool } = await import("./db");
      const result = await pool.query(
        `SELECT b.id, b.title, b.start, b."end", b.color
         FROM booking_assets ba
         JOIN bookings b ON b.id = ba.booking_id
         WHERE ba.asset_id = $1
           AND b."end" > NOW()
         ORDER BY b.start ASC
         LIMIT 10`,
        [assetId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching planned bookings for asset:", error);
      res.status(500).json({ message: "Failed to fetch planned bookings" });
    }
  });

  // Check out an asset
  app.post("/api/assets/:id/checkout", isAuthenticated, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      const asset = await storage.getAsset(assetId);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      const existing = await storage.getActiveCheckout(assetId);
      if (existing) return res.status(409).json({ message: "Asset is already checked out" });
      const checkout = await storage.checkoutAsset({
        assetId,
        checkedOutBy: userId,
        purpose: req.body.purpose,
        notes: req.body.notes,
      });
      // Auto-add to booking_assets plan if a booking was selected
      const bookingId = req.body.bookingId ? parseInt(req.body.bookingId) : null;
      if (bookingId && !isNaN(bookingId)) {
        storage.addBookingAsset(bookingId, assetId, userId).catch(console.error);
      }

      // If this is a kit, also check out all available members
      const checkedOutMembers: string[] = [];
      if (asset.isKit) {
        const members = await storage.getAssetKitMembers(assetId);
        for (const member of members) {
          if (member.status === "available") {
            const memberExisting = await storage.getActiveCheckout(member.id);
            if (!memberExisting) {
              await storage.checkoutAsset({
                assetId: member.id,
                checkedOutBy: userId,
                purpose: req.body.purpose,
                notes: req.body.notes,
              });
              checkedOutMembers.push(member.name);
            }
          }
        }
      }

      res.status(201).json({ ...checkout, kitMembersCheckedOut: checkedOutMembers });
      // Audit + notify (fire-and-forget)
      const ctx = getAuditContext(req);
      const user = await storage.getUser(userId);
      const userName = user?.fullName || user?.username || `User #${userId}`;
      const extra: Record<string, string> = {};
      if (req.body.purpose) extra["Purpose"] = req.body.purpose;
      if (req.body.notes) extra["Notes"] = req.body.notes;
      if (checkedOutMembers.length) extra["Kit members"] = checkedOutMembers.join(", ");
      AuditService.log(ctx, 'CHECKOUT', 'asset', assetId, asset.name, {
        checkedOutBy: userName, purpose: req.body.purpose, notes: req.body.notes, kitMembersCheckedOut: checkedOutMembers,
      }).catch(console.error);
      sendAssetNotification(asset.name, 'checked_out', userName, extra).catch(console.error);
    } catch (error) {
      console.error("Error checking out asset:", error);
      res.status(500).json({ message: "Failed to check out asset" });
    }
  });

  // Check in an asset
  app.post("/api/assets/:id/checkin", isAuthenticated, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      const asset = await storage.getAsset(assetId);
      const result = await storage.checkinAsset(assetId, userId);
      if (!result) return res.status(409).json({ message: "Asset is not currently checked out" });

      // If this is a kit, also check in all checked-out members
      const checkedInMembers: string[] = [];
      if (asset?.isKit) {
        const members = await storage.getAssetKitMembers(assetId);
        for (const member of members) {
          const memberCheckout = await storage.getActiveCheckout(member.id);
          if (memberCheckout) {
            await storage.checkinAsset(member.id, userId);
            checkedInMembers.push(member.name);
          }
        }
      }

      res.json({ ...result, kitMembersCheckedIn: checkedInMembers });
      // Audit + notify (fire-and-forget)
      if (asset) {
        const ctx = getAuditContext(req);
        const user = await storage.getUser(userId);
        const userName = user?.fullName || user?.username || `User #${userId}`;
        AuditService.log(ctx, 'CHECKIN', 'asset', assetId, asset.name, {
          checkedInBy: userName, kitMembersCheckedIn: checkedInMembers,
        }).catch(console.error);
        sendAssetNotification(asset.name, 'checked_in', userName).catch(console.error);
      }
    } catch (error) {
      console.error("Error checking in asset:", error);
      res.status(500).json({ message: "Failed to check in asset" });
    }
  });

  // ─── Asset Photos ─────────────────────────────────────────────────────────────
  // Batch: first photo per asset (for list thumbnails) — must be before /:id/photos
  app.get("/api/assets/photos/first", isAuthenticated, async (req, res) => {
    try {
      const rows = await storage.getFirstPhotoPerAsset();
      res.json(rows);
    } catch (error) {
      console.error("Error fetching first photos:", error);
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  // Batch: first 3 photos per asset (for list thumbnails) — must be before /:id/photos
  app.get("/api/assets/photos/first3", isAuthenticated, async (req, res) => {
    try {
      const rows = await storage.getFirstThreePhotosPerAsset();
      res.json(rows);
    } catch (error) {
      console.error("Error fetching first 3 photos:", error);
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  app.get("/api/assets/:id/photos", isAuthenticated, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      if (isNaN(assetId)) return res.status(400).json({ message: "Invalid asset ID" });
      const photos = await storage.getAssetPhotos(assetId);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching asset photos:", error);
      res.status(500).json({ message: "Failed to fetch asset photos" });
    }
  });

  app.post("/api/assets/:id/photos", isAuthenticated, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      if (isNaN(assetId)) return res.status(400).json({ message: "Invalid asset ID" });

      const existing = await storage.getAssetPhotos(assetId);
      if (existing.length >= 5) return res.status(400).json({ message: "Maximum 5 photos per asset" });

      const { photoData } = req.body;
      if (!photoData || typeof photoData !== "string" || !photoData.startsWith("data:image/")) {
        return res.status(400).json({ message: "Invalid photo data" });
      }
      // Sanity check size — base64 of a 1200px JPEG at 75% quality is typically < 500 KB
      if (photoData.length > 750_000) {
        return res.status(400).json({ message: "Photo too large — please use a smaller image" });
      }

      const photo = await storage.addAssetPhoto({
        assetId,
        photoData,
        uploadedBy: (req.user as any).id,
      });
      res.json(photo);
    } catch (error) {
      console.error("Error adding asset photo:", error);
      res.status(500).json({ message: "Failed to add photo" });
    }
  });

  app.delete("/api/assets/:id/photos/:photoId", isAuthenticated, async (req, res) => {
    try {
      const photoId = parseInt(req.params.photoId);
      if (isNaN(photoId)) return res.status(400).json({ message: "Invalid photo ID" });
      const success = await storage.deleteAssetPhoto(photoId);
      if (!success) return res.status(404).json({ message: "Photo not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting asset photo:", error);
      res.status(500).json({ message: "Failed to delete photo" });
    }
  });

  return httpServer;
}
