import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertStudioSchema, 
  insertTemplateSchema, 
  insertBookingSchema, 
  insertNotificationSchema
} from "@shared/schema";
import { z } from "zod";
import { ValidationError } from "zod-validation-error";
import { ZodError } from "zod";
import { setupAuth } from "./auth";

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
      
      // Check role permissions
      if (req.body.type === "maintenance" && !["admin", "engineer", "it"].includes(user.role)) {
        return res.status(403).json({ message: "Only admin, engineers, and IT staff can create maintenance bookings" });
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
      
      // Create notifications for the booking creator
      await storage.createNotification({
        userId: user.id,
        title: "Booking Confirmation",
        message: `Your booking for ${booking.title} has been created successfully.`,
        type: "booking_created",
        bookingId: booking.id
      });
      
      // If there's a notify list, create notifications for those users too
      if (booking.notifyList && Array.isArray(booking.notifyList)) {
        for (const userId of booking.notifyList as number[]) {
          await storage.createNotification({
            userId,
            title: "New Booking Notification",
            message: `A new booking "${booking.title}" has been created that requires your attention.`,
            type: "booking_created",
            bookingId: booking.id
          });
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
      
      // Check permissions: only the creator, admin, or engineer/it for maintenance can update
      if (
        booking.userId !== user.id && 
        user.role !== "admin" && 
        !(["engineer", "it"].includes(user.role) && booking.type === "maintenance")
      ) {
        return res.status(403).json({ message: "You don't have permission to update this booking" });
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
      
      // Only create notification if there's a user associated with this booking
      // Facility-wide alerts may not have a specific user
      if (booking.userId) {
        try {
          await storage.createNotification({
            userId: booking.userId,
            title: "Booking Updated",
            message: `Your booking for "${booking.title}" has been updated.`,
            type: "booking_updated",
            bookingId: booking.id
          });
        } catch (notificationError) {
          console.error("Error creating notification:", notificationError);
          // Continue with the response even if notification creation fails
        }
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
      
      // Check permissions: only the creator, admin, or engineer/it for maintenance can delete
      if (
        booking.userId !== user.id && 
        user.role !== "admin" && 
        !(["engineer", "it"].includes(user.role) && 
          (booking.type === "maintenance" || booking.type === "it_support") && 
          booking.studioId === null)
      ) {
        return res.status(403).json({ message: "You don't have permission to delete this booking" });
      }
      
      const success = await storage.deleteBooking(id);
      
      if (success) {
        // Create notification for the booking owner if not the deleter
        if (booking.userId !== user.id) {
          let deletedByRole = "administrator";
          if (["engineer", "it"].includes(user.role)) {
            deletedByRole = user.role === "engineer" ? "an engineer" : "IT support";
          }
          
          await storage.createNotification({
            userId: booking.userId,
            title: booking.studioId === null ? "Alert Deleted" : "Booking Deleted",
            message: booking.studioId === null
              ? `Your facility alert "${booking.title}" has been deleted by ${deletedByRole}.`
              : `Your booking for "${booking.title}" has been deleted by ${deletedByRole}.`,
            type: "booking_deleted",
            bookingId: booking.id
          });
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

  return httpServer;
}
