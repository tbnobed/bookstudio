import { pgTable, text, serial, integer, boolean, timestamp, json, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Notification Groups schema
export const notificationGroups = pgTable("notification_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  email: text("email").notNull(),
  groupType: text("group_type").notNull(), // camera, lighting, sound, directors, production, engineering
  description: text("description"),
  enabled: boolean("enabled").default(true),
});

export const insertNotificationGroupSchema = createInsertSchema(notificationGroups).omit({
  id: true,
});

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("producer"), // producer, engineer, it, site_manager, admin
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

// Studios schema
export const studios = pgTable("studios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("available"), // available, maintenance, booked
});

export const insertStudioSchema = createInsertSchema(studios).omit({
  id: true,
});

// Production Control Rooms (PCR) schema
export const pcrRooms = pgTable("pcr_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("available"), // available, maintenance, booked
});

export const insertPcrRoomSchema = createInsertSchema(pcrRooms).omit({
  id: true,
});

// Booking templates schema
export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // production, maintenance, rehearsal, it_support
  duration: integer("duration").notNull(), // in minutes
  crewRequired: json("crew_required").default([]), // array of crew roles
  equipment: json("equipment").default([]), // array of equipment needed
  createdBy: integer("created_by").notNull(), // user id
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
});

// Bookings schema
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  studioId: integer("studio_id"), // Main studio (kept for backwards compatibility)
  pcrRoomId: integer("pcr_room_id"), // Production Control Room - optional
  userId: integer("user_id").notNull(),
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  type: text("type").notNull(), // production, maintenance, rehearsal, it_support
  severity: text("severity").default("medium"), // low, medium, high, critical (for alerts)
  templateId: integer("template_id"), // optional, if using a template
  notifyList: json("notify_list").default([]), // array of user/group IDs to notify
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction table for bookings to studios (many-to-many)
export const bookingStudios = pgTable("booking_studios", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  studioId: integer("studio_id").notNull(),
});

// Booking Dates table for multi-date bookings
export const bookingDates = pgTable("booking_dates", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  date: timestamp("date").notNull(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
}).extend({
  // Allow Date objects or ISO strings for timestamps
  start: z.union([z.string(), z.date()]).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
  end: z.union([z.string(), z.date()]).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
  // Make studioId optional for maintenance and IT alerts
  studioId: z.number().optional().nullable(),
  // Make pcrRoomId optional
  pcrRoomId: z.number().optional().nullable(),
  // Add support for multiple dates (not stored in the bookings table but handled separately)
  dates: z.array(
    z.union([z.string(), z.date()]).transform(val => 
      typeof val === 'string' ? new Date(val) : val
    )
  ).optional(),
  // Add support for studioIds array for multi-studio selection
  studioIds: z.array(z.number()).optional(),
});

// Notifications schema
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // booking_created, booking_updated, booking_deleted, maintenance
  read: boolean("read").default(false),
  bookingId: integer("booking_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  read: true,
  createdAt: true,
});

// Type exports
export type NotificationGroup = typeof notificationGroups.$inferSelect;
export type InsertNotificationGroup = z.infer<typeof insertNotificationGroupSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Studio = typeof studios.$inferSelect;
export type InsertStudio = z.infer<typeof insertStudioSchema>;

export type PcrRoom = typeof pcrRooms.$inferSelect;
export type InsertPcrRoom = z.infer<typeof insertPcrRoomSchema>;

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Password Reset Tokens schema
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id").notNull(),
  expires: timestamp("expires").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  used: boolean("used").default(false),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

// User Invitation Tokens schema
export const inviteTokens = pgTable("invite_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  role: text("role").notNull(),
  email: text("email").notNull(),
  expires: timestamp("expires").notNull(),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  used: boolean("used").default(false),
});

export const insertInviteTokenSchema = createInsertSchema(inviteTokens).omit({
  id: true,
  createdAt: true,
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  passwordResetTokens: many(passwordResetTokens),
  createdInviteTokens: many(inviteTokens, { relationName: "tokenCreator" }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const inviteTokensRelations = relations(inviteTokens, ({ one }) => ({
  creator: one(users, {
    fields: [inviteTokens.createdBy],
    references: [users.id],
    relationName: "tokenCreator",
  }),
}));

// Type exports for tokens
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export type InviteToken = typeof inviteTokens.$inferSelect;
export type InsertInviteToken = z.infer<typeof insertInviteTokenSchema>;

// File Attachments schema
export const fileAttachments = pgTable("file_attachments", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(), // in bytes
  mimeType: text("mime_type").notNull(),
  path: text("path").notNull(), // file storage path
  uploadedBy: integer("uploaded_by").notNull(), // user id
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  description: text("description"),
});

export const insertFileAttachmentSchema = createInsertSchema(fileAttachments).omit({
  id: true,
  uploadedAt: true,
}).extend({
  // 100MB file size limit (100 * 1024 * 1024 bytes)
  fileSize: z.number().max(104857600, "File size cannot exceed 100MB"),
});

// Type exports for file attachments
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type InsertFileAttachment = z.infer<typeof insertFileAttachmentSchema>;

// Add schema for booking_studios
export const insertBookingStudiosSchema = createInsertSchema(bookingStudios).omit({
  id: true,
});

// Type exports for booking_studios
export type BookingStudio = typeof bookingStudios.$inferSelect;
export type InsertBookingStudio = z.infer<typeof insertBookingStudiosSchema>;

// Add schema for booking_dates
export const insertBookingDatesSchema = createInsertSchema(bookingDates).omit({
  id: true,
});

// Type exports for booking_dates
export type BookingDate = typeof bookingDates.$inferSelect;
export type InsertBookingDate = z.infer<typeof insertBookingDatesSchema>;

// Add the relations
export const bookingsRelations = relations(bookings, ({ many, one }) => ({
  fileAttachments: many(fileAttachments),
  studio: one(studios, {
    fields: [bookings.studioId],
    references: [studios.id],
  }),
  pcrRoom: one(pcrRooms, {
    fields: [bookings.pcrRoomId],
    references: [pcrRooms.id],
  }),
  studios: many(bookingStudios),
  dates: many(bookingDates), // Relation to booking dates
}));

export const fileAttachmentsRelations = relations(fileAttachments, ({ one }) => ({
  booking: one(bookings, {
    fields: [fileAttachments.bookingId],
    references: [bookings.id],
  }),
  uploader: one(users, {
    fields: [fileAttachments.uploadedBy],
    references: [users.id],
  }),
}));

export const pcrRoomsRelations = relations(pcrRooms, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingDatesRelations = relations(bookingDates, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingDates.bookingId],
    references: [bookings.id],
  }),
}));
