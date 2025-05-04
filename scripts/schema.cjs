// CommonJS version of the schema for Docker compatibility
const { pgTable, serial, text, timestamp, integer, boolean, jsonb } = require('drizzle-orm/pg-core');

// User table
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('user'),
});

// Studio table
const studios = pgTable('studios', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  status: text('status').notNull().default('active')
});

// Template table
const templates = pgTable('templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(),
  duration: integer('duration').notNull(),
  crewRequired: jsonb('crew_required'),
  equipment: jsonb('equipment'),
  createdBy: integer('created_by').notNull(),
});

// Booking table
const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull().default('standard'),
  start: timestamp('start_time').notNull(),
  end: timestamp('end_time').notNull(),
  userId: integer('user_id').notNull(),
  studioId: integer('studio_id'),
  templateId: integer('template_id'),
  severity: text('severity'),
  notifyList: jsonb('notify_list'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Notification table
const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(),
  read: boolean('read').default(false),
  bookingId: integer('booking_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Notification Group table
const notificationGroups = pgTable('notification_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  email: text('email').notNull(),
  groupType: text('group_type').notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(true),
});

module.exports = {
  users,
  studios,
  templates,
  bookings,
  notifications,
  notificationGroups
};