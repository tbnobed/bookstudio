import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("producer"), // producer, engineer, it, admin
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
  studioId: integer("studio_id").notNull(),
  userId: integer("user_id").notNull(),
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  type: text("type").notNull(), // production, maintenance, rehearsal, it_support
  templateId: integer("template_id"), // optional, if using a template
  notifyList: json("notify_list").default([]), // array of user/group IDs to notify
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
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
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Studio = typeof studios.$inferSelect;
export type InsertStudio = z.infer<typeof insertStudioSchema>;

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
