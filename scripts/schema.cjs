// CommonJS version of schema for Docker environment
const { 
  pgTable, 
  serial, 
  text, 
  timestamp, 
  pgEnum, 
  integer, 
  boolean, 
  json, 
  uniqueIndex 
} = require('drizzle-orm/pg-core');

// User roles enum
const userRolesEnum = pgEnum('user_role', ['admin', 'producer', 'engineer']);

// Users table
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('producer')
}, (table) => {
  return {
    usernameIdx: uniqueIndex('username_idx').on(table.username),
    emailIdx: uniqueIndex('email_idx').on(table.email)
  };
});

// Studios table
const studios = pgTable('studios', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('available'),
  description: text('description')
});

// Templates table
const templates = pgTable('templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  description: text('description'),
  duration: integer('duration').notNull(),
  crewRequired: json('crew_required'),
  equipment: json('equipment'),
  createdBy: integer('created_by').notNull()
});

// Bookings table
const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(),
  start: timestamp('start_time').notNull(),
  end: timestamp('end_time').notNull(),
  studioId: integer('studio_id'),
  userId: integer('user_id').notNull(),
  severity: text('severity'),
  templateId: integer('template_id'),
  notifyList: json('notify_list'),
  createdAt: timestamp('created_at').defaultNow()
});

// Notification groups table
const notificationGroups = pgTable('notification_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  description: text('description'),
  groupType: text('group_type').notNull(),
  enabled: boolean('enabled').default(true)
});

// Notifications table
const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(),
  read: boolean('read').default(false),
  bookingId: integer('booking_id'),
  createdAt: timestamp('created_at').defaultNow()
});

// Export tables and relationships
module.exports = {
  users,
  studios,
  templates,
  bookings,
  notificationGroups,
  notifications
};