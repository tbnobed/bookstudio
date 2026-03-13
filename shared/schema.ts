import { pgTable, text, serial, integer, boolean, timestamp, json, bigint, unique } from "drizzle-orm/pg-core";
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
  status: text("status").notNull().default("available"), // available, maintenance, in-use, booked (legacy)
});

export const insertStudioSchema = createInsertSchema(studios).omit({
  id: true,
});

// Production Control Rooms (PCR) schema
export const pcrRooms = pgTable("pcr_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("available"), // available, maintenance, in-use, booked (legacy)
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
  startTime: text("start_time"), // Default start time in HH:MM format (e.g., "09:00")
  endTime: text("end_time"), // Default end time in HH:MM format (e.g., "17:00")
  studioIds: json("studio_ids").default([]), // array of studio IDs to pre-select
  pcrRoomId: integer("pcr_room_id"), // Production Control Room - optional
  status: text("status").default("confirmed"), // confirmed, tentative, cancelled
  color: text("color"), // Custom color for booking (CSS color value)
  notifyList: json("notify_list").default([]), // array of notification group IDs
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
  status: text("status").default("confirmed"), // confirmed, tentative, cancelled
  severity: text("severity").default("medium"), // low, medium, high, critical (for alerts)
  templateId: integer("template_id"), // optional, if using a template
  notifyList: json("notify_list").default([]), // array of user/group IDs to notify
  color: text("color"), // Custom color for booking (CSS color value)
  linkedGroupId: text("link_group_id"), // optional, groups linked bookings together
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction table for bookings to studios (many-to-many)
export const bookingStudios = pgTable("booking_studios", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  studioId: integer("studio_id").notNull(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  severity: true, // Remove severity from booking schema - only for alerts
}).extend({
  // Allow Date objects or ISO strings for timestamps
  start: z.union([z.string(), z.date()]).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
  end: z.union([z.string(), z.date()]).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
  // pcrRoomId is required for production bookings
  pcrRoomId: z.number().optional().nullable(),
  // Make color optional, but validate if provided
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional().nullable()
    .or(z.literal('')) // Allow empty string
    .describe("HEX color value (e.g., #FF5733)"),
  // Add studioIds for multi-studio booking support
  studioIds: z.array(z.number()).optional(),
  // Add linkedGroupId for linked booking support
  linkedGroupId: z.string().optional().nullable(),
});

// Alerts schema - separate from bookings
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  alertType: text("alert_type").notNull(), // maintenance, site_alert, facility_alert, network_outage
  severity: text("severity").notNull(), // low, medium, high, critical
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  isAllDay: boolean("is_all_day").default(false),
  status: text("status").default("active"), // active, resolved, cancelled
  notifyList: json("notify_list").default([]), // array of notification group IDs
  createdBy: integer("created_by").notNull(), // user id
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
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

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

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
  bookings: many(bookings),
  templates: many(templates),
  teamMemberships: many(teamMembers),
  createdTeams: many(teams),
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

// System Settings schema
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for system settings
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingsSchema>;

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

// Booking Types schema - allows customization of booking categories
export const bookingTypes = pgTable("booking_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#3b82f6"), // hex color for visual identification
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBookingTypeSchema = createInsertSchema(bookingTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BookingType = typeof bookingTypes.$inferSelect;
export type InsertBookingType = z.infer<typeof insertBookingTypeSchema>;

// Audit Log schema - tracks all system activities
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // who performed the action
  action: text("action").notNull(), // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
  entityType: text("entity_type").notNull(), // booking, user, alert, template, etc.
  entityId: integer("entity_id"), // ID of the affected entity (nullable for system actions)
  entityTitle: text("entity_title"), // title/name of affected entity for easy identification
  details: json("details").default({}), // JSON object with action details (old values, new values, etc.)
  ipAddress: text("ip_address"), // IP address of the user
  userAgent: text("user_agent"), // browser/client information
  timestamp: timestamp("timestamp").defaultNow(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Teams schema - allows users to be grouped together for collaborative booking visibility
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: integer("created_by").notNull(), // user id
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

// Team Members schema - junction table for team membership
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").default("member"), // 'admin', 'member'
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate team memberships
  teamUserUnique: unique().on(table.teamId, table.userId),
}));

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  joinedAt: true,
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

// Team relations
export const teamsRelations = relations(teams, ({ many, one }) => ({
  members: many(teamMembers),
  creator: one(users, {
    fields: [teams.createdBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

// Asset Management schema
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // camera, lighting, audio, video, cable, accessory, other
  status: text("status").notNull().default("available"), // available, in-use, maintenance, retired
  serialNumber: text("serial_number"),
  assetTag: text("asset_tag"),
  location: text("location"),
  description: text("description"),
  notes: text("notes"),
  purchaseDate: text("purchase_date"),
  lastMaintenanceDate: text("last_maintenance_date"),
  assignedTo: integer("assigned_to"), // user id, nullable
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;

