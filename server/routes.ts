import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertStudioSchema, 
  insertTemplateSchema, 
  insertBookingSchema, 
  insertNotificationSchema,
  insertNotificationGroupSchema
} from "@shared/schema";
import { z } from "zod";
import { ValidationError } from "zod-validation-error";
import { ZodError } from "zod";
import { setupAuth } from "./auth";
import { 
  sendBookingConfirmation, 
  sendBookingUpdate, 
  sendBookingCancellation, 
  sendMaintenanceAlert,
  sendFacilityAlert
} from "./services/emailService";

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
  app.get("/api/users", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
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
      
      // Check if the user is updating their own profile or has admin rights
      if (currentUser.id !== id && currentUser.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: You can only update your own profile unless you're an admin" });
      }
      
      // If user is updating password, include it in the update
      let dataToUpdate = req.body;
      
      // Admin can update any field, but regular users can only update certain fields
      if (currentUser.role !== "admin" && currentUser.id === id) {
        // Regular users can only update their own name, email and password
        const { name, email, password } = req.body;
        dataToUpdate = { name, email };
        
        // Only include password if it's being changed
        if (password) {
          dataToUpdate.password = password;
        }
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
  
  app.delete("/api/users/:id", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Prevent self-deletion
      if (req.user && req.user.id === id) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }
      
      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "User not found or could not be deleted" });
      }
      
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
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

  app.post("/api/studios", isAuthenticated, hasRole(["admin"]), async (req, res) => {
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

  app.patch("/api/studios/:id/status", isAuthenticated, hasRole(["admin", "engineer", "it"]), async (req, res) => {
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
  
  app.delete("/api/studios/:id", isAuthenticated, hasRole(["admin"]), async (req, res) => {
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

  app.delete("/api/templates/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      const user = req.user as any;
      // Only the creator or admin can delete a template
      if (template.createdBy !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const success = await storage.deleteTemplate(id);
      if (success) {
        return res.json({ message: "Template deleted successfully" });
      } else {
        return res.status(500).json({ message: "Failed to delete template" });
      }
    } catch (error) {
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

  app.post("/api/bookings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Check role permissions based on booking types
      if (req.body.type === "maintenance" || req.body.type === "all-day:maintenance") {
        // Only admin, engineers, and IT staff can create maintenance bookings
        if (!["admin", "engineer", "it"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin, engineers, and IT staff can create maintenance bookings" });
        }
      } else if (req.body.type === "it_support") {
        // Only admin and IT staff can create IT support bookings
        if (!["admin", "it"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin and IT staff can create IT support bookings" });
        }
      } else {
        // For regular production bookings, ensure producers have access
        if (user.role !== "admin" && user.role !== "producer") {
          return res.status(403).json({ message: "Only admin and producers can create regular bookings" });
        }
      }
      
      console.log("Booking request data:", JSON.stringify(req.body));
      
      // Ensure studioId is a number and proper date formats
      const requestData = {
        ...req.body,
        userId: user.id,
        studioId: typeof req.body.studioId === 'string' ? parseInt(req.body.studioId) : req.body.studioId
      };
      
      console.log("Modified request data:", JSON.stringify(requestData));
      
      const bookingData = insertBookingSchema.parse(requestData);
      
      // Check for booking conflicts (only for studio-specific bookings)
      let conflict = false;
      
      if (bookingData.studioId !== null) {
        const existingBookings = await storage.getBookingsByStudio(bookingData.studioId);
        const start = new Date(bookingData.start);
        const end = new Date(bookingData.end);
        
        conflict = existingBookings.some(booking => {
          const bookingStart = new Date(booking.start);
          const bookingEnd = new Date(booking.end);
          
          return (
            (start >= bookingStart && start < bookingEnd) ||
            (end > bookingStart && end <= bookingEnd) ||
            (start <= bookingStart && end >= bookingEnd)
          );
        });
      }
      
      if (conflict) {
        return res.status(409).json({ message: "There is a booking conflict for this time slot" });
      }
      
      const booking = await storage.createBooking(bookingData);
      
      // Handle facility-wide maintenance alerts (for all users)
      // These are recognized by null studioId and maintenance or it_support type
      if (booking.studioId === null && (booking.type === "maintenance" || booking.type === "it_support" || 
          booking.type === "all-day:maintenance")) {
        try {
          console.log(`Processing facility-wide alert: ${booking.title}`);
          // Get all users to notify
          const allUsers = await storage.getAllUsers();
          
          // Send email notifications to all users about the facility-wide alert
          // Use bulk email sending to avoid API rate limits
          if (allUsers.length > 0) {
            try {
              console.log(`Sending facility alert emails to ${allUsers.length} users`);
              await sendFacilityAlert(booking, allUsers);
            } catch (emailError) {
              console.error("Error sending facility-wide alert emails:", emailError);
              // Continue even if emails fail
            }
          }
        } catch (error) {
          console.error("Error processing facility-wide alert:", error);
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
        if (booking.studioId) {
          try {
            const studio = await storage.getStudio(booking.studioId);
            if (studio) {
              console.log(`Sending booking confirmation email to user ${user.email} for booking "${booking.title}"`);
              await sendBookingConfirmation(booking, studio, user);
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
        // Only admin, engineers, and IT staff can update maintenance bookings
        if (!["admin", "engineer", "it"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin, engineers, and IT staff can update maintenance bookings" });
        }
      } else if (booking.type === "it_support") {
        // Only admin and IT staff can update IT support bookings
        if (!["admin", "it"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin and IT staff can update IT support bookings" });
        }
      } else {
        // For regular production bookings, only the creator, admin, or producers can update
        if (booking.userId !== user.id && user.role !== "admin" && user.role !== "producer") {
          return res.status(403).json({ message: "You don't have permission to update this booking" });
        }
      }
      
      // Validate the update data
      let updateData = { ...req.body };
      
      // Convert date strings to Date objects
      if (updateData.start && typeof updateData.start === 'string') {
        updateData.start = new Date(updateData.start);
      }
      
      if (updateData.end && typeof updateData.end === 'string') {
        updateData.end = new Date(updateData.end);
      }
      
      console.log("Processing update with data:", updateData);
      
      // If changing dates, check for conflicts (only for studio-specific bookings)
      if ((updateData.start || updateData.end) && (updateData.studioId !== null && booking.studioId !== null)) {
        const start = updateData.start || new Date(booking.start);
        const end = updateData.end || new Date(booking.end);
        const studioId = updateData.studioId !== undefined ? updateData.studioId : booking.studioId;
        
        if (studioId !== null) {
          const existingBookings = await storage.getBookingsByStudio(studioId);
          
          const conflict = existingBookings.some(b => {
            if (b.id === id) return false; // Skip the current booking
            
            const bookingStart = new Date(b.start);
            const bookingEnd = new Date(b.end);
            
            return (
              (start >= bookingStart && start < bookingEnd) ||
              (end > bookingStart && end <= bookingEnd) ||
              (start <= bookingStart && end >= bookingEnd)
            );
          });
          
          if (conflict) {
            return res.status(409).json({ message: "There is a booking conflict for this time slot" });
          }
        }
      }
      
      const updatedBooking = await storage.updateBooking(id, updateData);
      
      // Check if this is a facility-wide alert (null studioId and maintenance/IT related type)
      if (updatedBooking && updatedBooking.studioId === null && 
          (updatedBooking.type === "maintenance" || updatedBooking.type === "it_support" || 
           updatedBooking.type === "all-day:maintenance")) {
        try {
          console.log(`Processing updated facility-wide alert: ${updatedBooking.title}`);
          // Get all users to notify
          const allUsers = await storage.getAllUsers();
          
          // Send email notifications to all users about the updated facility-wide alert
          if (allUsers.length > 0) {
            try {
              console.log(`Sending updated facility alert emails to ${allUsers.length} users`);
              await sendMaintenanceAlert(updatedBooking, allUsers);
            } catch (emailError) {
              console.error("Error sending updated facility-wide alert emails:", emailError);
              // Continue even if emails fail
            }
          }
        } catch (error) {
          console.error("Error processing updated facility-wide alert:", error);
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
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      const user = req.user as any;
      
      // Check permissions based on booking type and role
      if (booking.type === "maintenance" || booking.type === "all-day:maintenance") {
        // Only admin, engineers, and IT staff can delete maintenance bookings
        if (!["admin", "engineer", "it"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin, engineers, and IT staff can delete maintenance bookings" });
        }
      } else if (booking.type === "it_support") {
        // Only admin and IT staff can delete IT support bookings
        if (!["admin", "it"].includes(user.role)) {
          return res.status(403).json({ message: "Only admin and IT staff can delete IT support bookings" });
        }
      } else {
        // For regular production bookings, only the creator, admin, or producers can delete
        if (booking.userId !== user.id && user.role !== "admin" && user.role !== "producer") {
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
        
        return res.json({ message: "Booking deleted successfully" });
      } else {
        return res.status(500).json({ message: "Failed to delete booking" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete booking" });
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
      if (!["admin", "engineer", "it"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only administrators, engineers, and IT support can manage notification groups" 
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
      
      // Only admins, engineers, and IT can manage notification groups
      if (!["admin", "engineer", "it"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only administrators, engineers, and IT support can manage notification groups" 
        });
      }
      
      const group = await storage.getNotificationGroup(id);
      if (!group) {
        return res.status(404).json({ message: "Notification group not found" });
      }
      
      const updateData = req.body;
      const updatedGroup = await storage.updateNotificationGroup(id, updateData);
      res.json(updatedGroup);
    } catch (error) {
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
      
      // Only admins, engineers, and IT can manage notification groups
      if (!["admin", "engineer", "it"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only administrators, engineers, and IT support can manage notification groups" 
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

  return httpServer;
}
