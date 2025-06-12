import { 
  users, type User, type InsertUser,
  studios, type Studio, type InsertStudio,
  templates, type Template, type InsertTemplate,
  bookings, type Booking, type InsertBooking,
  notifications, type Notification, type InsertNotification,
  notificationGroups, type NotificationGroup, type InsertNotificationGroup,
  pcrRooms, type PcrRoom, type InsertPcrRoom,
  bookingStudios, type BookingStudio, type InsertBookingStudio,
  systemSettings, type SystemSetting, type InsertSystemSetting
} from "@shared/schema";

import { db, pool, ensureConnection } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { eq, and, or, isNull, not, desc, gte, lte, inArray, sql } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  
  // Studio management
  getStudio(id: number): Promise<Studio | undefined>;
  getAllStudios(): Promise<Studio[]>;
  createStudio(studio: InsertStudio): Promise<Studio>;
  updateStudioStatus(id: number, status: string): Promise<Studio | undefined>;
  updateStudio(id: number, data: Partial<InsertStudio>): Promise<Studio | undefined>;
  deleteStudio(id: number): Promise<boolean>;
  
  // PCR Room management
  getPcrRoom(id: number): Promise<PcrRoom | undefined>;
  getAllPcrRooms(): Promise<PcrRoom[]>;
  createPcrRoom(pcrRoom: InsertPcrRoom): Promise<PcrRoom>;
  updatePcrRoomStatus(id: number, status: string): Promise<PcrRoom | undefined>;
  deletePcrRoom(id: number): Promise<boolean>;
  
  // Template management
  getTemplate(id: number): Promise<Template | undefined>;
  getAllTemplates(): Promise<Template[]>;
  getTemplatesByUser(userId: number): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: number): Promise<boolean>;
  
  // Booking management
  getBooking(id: number): Promise<Booking | undefined>;
  getAllBookings(): Promise<Booking[]>;
  getBookingsByStudio(studioId: number | null): Promise<Booking[]>;
  getBookingsByUser(userId: number): Promise<Booking[]>;
  getBookingsByDateRange(start: Date, end: Date): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, data: Partial<InsertBooking>, studioIds?: number[]): Promise<Booking | undefined>;
  deleteBooking(id: number): Promise<boolean>;
  checkBookingConflicts(studioId: number, start: Date, end: Date, excludeBookingId: number | null): Promise<Booking[]>;
  copyBookingToMultipleDates(bookingId: number, dates: Date[]): Promise<Booking[]>;
  
  // Booking-Studio links management
  getBookingStudioLinks(bookingId: number): Promise<BookingStudio[]>;
  getAllBookingStudioLinks(): Promise<BookingStudio[]>;
  getStudiosForBooking(bookingId: number): Promise<Studio[]>;
  getBookingStudios(bookingId: number): Promise<Studio[]>;
  createBookingStudioLinks(bookingId: number, studioIds: number[]): Promise<BookingStudio[]>;
  deleteBookingStudioLinks(bookingId: number): Promise<boolean>;
  linkBookingToStudio(bookingId: number, studioId: number): Promise<BookingStudio>;
  
  // Notification group management
  getNotificationGroup(id: number): Promise<NotificationGroup | undefined>;
  getNotificationGroupByType(groupType: string): Promise<NotificationGroup | undefined>;
  getAllNotificationGroups(): Promise<NotificationGroup[]>;
  createNotificationGroup(group: InsertNotificationGroup): Promise<NotificationGroup>;
  updateNotificationGroup(id: number, data: Partial<InsertNotificationGroup>): Promise<NotificationGroup | undefined>;
  deleteNotificationGroup(id: number): Promise<boolean>;
  
  // Notification management
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  
  // System Settings
  getSiteName(): Promise<string>;
  setSiteName(name: string): Promise<SystemSetting>;
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  getAllSystemSettings(): Promise<SystemSetting[]>;
  upsertSystemSetting(data: InsertSystemSetting): Promise<SystemSetting>;
  deleteSystemSetting(key: string): Promise<boolean>;
  
  // Session management
  sessionStore: session.Store;
}

import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private studios: Map<number, Studio>;
  private templates: Map<number, Template>;
  private bookings: Map<number, Booking>;
  private notifications: Map<number, Notification>;
  private notificationGroups: Map<number, NotificationGroup>;
  private bookingStudios: Map<string, BookingStudio>; // Use bookingId-studioId as key
  private systemSettings: Map<string, SystemSetting>;
  
  private userIdCounter: number;
  private studioIdCounter: number;
  private templateIdCounter: number;
  private bookingIdCounter: number;
  private notificationIdCounter: number;
  private notificationGroupIdCounter: number;
  private bookingStudioIdCounter: number;
  private systemSettingIdCounter: number;
  
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.studios = new Map();
    this.templates = new Map();
    this.bookings = new Map();
    this.notifications = new Map();
    this.notificationGroups = new Map();
    this.bookingStudios = new Map();
    this.pcrRooms = new Map();
    this.systemSettings = new Map();
    
    this.userIdCounter = 1;
    this.studioIdCounter = 1;
    this.templateIdCounter = 1;
    this.bookingIdCounter = 1;
    this.notificationIdCounter = 1;
    this.notificationGroupIdCounter = 1;
    this.bookingStudioIdCounter = 1;
    this.pcrRoomIdCounter = 1;
    this.systemSettingIdCounter = 1;
    
    // Create memory store for sessions
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Initialize with some sample data
    this.initializeData();
  }

  private initializeData() {
    // Create admin user
    const adminUser: InsertUser = {
      username: "admin",
      password: "admin123", // In real app, use hashed passwords
      email: "admin@studios.com",
      name: "Admin User",
      role: "admin"
    };
    this.createUser(adminUser);
    
    // Create producer user
    const producerUser: InsertUser = {
      username: "producer",
      password: "producer123",
      email: "producer@studios.com",
      name: "Sarah Connor",
      role: "producer"
    };
    this.createUser(producerUser);
    
    // Create engineer user
    const engineerUser: InsertUser = {
      username: "engineer",
      password: "engineer123",
      email: "engineer@studios.com",
      name: "John Engineer",
      role: "engineer"
    };
    this.createUser(engineerUser);
    
    // Create studios
    for (let i = 1; i <= 20; i++) {
      this.createStudio({
        name: `Studio ${i}`,
        description: `Television studio #${i}`,
        status: "available"
      });
    }
    
    // Create default notification groups
    const notificationGroups = [
      {
        name: "Camera Operators",
        email: "camera-team@studios.com",
        groupType: "department",
        description: "All camera operators and video technicians"
      },
      {
        name: "Lighting Technicians",
        email: "lighting@studios.com",
        groupType: "department",
        description: "Lighting setup and operation staff"
      },
      {
        name: "Directors",
        email: "directors@studios.com",
        groupType: "department",
        description: "Program directors and assistant directors"
      },
      {
        name: "Sound Engineers",
        email: "sound@studios.com",
        groupType: "department",
        description: "Audio and sound personnel"
      },
      {
        name: "Production Assistants",
        email: "pa@studios.com",
        groupType: "department",
        description: "PAs and floor managers"
      },
      {
        name: "Engineering",
        email: "engineering@studios.com",
        groupType: "department",
        description: "Engineering and maintenance team"
      },
      {
        name: "IT Support",
        email: "it@studios.com",
        groupType: "department",
        description: "IT support and network team"
      },
      {
        name: "All Staff",
        email: "all-staff@studios.com",
        groupType: "facility",
        description: "All facility personnel"
      }
    ];
    
    // Create each notification group
    for (const group of notificationGroups) {
      this.createNotificationGroup(group);
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser: User = { ...user, id };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser: User = { ...user, ...data };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Studio methods
  async getStudio(id: number): Promise<Studio | undefined> {
    return this.studios.get(id);
  }

  async getAllStudios(): Promise<Studio[]> {
    // Return all studios sorted alphabetically by name
    return Array.from(this.studios.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createStudio(studio: InsertStudio): Promise<Studio> {
    const id = this.studioIdCounter++;
    const newStudio: Studio = { ...studio, id };
    this.studios.set(id, newStudio);
    return newStudio;
  }

  async updateStudioStatus(id: number, status: string): Promise<Studio | undefined> {
    const studio = await this.getStudio(id);
    if (!studio) return undefined;
    
    const updatedStudio: Studio = { ...studio, status };
    this.studios.set(id, updatedStudio);
    return updatedStudio;
  }
  
  async updateStudio(id: number, data: Partial<InsertStudio>): Promise<Studio | undefined> {
    const studio = await this.getStudio(id);
    if (!studio) return undefined;
    
    const updatedStudio: Studio = { ...studio, ...data };
    this.studios.set(id, updatedStudio);
    return updatedStudio;
  }
  
  async deleteStudio(id: number): Promise<boolean> {
    // Check if the studio exists
    const studioExists = this.studios.has(id);
    
    // Delete the studio
    return this.studios.delete(id);
  }
  
  // PCR Room methods
  private pcrRooms: Map<number, PcrRoom> = new Map();
  private pcrRoomIdCounter: number = 1;
  
  async getPcrRoom(id: number): Promise<PcrRoom | undefined> {
    return this.pcrRooms.get(id);
  }

  async getAllPcrRooms(): Promise<PcrRoom[]> {
    // Return all PCR rooms sorted alphabetically by name
    return Array.from(this.pcrRooms.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createPcrRoom(pcrRoom: InsertPcrRoom): Promise<PcrRoom> {
    const id = this.pcrRoomIdCounter++;
    const newPcrRoom: PcrRoom = { ...pcrRoom, id };
    this.pcrRooms.set(id, newPcrRoom);
    return newPcrRoom;
  }

  async updatePcrRoomStatus(id: number, status: string): Promise<PcrRoom | undefined> {
    const pcrRoom = await this.getPcrRoom(id);
    if (!pcrRoom) return undefined;
    
    const updatedPcrRoom: PcrRoom = { ...pcrRoom, status };
    this.pcrRooms.set(id, updatedPcrRoom);
    return updatedPcrRoom;
  }
  
  async deletePcrRoom(id: number): Promise<boolean> {
    // Check if the PCR room exists
    const pcrRoomExists = this.pcrRooms.has(id);
    
    // Delete the PCR room
    return this.pcrRooms.delete(id);
  }

  // Template methods
  async getTemplate(id: number): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async getAllTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values());
  }

  async getTemplatesByUser(userId: number): Promise<Template[]> {
    return Array.from(this.templates.values()).filter(
      (template) => template.createdBy === userId
    );
  }

  async createTemplate(template: InsertTemplate): Promise<Template> {
    const id = this.templateIdCounter++;
    const newTemplate: Template = { ...template, id };
    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  async updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined> {
    const template = this.templates.get(id);
    if (!template) return undefined;
    
    const updatedTemplate: Template = { ...template, ...data };
    this.templates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  async deleteTemplate(id: number): Promise<boolean> {
    return this.templates.delete(id);
  }

  // Booking methods
  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async getAllBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values());
  }

  async getBookingsByStudio(studioId: number | null): Promise<Booking[]> {
    if (studioId === null) {
      // For facility-wide alerts, get bookings that have null studioId
      return Array.from(this.bookings.values()).filter(
        (booking) => booking.studioId === null
      );
    }
    
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.studioId === studioId
    );
  }

  async getBookingsByUser(userId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.userId === userId
    );
  }

  async getBookingsByDateRange(start: Date, end: Date): Promise<Booking[]> {
    const startTime = start.getTime();
    const endTime = end.getTime();
    
    return Array.from(this.bookings.values()).filter((booking) => {
      const bookingStart = new Date(booking.start).getTime();
      const bookingEnd = new Date(booking.end).getTime();
      
      return (
        (bookingStart >= startTime && bookingStart < endTime) || // starts within range
        (bookingEnd > startTime && bookingEnd <= endTime) || // ends within range
        (bookingStart <= startTime && bookingEnd >= endTime) // spans the entire range
      );
    });
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const id = this.bookingIdCounter++;
    const newBooking: Booking = { 
      ...booking, 
      id, 
      createdAt: new Date() 
    };
    this.bookings.set(id, newBooking);
    return newBooking;
  }

  async updateBooking(id: number, data: Partial<InsertBooking>, studioIds?: number[]): Promise<Booking | undefined> {
    try {
      const booking = await this.getBooking(id);
      if (!booking) return undefined;
      
      // Process dates to ensure they're in the correct format
      const processedData = { ...data };
      
      // Convert string dates to Date objects
      if (processedData.start && typeof processedData.start === 'string') {
        processedData.start = new Date(processedData.start);
      }
      
      if (processedData.end && typeof processedData.end === 'string') {
        processedData.end = new Date(processedData.end);
      }
      
      console.log(`Updating booking ${id} with data:`, processedData);
      
      // In MemStorage, we just merge the objects
      const updatedBooking: Booking = { ...booking, ...processedData };
      this.bookings.set(id, updatedBooking);
      
      // If studioIds are provided, update the booking-studio links
      if (studioIds && Array.isArray(studioIds)) {
        console.log(`Updating studio links for booking ${id} with studios:`, studioIds);
        
        // First delete any existing links
        await this.deleteBookingStudioLinks(id);
        
        // Then create new links
        if (studioIds.length > 0) {
          await this.createBookingStudioLinks(id, studioIds);
        }
      }
      
      return updatedBooking;
    } catch (error) {
      console.error(`Error updating booking with ID ${id}:`, error);
      return undefined;
    }
  }

  async deleteBooking(id: number): Promise<boolean> {
    // Also delete any associated booking-studio links
    await this.deleteBookingStudioLinks(id);
    return this.bookings.delete(id);
  }

  // Booking-Studio junction table methods
  async getBookingStudioLinks(bookingId: number): Promise<BookingStudio[]> {
    const links: BookingStudio[] = [];
    
    // Find all links with matching bookingId
    this.bookingStudios.forEach((link, key) => {
      if (link.bookingId === bookingId) {
        links.push(link);
      }
    });
    
    return links;
  }
  
  async getAllBookingStudioLinks(): Promise<BookingStudio[]> {
    // Return all links from the map
    return Array.from(this.bookingStudios.values());
  }
  
  async getStudiosForBooking(bookingId: number): Promise<Studio[]> {
    // Get all links for this booking
    const links = await this.getBookingStudioLinks(bookingId);
    
    if (links.length === 0) {
      // If no links found, try to get the legacy studioId
      const booking = await this.getBooking(bookingId);
      if (booking && booking.studioId) {
        const studio = await this.getStudio(booking.studioId);
        return studio ? [studio] : [];
      }
      return [];
    }
    
    // Get all studios from the links
    const studios: Studio[] = [];
    for (const link of links) {
      const studio = await this.getStudio(link.studioId);
      if (studio) {
        studios.push(studio);
      }
    }
    
    return studios;
  }
  
  // Alias for getStudiosForBooking with the same implementation
  async getBookingStudios(bookingId: number): Promise<Studio[]> {
    return this.getStudiosForBooking(bookingId);
  }
  
  // Link a single booking to a studio
  async linkBookingToStudio(bookingId: number, studioId: number): Promise<BookingStudio> {
    // Check if link already exists
    const existingLinks = await this.getBookingStudioLinks(bookingId);
    const existingLink = existingLinks.find(link => link.studioId === studioId);
    if (existingLink) {
      return existingLink;
    }
    
    // Create new link
    const id = this.bookingStudioIdCounter++;
    const link: BookingStudio = { id, bookingId, studioId };
    const key = `${bookingId}-${studioId}`;
    this.bookingStudios.set(key, link);
    
    return link;
  }
  
  // Check for booking conflicts with a specific studio
  async checkBookingConflicts(studioId: number, start: Date, end: Date, excludeBookingId: number | null): Promise<Booking[]> {
    // Get all bookings linked to this studio
    const allBookings = Array.from(this.bookings.values());
    const studioBookings: Booking[] = [];
    
    // Check direct studio assignments (legacy)
    for (const booking of allBookings) {
      if (booking.studioId === studioId) {
        studioBookings.push(booking);
      }
    }
    
    // Check booking-studio links
    const allLinks = Array.from(this.bookingStudios.values());
    for (const link of allLinks) {
      if (link.studioId === studioId) {
        const booking = await this.getBooking(link.bookingId);
        if (booking && !studioBookings.some(b => b.id === booking.id)) {
          studioBookings.push(booking);
        }
      }
    }
    
    // Filter out the booking being updated if excludeBookingId is provided
    const otherBookings = excludeBookingId 
      ? studioBookings.filter(booking => booking.id !== excludeBookingId) 
      : studioBookings;
    
    // Find conflicts
    const startTime = start.getTime();
    const endTime = end.getTime();
    
    return otherBookings.filter(booking => {
      const bookingStart = new Date(booking.start).getTime();
      const bookingEnd = new Date(booking.end).getTime();
      
      return (
        (startTime >= bookingStart && startTime < bookingEnd) || // new booking starts during existing booking
        (endTime > bookingStart && endTime <= bookingEnd) ||    // new booking ends during existing booking
        (startTime <= bookingStart && endTime >= bookingEnd)    // new booking spans existing booking
      );
    });
  }
  
  async copyBookingToMultipleDates(bookingId: number, dates: Date[]): Promise<Booking[]> {
    // Get the original booking
    const originalBooking = await this.getBooking(bookingId);
    if (!originalBooking) {
      console.error(`Original booking with ID ${bookingId} not found`);
      return [];
    }
    
    console.log(`Copying booking ${bookingId} (${originalBooking.title}) to ${dates.length} dates`);
    
    // Get the studios linked to this booking
    const linkedStudios = await this.getStudiosForBooking(bookingId);
    const studioIds = linkedStudios.map(studio => studio.id);
    
    // Calculate duration of the original booking in milliseconds
    const origStart = new Date(originalBooking.start);
    const origEnd = new Date(originalBooking.end);
    const durationMs = origEnd.getTime() - origStart.getTime();
    
    // For each target date, create a new booking
    const newBookings: Booking[] = [];
    
    for (const targetDate of dates) {
      // Skip if the target date is the same as the original booking's date
      const compareOrigStartDay = new Date(origStart);
      compareOrigStartDay.setHours(0, 0, 0, 0);
      
      const compareTargetDay = new Date(targetDate);
      compareTargetDay.setHours(0, 0, 0, 0);
      
      if (compareOrigStartDay.getTime() === compareTargetDay.getTime()) {
        console.log(`Skipping date ${targetDate.toISOString()} as it's the same as the original booking's date`);
        continue;
      }
      
      // Create a new start time with the same time of day but on the target date
      // First create a clean date object from the target date to ensure it's in the right timezone
      console.log(`Original start: ${origStart.toISOString()}, Target date: ${targetDate.toISOString()}`);
      
      // Extract the date parts from the target date
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();
      const targetDay = targetDate.getDate();
      
      // Create a new date by cloning the original start but with the target date's year, month, and day
      // This preserves the time values and properly handles timezone boundaries
      const newStart = new Date(origStart);
      newStart.setFullYear(targetYear);
      newStart.setMonth(targetMonth);
      newStart.setDate(targetDay);
      
      console.log(`New start time: ${newStart.toISOString()} (using timezone-aware approach)`);
      
      // Create a new end time based on the duration
      const newEnd = new Date(newStart.getTime() + durationMs);
      console.log(`New end time: ${newEnd.toISOString()}`);
      
      // Add debugging to confirm correct date (using toISOString instead of format)
      console.log(`Original date: ${origStart.toISOString().split('T')[0]}`);
      console.log(`Target date: ${targetDate.toISOString().split('T')[0]}`);
      console.log(`New date: ${newStart.toISOString().split('T')[0]}`);
      
      // Create a new booking based on the original
      const newBookingData: InsertBooking = {
        title: originalBooking.title,
        description: originalBooking.description,
        type: originalBooking.type,
        userId: originalBooking.userId,
        start: newStart,
        end: newEnd,
        studioId: originalBooking.studioId,
        pcrRoomId: originalBooking.pcrRoomId,
        templateId: originalBooking.templateId,
        notifyList: originalBooking.notifyList,
        severity: originalBooking.severity,
        color: originalBooking.color // Copy the original booking's color
      };
      
      // Create the new booking
      const newBooking = await this.createBooking(newBookingData);
      
      // Link the new booking to the same studios as the original
      if (studioIds.length > 0) {
        await this.createBookingStudioLinks(newBooking.id, studioIds);
      }
      
      newBookings.push(newBooking);
      console.log(`Created new booking with ID ${newBooking.id} for date ${targetDate.toISOString()}`);
    }
    
    return newBookings;
  }
  
  async createBookingStudioLinks(bookingId: number, studioIds: number[]): Promise<BookingStudio[]> {
    const createdLinks: BookingStudio[] = [];
    
    for (const studioId of studioIds) {
      const id = this.bookingStudioIdCounter++;
      const key = `${bookingId}-${studioId}`;
      const link: BookingStudio = { id, bookingId, studioId };
      
      this.bookingStudios.set(key, link);
      createdLinks.push(link);
    }
    
    return createdLinks;
  }
  
  async deleteBookingStudioLinks(bookingId: number): Promise<boolean> {
    let deleted = false;
    
    // Find and delete all links for this booking
    const keysToDelete: string[] = [];
    this.bookingStudios.forEach((link, key) => {
      if (link.bookingId === bookingId) {
        keysToDelete.push(key);
      }
    });
    
    // Delete them
    keysToDelete.forEach(key => {
      this.bookingStudios.delete(key);
      deleted = true;
    });
    
    return deleted;
  }

  // Notification methods
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const newNotification: Notification = { 
      ...notification, 
      id, 
      read: false, 
      createdAt: new Date() 
    };
    this.notifications.set(id, newNotification);
    return newNotification;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((notification) => notification.userId === userId)
      .sort((a, b) => {
        // Sort by creation date, newest first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification: Notification = { ...notification, read: true };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }

  // Notification Group methods
  async getNotificationGroup(id: number): Promise<NotificationGroup | undefined> {
    return this.notificationGroups.get(id);
  }

  async getNotificationGroupByType(groupType: string): Promise<NotificationGroup | undefined> {
    return Array.from(this.notificationGroups.values()).find(
      (group) => group.groupType === groupType
    );
  }

  async getAllNotificationGroups(): Promise<NotificationGroup[]> {
    return Array.from(this.notificationGroups.values());
  }

  async createNotificationGroup(group: InsertNotificationGroup): Promise<NotificationGroup> {
    const id = this.notificationGroupIdCounter++;
    const newGroup: NotificationGroup = { ...group, id };
    this.notificationGroups.set(id, newGroup);
    return newGroup;
  }

  async updateNotificationGroup(id: number, data: Partial<InsertNotificationGroup>): Promise<NotificationGroup | undefined> {
    const group = await this.getNotificationGroup(id);
    if (!group) return undefined;
    
    const updatedGroup: NotificationGroup = { ...group, ...data };
    this.notificationGroups.set(id, updatedGroup);
    return updatedGroup;
  }
  
  async deleteNotificationGroup(id: number): Promise<boolean> {
    return this.notificationGroups.delete(id);
  }

  // System Settings methods
  async getSiteName(): Promise<string> {
    const siteSetting = await this.getSystemSetting('siteName');
    return siteSetting?.value || 'BookStud.io';
  }
  
  async setSiteName(name: string): Promise<SystemSetting> {
    return this.upsertSystemSetting({ 
      key: 'siteName', 
      value: name 
    });
  }
  
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    return Array.from(this.systemSettings.values()).find(
      (setting) => setting.key === key
    );
  }
  
  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return Array.from(this.systemSettings.values());
  }
  
  async upsertSystemSetting(data: InsertSystemSetting): Promise<SystemSetting> {
    // Try to find existing setting by key
    const existingSetting = await this.getSystemSetting(data.key);
    
    if (existingSetting) {
      // Update existing setting
      const updatedSetting: SystemSetting = { 
        ...existingSetting, 
        value: data.value,
        updatedAt: new Date()
      };
      this.systemSettings.set(existingSetting.id, updatedSetting);
      return updatedSetting;
    } else {
      // Create new setting
      const id = this.systemSettingIdCounter++;
      const newSetting: SystemSetting = { 
        ...data, 
        id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.systemSettings.set(id, newSetting);
      return newSetting;
    }
  }
  
  async deleteSystemSetting(key: string): Promise<boolean> {
    const setting = await this.getSystemSetting(key);
    if (!setting) return false;
    
    return this.systemSettings.delete(setting.id);
  }
}

// Database storage implementation
// Using connect-pg-simple already imported at the top of the file
const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  private users: Map<number, User>;
  private studios: Map<number, Studio>;
  private templates: Map<number, Template>;
  private bookings: Map<number, Booking>;
  private notifications: Map<number, Notification>;
  private notificationGroups: Map<number, NotificationGroup>;
  private pcrRooms: Map<number, PcrRoom>;
  private bookingStudios: Map<string, BookingStudio>;
  private systemSettings: Map<number, SystemSetting>;
  private bookingStudiosCache: BookingStudio[] = [];
  
  private userIdCounter: number;
  private studioIdCounter: number;
  private templateIdCounter: number;
  private bookingIdCounter: number;
  private notificationIdCounter: number;
  private notificationGroupIdCounter: number;
  private pcrRoomIdCounter: number;
  private bookingStudioIdCounter: number;
  private systemSettingIdCounter: number;
  
  public sessionStore: session.Store;
  
  constructor() {
    this.users = new Map();
    this.studios = new Map();
    this.templates = new Map();
    this.bookings = new Map();
    this.notifications = new Map();
    this.notificationGroups = new Map();
    this.pcrRooms = new Map();
    this.bookingStudios = new Map();
    this.systemSettings = new Map();
    
    this.userIdCounter = 1;
    this.studioIdCounter = 1;
    this.templateIdCounter = 1;
    this.bookingIdCounter = 1;
    this.notificationIdCounter = 1;
    this.notificationGroupIdCounter = 1;
    this.pcrRoomIdCounter = 1;
    this.bookingStudioIdCounter = 1;
    this.systemSettingIdCounter = 1;
    
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
    
    this.initializeData();
  }
  
  private async initializeData() {
    try {
      // First check db connection to prevent hanging
      try {
        await ensureConnection();
      } catch (connError) {
        console.warn('Database connection not ready during initialization. Storage will retry on API calls.');
        // Return early rather than hanging
        return;
      }
      
      // Check if there are any users already
      try {
        const usersList = await db.select().from(users);
        if (usersList.length === 0) {
          console.log("Initializing database with default data...");
          
          // Create initial admin user
          const adminUser: InsertUser = {
            username: "admin",
            password: "admin123", // In production, this should be hashed
            email: "admin@studios.com",
            name: "Admin User",
            role: "admin"
          };
          await db.insert(users).values(adminUser);
          
          // Create producer user
          const producerUser: InsertUser = {
            username: "producer",
            password: "producer123",
            email: "producer@studios.com",
            name: "Producer User",
            role: "producer"
          };
          await db.insert(users).values(producerUser);
          
          // Create engineer user
          const engineerUser: InsertUser = {
            username: "engineer",
            password: "engineer123",
            email: "engineer@studios.com",
            name: "Engineer User",
            role: "engineer"
          };
          await db.insert(users).values(engineerUser);
          
          // Create initial studios
          for (let i = 1; i <= 20; i++) {
            const studio: InsertStudio = {
              name: `Studio ${i}`,
              description: `Television studio ${i} with full production capabilities`,
              status: "available"
            };
            await db.insert(studios).values(studio);
          }
          
          console.log("Database initialization complete.");
        }
      } catch (err) {
        console.warn('Error initializing database:', err);
      }
      
      try {
        // Load existing data into memory for faster access
        const allUsers = await db.select().from(users);
        allUsers.forEach(user => {
          this.users.set(user.id, user);
          this.userIdCounter = Math.max(this.userIdCounter, user.id + 1);
        });
        
        const allStudios = await db.select().from(studios);
        allStudios.forEach(studio => {
          this.studios.set(studio.id, studio);
          this.studioIdCounter = Math.max(this.studioIdCounter, studio.id + 1);
        });
        
        const allTemplates = await db.select().from(templates);
        allTemplates.forEach(template => {
          this.templates.set(template.id, template);
          this.templateIdCounter = Math.max(this.templateIdCounter, template.id + 1);
        });
        
        const allBookings = await db.select().from(bookings);
        allBookings.forEach(booking => {
          this.bookings.set(booking.id, booking);
          this.bookingIdCounter = Math.max(this.bookingIdCounter, booking.id + 1);
        });
      
        // Load booking-studio links
        try {
          const allBookingStudioLinks = await db.select().from(bookingStudios);
          allBookingStudioLinks.forEach(link => {
            this.bookingStudios.set(`${link.bookingId}-${link.studioId}`, link);
            this.bookingStudioIdCounter = Math.max(this.bookingStudioIdCounter, link.id + 1);
          });
        } catch (error) {
          console.log("Booking-studio links table might not exist yet. Initializing empty map.");
          this.bookingStudios = new Map();
          this.bookingStudioIdCounter = 1;
        }
      
        // Load PCR rooms data
        try {
          const allPcrRooms = await db.select().from(pcrRooms);
          this.pcrRooms = new Map(); // Ensure pcrRooms is initialized
          allPcrRooms.forEach(pcrRoom => {
            this.pcrRooms.set(pcrRoom.id, pcrRoom);
            this.pcrRoomIdCounter = Math.max(this.pcrRoomIdCounter, pcrRoom.id + 1);
          });
        } catch (error) {
          console.log("PCR rooms table might not exist yet. Initializing empty map.");
          this.pcrRooms = new Map();
          this.pcrRoomIdCounter = 1;
        }
      
        const allNotifications = await db.select().from(notifications);
        allNotifications.forEach(notification => {
          this.notifications.set(notification.id, notification);
          this.notificationIdCounter = Math.max(this.notificationIdCounter, notification.id + 1);
        });
        
        // We'll handle notification groups with in-memory implementation for now
        // since the table might not exist yet
        this.notificationGroups = new Map();
        this.notificationGroupIdCounter = 1;
        
        // Set up default notification groups in memory
        const defaultGroups = [
          {
            id: this.notificationGroupIdCounter++,
            name: "Camera Operators",
            email: "camera-team@studios.com",
            groupType: "department",
            description: "All camera operators and video technicians",
            enabled: true
          },
          {
            id: this.notificationGroupIdCounter++,
            name: "Lighting Technicians",
            email: "lighting@studios.com",
            groupType: "department",
            description: "Lighting setup and operation staff",
            enabled: true
          },
          {
            id: this.notificationGroupIdCounter++,
            name: "Directors",
            email: "directors@studios.com",
            groupType: "department",
            description: "Program directors and assistant directors",
            enabled: true
          },
          {
            id: this.notificationGroupIdCounter++,
            name: "Sound Engineers",
            email: "sound@studios.com",
            groupType: "department",
            description: "Audio and sound personnel",
            enabled: true
          },
          {
            id: this.notificationGroupIdCounter++,
            name: "Production Assistants",
            email: "pa@studios.com",
            groupType: "department",
            description: "PAs and floor managers",
            enabled: true
          },
          {
            id: this.notificationGroupIdCounter++,
            name: "Engineering",
            email: "engineering@studios.com",
            groupType: "department",
            description: "Engineering and maintenance team",
            enabled: true
          },
          {
            id: this.notificationGroupIdCounter++,
            name: "IT Support",
            email: "it@studios.com",
            groupType: "department",
            description: "IT support and network team",
            enabled: true
          },
          {
            id: this.notificationGroupIdCounter++,
            name: "All Staff",
            email: "all-staff@studios.com",
            groupType: "facility",
            description: "All facility personnel",
            enabled: true
          }
        ];
        
        // Add default groups to our in-memory store
        for (const group of defaultGroups) {
          this.notificationGroups.set(group.id, group);
        }
        
        console.log("Default notification groups created in memory.");
        
        // Note: We'll need to run the db migration to create the notification_groups table
        // before we can use the database for notification groups
        
        // Load system settings from database
        try {
          const allSystemSettings = await db.select().from(systemSettings);
          this.systemSettings = new Map(); // Ensure systemSettings is initialized
          allSystemSettings.forEach(setting => {
            this.systemSettings.set(setting.id, setting);
            this.systemSettingIdCounter = Math.max(this.systemSettingIdCounter, setting.id + 1);
          });
          
          // If no site name is set, create default
          const siteNameSetting = allSystemSettings.find(s => s.key === 'siteName');
          if (!siteNameSetting) {
            console.log("Creating default site name setting");
            await this.setSiteName('BookStud.io');
          }
          
          console.log("System settings loaded from database");
        } catch (error) {
          console.log("System settings table might not exist yet. Initializing empty map.");
          this.systemSettings = new Map();
          this.systemSettingIdCounter = 1;
          
          // Set default site name in memory
          await this.setSiteName('BookStud.io');
        }
        
      } catch (error) {
        console.error("Error initializing database:", error);
      }
    } catch (outerError) {
      console.error("Outer initialization error:", outerError);
    }
  }
  
  // User management methods
  async getUser(id: number): Promise<User | undefined> {
    // Check memory cache first
    if (this.users.has(id)) {
      return this.users.get(id);
    }
    
    // If not in cache, fetch from database
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      if (user) {
        this.users.set(id, user);
      }
      return user;
    } catch (error) {
      console.error(`Error getting user with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    // Check memory cache first
    const cachedUser = Array.from(this.users.values()).find(user => user.username === username);
    if (cachedUser) {
      return cachedUser;
    }
    
    // If not in cache, fetch from database
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      if (user) {
        this.users.set(user.id, user);
      }
      return user;
    } catch (error) {
      console.error(`Error getting user with username ${username}:`, error);
      return undefined;
    }
  }
  
  async getAllUsers(): Promise<User[]> {
    try {
      const allUsers = await db.select().from(users);
      // Update cache
      allUsers.forEach(user => {
        this.users.set(user.id, user);
      });
      return allUsers;
    } catch (error) {
      console.error("Error getting all users:", error);
      return Array.from(this.users.values());
    }
  }
  
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    try {
      const user = await this.getUser(id);
      if (!user) return undefined;
      
      const [updatedUser] = await db.update(users)
        .set(data)
        .where(eq(users.id, id))
        .returning();
        
      if (updatedUser) {
        this.users.set(id, updatedUser);
      }
      return updatedUser;
    } catch (error) {
      console.error(`Error updating user with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteUser(id: number): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, id));
      if (result) {
        this.users.delete(id);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting user with ID ${id}:`, error);
      return false;
    }
  }
  
  // Studio management
  async getStudio(id: number): Promise<Studio | undefined> {
    // Check memory cache first
    if (this.studios.has(id)) {
      return this.studios.get(id);
    }
    
    // If not in cache, fetch from database
    try {
      const [studio] = await db.select().from(studios).where(eq(studios.id, id));
      if (studio) {
        this.studios.set(id, studio);
      }
      return studio;
    } catch (error) {
      console.error(`Error getting studio with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async createUser(user: InsertUser): Promise<User> {
    try {
      const [newUser] = await db.insert(users).values(user).returning();
      this.users.set(newUser.id, newUser);
      this.userIdCounter = Math.max(this.userIdCounter, newUser.id + 1);
      return newUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }
  
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    try {
      const [updatedUser] = await db.update(users).set(data).where(eq(users.id, id)).returning();
      if (updatedUser) {
        this.users.set(id, updatedUser);
      }
      return updatedUser;
    } catch (error) {
      console.error(`Error updating user with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteUser(id: number): Promise<boolean> {
    try {
      // First check if user exists
      const user = await this.getUser(id);
      if (!user) {
        return false;
      }
      
      // Delete the user
      const [deletedUser] = await db.delete(users).where(eq(users.id, id)).returning();
      
      if (deletedUser) {
        // Remove from cache
        this.users.delete(id);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error deleting user with ID ${id}:`, error);
      return false;
    }
  }
  
  async getAllUsers(): Promise<User[]> {
    try {
      const allUsers = await db.select().from(users);
      allUsers.forEach(user => {
        this.users.set(user.id, user);
      });
      return allUsers;
    } catch (error) {
      console.error("Error getting all users:", error);
      return Array.from(this.users.values());
    }
  }
  
  // Studio management
  async getStudio(id: number): Promise<Studio | undefined> {
    if (this.studios.has(id)) {
      return this.studios.get(id);
    }
    
    try {
      const [studio] = await db.select().from(studios).where(eq(studios.id, id));
      if (studio) {
        this.studios.set(id, studio);
      }
      return studio;
    } catch (error) {
      console.error(`Error getting studio with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async getAllStudios(): Promise<Studio[]> {
    try {
      const allStudios = await db.select().from(studios);
      allStudios.forEach(studio => {
        this.studios.set(studio.id, studio);
      });
      // Sort studios alphabetically by name
      return allStudios.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting all studios:", error);
      // Also sort the fallback array
      return Array.from(this.studios.values())
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  }
  
  async createStudio(studio: InsertStudio): Promise<Studio> {
    try {
      const [newStudio] = await db.insert(studios).values(studio).returning();
      this.studios.set(newStudio.id, newStudio);
      this.studioIdCounter = Math.max(this.studioIdCounter, newStudio.id + 1);
      return newStudio;
    } catch (error) {
      console.error("Error creating studio:", error);
      throw error;
    }
  }
  
  async updateStudioStatus(id: number, status: string): Promise<Studio | undefined> {
    try {
      const [updatedStudio] = await db.update(studios).set({ status }).where(eq(studios.id, id)).returning();
      if (updatedStudio) {
        this.studios.set(id, updatedStudio);
      }
      return updatedStudio;
    } catch (error) {
      console.error(`Error updating studio status for ID ${id}:`, error);
      return undefined;
    }
  }
  
  async updateStudio(id: number, data: Partial<InsertStudio>): Promise<Studio | undefined> {
    try {
      const [updatedStudio] = await db.update(studios).set(data).where(eq(studios.id, id)).returning();
      if (updatedStudio) {
        this.studios.set(id, updatedStudio);
      }
      return updatedStudio;
    } catch (error) {
      console.error(`Error updating studio ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteStudio(id: number): Promise<boolean> {
    try {
      // First check if the studio exists
      const studio = await this.getStudio(id);
      if (!studio) {
        return false;
      }
      
      // Check if the studio has any bookings
      const studioBookings = await this.getBookingsByStudio(id);
      if (studioBookings.length > 0) {
        console.error(`Cannot delete studio ${id} because it has active bookings`);
        return false;
      }
      
      // Delete the studio from the database
      const result = await db.delete(studios).where(eq(studios.id, id));
      
      // If the delete was successful, also remove from memory cache
      if (result.rowCount && result.rowCount > 0) {
        // Also remove from in-memory cache
        this.studios.delete(id);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error deleting studio with ID ${id}:`, error);
      return false;
    }
  }
  
  // Template management
  async getTemplate(id: number): Promise<Template | undefined> {
    if (this.templates.has(id)) {
      return this.templates.get(id);
    }
    
    try {
      const [template] = await db.select().from(templates).where(eq(templates.id, id));
      if (template) {
        // Parse JSON fields that might be stored as strings
        const processedTemplate = this.processTemplateJson(template);
        this.templates.set(id, processedTemplate);
        return processedTemplate;
      }
      return template;
    } catch (error) {
      console.error(`Error getting template with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async getAllTemplates(): Promise<Template[]> {
    try {
      const allTemplates = await db.select().from(templates);
      const processedTemplates = allTemplates.map(template => this.processTemplateJson(template));
      processedTemplates.forEach(template => {
        this.templates.set(template.id, template);
      });
      return processedTemplates;
    } catch (error) {
      console.error("Error getting all templates:", error);
      return Array.from(this.templates.values());
    }
  }
  
  async getTemplatesByUser(userId: number): Promise<Template[]> {
    try {
      const userTemplates = await db.select().from(templates).where(eq(templates.createdBy, userId));
      const processedTemplates = userTemplates.map(template => this.processTemplateJson(template));
      processedTemplates.forEach(template => {
        this.templates.set(template.id, template);
      });
      return processedTemplates;
    } catch (error) {
      console.error(`Error getting templates for user ID ${userId}:`, error);
      return Array.from(this.templates.values()).filter(template => template.createdBy === userId);
    }
  }

  // Helper method to process JSON fields in templates
  private processTemplateJson(template: any): Template {
    const processedTemplate = { ...template };
    
    // Parse studioIds if it's a JSON string
    if (typeof template.studioIds === 'string') {
      try {
        processedTemplate.studioIds = JSON.parse(template.studioIds);
        console.log(`Template ${template.id}: Parsed studioIds from "${template.studioIds}" to`, processedTemplate.studioIds);
      } catch (error) {
        console.warn(`Template ${template.id}: Failed to parse studioIds "${template.studioIds}":`, error);
        processedTemplate.studioIds = [];
      }
    }
    
    // Parse notifyList if it's a JSON string
    if (typeof template.notifyList === 'string') {
      try {
        processedTemplate.notifyList = JSON.parse(template.notifyList);
        console.log(`Template ${template.id}: Parsed notifyList from "${template.notifyList}" to`, processedTemplate.notifyList);
      } catch (error) {
        console.warn(`Template ${template.id}: Failed to parse notifyList "${template.notifyList}":`, error);
        processedTemplate.notifyList = [];
      }
    }
    
    return processedTemplate;
  }
  
  // PCR Room methods
  async getPcrRoom(id: number): Promise<PcrRoom | undefined> {
    if (!this.pcrRooms) {
      this.pcrRooms = new Map();
    }
    
    if (this.pcrRooms.has(id)) {
      return this.pcrRooms.get(id);
    }
    
    try {
      const [pcrRoom] = await db.select().from(pcrRooms).where(eq(pcrRooms.id, id));
      if (pcrRoom) {
        this.pcrRooms.set(id, pcrRoom);
      }
      return pcrRoom;
    } catch (error) {
      console.error(`Error getting PCR room with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async getAllPcrRooms(): Promise<PcrRoom[]> {
    try {
      const allPcrRooms = await db.select().from(pcrRooms);
      allPcrRooms.forEach(room => {
        this.pcrRooms.set(room.id, room);
      });
      // Sort PCR rooms alphabetically by name
      return allPcrRooms.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting all PCR rooms:", error);
      // Also sort the fallback array
      return Array.from(this.pcrRooms.values())
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  }
  
  async createPcrRoom(pcrRoom: InsertPcrRoom): Promise<PcrRoom> {
    try {
      // Insert new PCR room
      const [newPcrRoom] = await db.insert(pcrRooms).values(pcrRoom).returning();
      
      // Add to cache
      this.pcrRooms.set(newPcrRoom.id, newPcrRoom);
      
      // Get the current max ID from the database to ensure we're in sync
      const maxResult = await db.select({ maxId: sql`MAX(id)` }).from(pcrRooms);
      const maxId = maxResult[0]?.maxId || 0;
      
      // Update the counter
      this.pcrRoomIdCounter = maxId + 1;
      
      console.log(`Created PCR room with ID ${newPcrRoom.id}, current max ID: ${maxId}, next ID: ${this.pcrRoomIdCounter}`);
      
      return newPcrRoom;
    } catch (error) {
      console.error("Error creating PCR room:", error);
      throw error;
    }
  }
  
  async updatePcrRoomStatus(id: number, status: string): Promise<PcrRoom | undefined> {
    try {
      const [updatedPcrRoom] = await db.update(pcrRooms)
        .set({ status })
        .where(eq(pcrRooms.id, id))
        .returning();
      
      if (updatedPcrRoom) {
        this.pcrRooms.set(id, updatedPcrRoom);
      }
      return updatedPcrRoom;
    } catch (error) {
      console.error(`Error updating PCR room status with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async updatePcrRoom(id: number, updateData: Partial<Omit<PcrRoom, 'id'>>): Promise<PcrRoom | undefined> {
    try {
      console.log(`Updating PCR room ${id} with data:`, JSON.stringify(updateData));
      
      // Don't allow changing id
      const { id: _, ...dataToUpdate } = updateData as any;
      
      console.log(`Processed data to update:`, JSON.stringify(dataToUpdate));
      
      const [updatedPcrRoom] = await db.update(pcrRooms)
        .set(dataToUpdate)
        .where(eq(pcrRooms.id, id))
        .returning();
      
      console.log(`PCR room update result:`, updatedPcrRoom ? JSON.stringify(updatedPcrRoom) : "null");
      
      if (updatedPcrRoom) {
        this.pcrRooms.set(id, updatedPcrRoom);
        console.log(`Updated PCR room in cache with ID ${id}`);
      } else {
        console.log(`No PCR room was updated with ID ${id}`);
      }
      
      return updatedPcrRoom;
    } catch (error) {
      console.error(`Error updating PCR room with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deletePcrRoom(id: number): Promise<boolean> {
    try {
      // First check if PCR room exists
      const pcrRoom = await this.getPcrRoom(id);
      if (!pcrRoom) {
        return false;
      }
      
      // Check for active bookings with this PCR room
      const bookingsWithPcrRoom = await db.select().from(bookings)
        .where(eq(bookings.pcrRoomId, id));
      
      if (bookingsWithPcrRoom.length > 0) {
        console.error(`Cannot delete PCR room with ID ${id} as it has active bookings`);
        return false;
      }
      
      // Delete the PCR room
      const [deletedPcrRoom] = await db.delete(pcrRooms)
        .where(eq(pcrRooms.id, id))
        .returning();
      
      if (deletedPcrRoom) {
        // Remove from cache
        this.pcrRooms.delete(id);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error deleting PCR room with ID ${id}:`, error);
      return false;
    }
  }
  
  async createTemplate(template: InsertTemplate): Promise<Template> {
    try {
      const [newTemplate] = await db.insert(templates).values(template).returning();
      this.templates.set(newTemplate.id, newTemplate);
      this.templateIdCounter = Math.max(this.templateIdCounter, newTemplate.id + 1);
      return newTemplate;
    } catch (error) {
      console.error("Error creating template:", error);
      throw error;
    }
  }
  
  async updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined> {
    try {
      const [updatedTemplate] = await db.update(templates).set(data).where(eq(templates.id, id)).returning();
      if (updatedTemplate) {
        this.templates.set(id, updatedTemplate);
      }
      return updatedTemplate;
    } catch (error) {
      console.error(`Error updating template ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteTemplate(id: number): Promise<boolean> {
    try {
      const result = await db.delete(templates).where(eq(templates.id, id));
      if (result.rowCount > 0) {
        this.templates.delete(id);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting template with ID ${id}:`, error);
      return false;
    }
  }
  
  // Booking management
  async getBooking(id: number): Promise<Booking | undefined> {
    if (this.bookings.has(id)) {
      return this.bookings.get(id);
    }
    
    try {
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
      if (booking) {
        this.bookings.set(id, booking);
      }
      return booking;
    } catch (error) {
      console.error(`Error getting booking with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async getAllBookings(): Promise<Booking[]> {
    try {
      // Modified select to use db.query for safer access
      const allBookings = await db.query.bookings.findMany();
      allBookings.forEach(booking => {
        this.bookings.set(booking.id, booking);
      });
      return allBookings;
    } catch (error) {
      console.error("Error getting all bookings:", error);
      return Array.from(this.bookings.values());
    }
  }
  
  async getBookingsByStudio(studioId: number | null): Promise<Booking[]> {
    try {
      let studioBookings = [];
      
      if (studioId === null) {
        // Get facility-wide alerts (maintenance, IT support)
        studioBookings = await db.select().from(bookings).where(isNull(bookings.studioId));
      } else {
        // First get bookings directly linked to this studio (legacy studioId field)
        const directBookings = await db.select()
          .from(bookings)
          .where(eq(bookings.studioId, studioId));
          
        studioBookings = [...directBookings];
        
        // Then get bookings from the junction table
        const bookingLinks = await db.select({
            bookingId: bookingStudios.bookingId
          })
          .from(bookingStudios)
          .where(eq(bookingStudios.studioId, studioId));
          
        if (bookingLinks.length > 0) {
          const bookingIds = bookingLinks.map(link => link.bookingId);
          
          const linkedBookings = await db.select()
            .from(bookings)
            .where(inArray(bookings.id, bookingIds));
            
          // Add to the results, avoiding duplicates
          const existingIds = new Set(studioBookings.map(booking => booking.id));
          
          for (const booking of linkedBookings) {
            if (!existingIds.has(booking.id)) {
              studioBookings.push(booking);
              existingIds.add(booking.id);
            }
          }
        }
      }
      
      // Add to cache
      studioBookings.forEach(booking => {
        this.bookings.set(booking.id, booking);
      });
      
      return studioBookings;
    } catch (error) {
      console.error(`Error getting bookings for studio ID ${studioId}:`, error);
      // Fallback to memory cache
      if (studioId === null) {
        return Array.from(this.bookings.values()).filter(booking => booking.studioId === null);
      } else {
        // We should check both the studioId field and the booking_studios table
        // But since we don't have the junction table in memory, we can only check studioId
        // This is incomplete, but better than nothing
        return Array.from(this.bookings.values()).filter(booking => booking.studioId === studioId);
      }
    }
  }
  
  async getBookingsByUser(userId: number): Promise<Booking[]> {
    try {
      const userBookings = await db.select().from(bookings).where(eq(bookings.userId, userId));
      userBookings.forEach(booking => {
        this.bookings.set(booking.id, booking);
      });
      return userBookings;
    } catch (error) {
      console.error(`Error getting bookings for user ID ${userId}:`, error);
      return Array.from(this.bookings.values()).filter(booking => booking.userId === userId);
    }
  }
  
  async getBookingsByDateRange(start: Date, end: Date): Promise<Booking[]> {
    try {
      // Adjust the start date to the beginning of the day to capture all bookings for that day
      const adjustedStart = new Date(start);
      adjustedStart.setHours(0, 0, 0, 0);
      
      console.log(`[Storage] Fetching bookings between ${adjustedStart.toISOString()} and ${end.toISOString()}`);
      
      // Fallback to in-memory approach to avoid PostgreSQL reserved keyword issues
      // Get all bookings and filter them
      const allBookings = await this.getAllBookings();
      
      // Now filter the bookings to those in the date range
      const dateRangeBookings = allBookings.filter(booking => {
        const bookingStart = new Date(booking.start);
        const bookingEnd = new Date(booking.end);
        
        return (
          (bookingStart >= adjustedStart && bookingStart <= end) ||
          (bookingEnd >= adjustedStart && bookingEnd <= end) ||
          (bookingStart <= adjustedStart && bookingEnd >= adjustedStart)
        );
      });
      
      // Remove the manual addition of bookings that don't match the date range
      // This was causing bookings from dates outside the range to appear
      
      console.log(`[Storage] Found ${dateRangeBookings.length} bookings in date range ${adjustedStart.toISOString()} to ${end.toISOString()}`);
      dateRangeBookings.forEach(booking => {
        console.log(`  - ID: ${booking.id}, Title: ${booking.title}, Start: ${new Date(booking.start).toISOString()}, End: ${new Date(booking.end).toISOString()}`);
      });
      
      return dateRangeBookings;
    } catch (error) {
      console.error(`Error getting bookings for date range ${start} to ${end}:`, error);
      // Fall back to basic in-memory filtering if something went wrong
      // First adjust the start date to the beginning of the day
      const adjustedStart = new Date(start);
      adjustedStart.setHours(0, 0, 0, 0);
      
      const filteredBookings = Array.from(this.bookings.values()).filter(booking => {
        const bookingStart = new Date(booking.start);
        const bookingEnd = new Date(booking.end);
        
        return (
          (bookingStart >= adjustedStart && bookingStart <= end) ||
          (bookingEnd >= adjustedStart && bookingEnd <= end) ||
          (bookingStart <= adjustedStart && bookingEnd >= adjustedStart)
        );
      });
      
      // Remove special handling for ID 12
      
      return filteredBookings;
    }
  }
  
  async createBooking(booking: InsertBooking): Promise<Booking> {
    try {
      // Add default createdAt if not provided
      const bookingWithDefaults = {
        ...booking,
        createdAt: new Date()
      };
      
      const [newBooking] = await db.insert(bookings).values(bookingWithDefaults).returning();
      this.bookings.set(newBooking.id, newBooking);
      this.bookingIdCounter = Math.max(this.bookingIdCounter, newBooking.id + 1);
      return newBooking;
    } catch (error) {
      console.error("Error creating booking:", error);
      throw error;
    }
  }
  
  async updateBooking(id: number, data: Partial<InsertBooking>, studioIds?: number[]): Promise<Booking | undefined> {
    try {
      // Process dates to ensure they're in the correct format
      const processedData = { ...data };
      
      // Extract studio IDs if they are present in the data
      // We don't want to store studioIds in the bookings table itself
      // They will be stored in the booking_studios junction table
      
      // Convert string dates to Date objects
      if (processedData.start && typeof processedData.start === 'string') {
        processedData.start = new Date(processedData.start);
      }
      
      if (processedData.end && typeof processedData.end === 'string') {
        processedData.end = new Date(processedData.end);
      }
      
      console.log(`Updating booking ${id} with data:`, processedData);
      
      const [updatedBooking] = await db
        .update(bookings)
        .set(processedData)
        .where(eq(bookings.id, id))
        .returning();
        
      if (updatedBooking) {
        // Update the cache
        this.bookings.set(id, updatedBooking);
        
        // If studioIds are provided, update the booking-studio links
        if (studioIds && Array.isArray(studioIds)) {
          console.log(`Updating studio links for booking ${id} with studios:`, studioIds);
          
          // First delete any existing links
          await this.deleteBookingStudioLinks(id);
          
          // Then create new links
          if (studioIds.length > 0) {
            await this.createBookingStudioLinks(id, studioIds);
          }
        }
      }
      
      return updatedBooking;
    } catch (error) {
      console.error(`Error updating booking with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteBooking(id: number): Promise<boolean> {
    try {
      // First delete any studio links
      await this.deleteBookingStudioLinks(id);
      
      // Then delete the actual booking
      const result = await db.delete(bookings).where(eq(bookings.id, id));
      if (result.rowCount > 0) {
        this.bookings.delete(id);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting booking with ID ${id}:`, error);
      return false;
    }
  }
  
  // Booking studios junction table operations
  // This implementation has been moved to handle both DatabaseStorage and MemStorage
  
  async getStudiosForBooking(bookingId: number): Promise<Studio[]> {
    try {
      // Get links from the junction table
      const links = await this.getBookingStudioLinks(bookingId);
      
      if (links.length === 0) {
        // If no links found, try to get the legacy studioId
        const booking = await this.getBooking(bookingId);
        if (booking && booking.studioId) {
          const studio = await this.getStudio(booking.studioId);
          return studio ? [studio] : [];
        }
        return [];
      }
      
      // Get all studio IDs
      const studioIds = links.map(link => link.studioId);
      
      // Fetch actual studios
      const studios: Studio[] = [];
      for (const studioId of studioIds) {
        const studio = await this.getStudio(studioId);
        if (studio) {
          studios.push(studio);
        }
      }
      
      return studios;
    } catch (error) {
      console.error(`Error getting studios for booking ID ${bookingId}:`, error);
      return [];
    }
  }
  
  async createBookingStudioLinks(
    bookingId: number, 
    studioIds: number[]
  ): Promise<BookingStudio[]> {
    try {
      if (studioIds.length === 0) {
        return [];
      }
      
      const links = studioIds.map(studioId => ({
        bookingId,
        studioId
      }));
      
      return db.insert(bookingStudios)
        .values(links)
        .returning();
    } catch (error) {
      console.error(`Error creating studio links for booking ID ${bookingId}:`, error);
      throw error;
    }
  }
  
  async deleteBookingStudioLinks(bookingId: number): Promise<boolean> {
    try {
      const result = await db.delete(bookingStudios)
        .where(eq(bookingStudios.bookingId, bookingId));
      
      return true; // Return true regardless of rowCount as it's okay if there were no links
    } catch (error) {
      console.error(`Error deleting studio links for booking ID ${bookingId}:`, error);
      return false;
    }
  }
  
  // Notification management
  async createNotification(notification: InsertNotification): Promise<Notification> {
    try {
      // Add defaults
      const notificationWithDefaults = {
        ...notification,
        read: false,
        createdAt: new Date()
      };
      
      const [newNotification] = await db.insert(notifications).values(notificationWithDefaults).returning();
      this.notifications.set(newNotification.id, newNotification);
      this.notificationIdCounter = Math.max(this.notificationIdCounter, newNotification.id + 1);
      return newNotification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }
  
  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    try {
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt));
      
      userNotifications.forEach(notification => {
        this.notifications.set(notification.id, notification);
      });
      return userNotifications;
    } catch (error) {
      console.error(`Error getting notifications for user ID ${userId}:`, error);
      return Array.from(this.notifications.values())
        .filter(notification => notification.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }
  
  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    try {
      const [updatedNotification] = await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, id))
        .returning();
      
      if (updatedNotification) {
        this.notifications.set(id, updatedNotification);
      }
      return updatedNotification;
    } catch (error) {
      console.error(`Error marking notification with ID ${id} as read:`, error);
      return undefined;
    }
  }

  // Notification Group methods using database
  async getNotificationGroup(id: number): Promise<NotificationGroup | undefined> {
    try {
      const [group] = await db
        .select()
        .from(notificationGroups)
        .where(eq(notificationGroups.id, id));
      
      return group;
    } catch (error) {
      console.error(`Error getting notification group with ID ${id}:`, error);
      // Fall back to in-memory cache if database query fails
      return this.notificationGroups.get(id);
    }
  }

  async getNotificationGroupByType(groupType: string): Promise<NotificationGroup | undefined> {
    try {
      const [group] = await db
        .select()
        .from(notificationGroups)
        .where(eq(notificationGroups.groupType, groupType));
      
      return group;
    } catch (error) {
      console.error(`Error getting notification group by type ${groupType}:`, error);
      // Fall back to in-memory cache if database query fails
      return Array.from(this.notificationGroups.values()).find(
        group => group.groupType === groupType
      );
    }
  }

  async getAllNotificationGroups(): Promise<NotificationGroup[]> {
    try {
      const groups = await db.select().from(notificationGroups);
      
      // Update the in-memory cache with database results
      groups.forEach(group => {
        this.notificationGroups.set(group.id, group);
      });
      
      // Update counter to ensure new IDs are unique
      if (groups.length > 0) {
        const maxId = Math.max(...groups.map(group => group.id));
        this.notificationGroupIdCounter = maxId + 1;
      }
      
      return groups;
    } catch (error) {
      console.error("Error getting all notification groups:", error);
      // Fall back to in-memory cache if database query fails
      return Array.from(this.notificationGroups.values());
    }
  }

  async createNotificationGroup(group: InsertNotificationGroup): Promise<NotificationGroup> {
    try {
      const [newGroup] = await db
        .insert(notificationGroups)
        .values(group)
        .returning();
      
      // Update in-memory cache and counter
      this.notificationGroups.set(newGroup.id, newGroup);
      this.notificationGroupIdCounter = Math.max(this.notificationGroupIdCounter, newGroup.id + 1);
      
      return newGroup;
    } catch (error) {
      console.error("Error creating notification group:", error);
      throw error;
    }
  }

  async updateNotificationGroup(id: number, data: Partial<InsertNotificationGroup>): Promise<NotificationGroup | undefined> {
    try {
      const [updatedGroup] = await db
        .update(notificationGroups)
        .set(data)
        .where(eq(notificationGroups.id, id))
        .returning();
      
      if (updatedGroup) {
        // Update in-memory cache
        this.notificationGroups.set(id, updatedGroup);
      }
      
      return updatedGroup;
    } catch (error) {
      console.error(`Error updating notification group with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteNotificationGroup(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(notificationGroups)
        .where(eq(notificationGroups.id, id));
      
      // Remove from in-memory cache
      this.notificationGroups.delete(id);
      
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting notification group with ID ${id}:`, error);
      return false;
    }
  }
  
  // Copy a booking to multiple dates
  async copyBookingToMultipleDates(bookingId: number, dates: Date[]): Promise<Booking[]> {
    try {
      // Get the original booking
      const originalBooking = await this.getBooking(bookingId);
      if (!originalBooking) {
        console.error(`Original booking with ID ${bookingId} not found`);
        return [];
      }
      
      console.log(`Copying booking ${bookingId} (${originalBooking.title}) to ${dates.length} dates`);
      
      // Get the studios linked to this booking
      const linkedStudios = await this.getStudiosForBooking(bookingId);
      const studioIds = linkedStudios.map(studio => studio.id);
      
      // Calculate duration of the original booking in milliseconds
      const origStart = new Date(originalBooking.start);
      const origEnd = new Date(originalBooking.end);
      const durationMs = origEnd.getTime() - origStart.getTime();
      
      // For each target date, create a new booking
      const newBookings: Booking[] = [];
      
      for (const targetDate of dates) {
        // Compare original booking date and target date to avoid duplication
        // Fix: Use UTC and ISO strings for more reliable date comparison
        const origStartDateStr = origStart.toISOString().split('T')[0];
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        if (origStartDateStr === targetDateStr) {
          console.log(`Skipping date ${targetDateStr} as it's the same as the original booking's date (${origStartDateStr})`);
          continue;
        }
        
        // Additional logging to debug date comparisons
        console.log(`Comparing dates - Original: ${origStartDateStr}, Target: ${targetDateStr}`);
        
        // CRITICAL FIX: Target date comes in as midnight, but we need to preserve original hour
        // Extract just the date part from targetDate (year, month, day)
        // Do NOT create a new Date directly from targetDate, as this preserves the midnight time
        const [targetYear, targetMonth, targetDateDay] = targetDateStr.split('-').map(num => parseInt(num));
        
        // Create a date with target date but original booking's time
        const newStart = new Date(Date.UTC(
          targetYear,
          targetMonth - 1, // JavaScript months are 0-indexed
          targetDateDay, // Use the renamed variable
          origStart.getUTCHours(),
          origStart.getUTCMinutes(),
          origStart.getUTCSeconds(),
          origStart.getUTCMilliseconds()
        ));
        
        // Log everything for debugging
        console.log(`Target date string: ${targetDateStr}, Year: ${targetYear}, Month: ${targetMonth}, Day: ${targetDateDay}`);
        console.log(`Original start: ${origStart.toISOString()}, UTC hours: ${origStart.getUTCHours()}`);
        console.log(`Target date: ${targetDate.toISOString()}, Created new start: ${newStart.toISOString()}`);
        
        // Create a new end time based on the duration
        const newEnd = new Date(newStart.getTime() + durationMs);
        console.log(`Original booking duration: ${durationMs}ms, New end: ${newEnd.toISOString()}`);

        // Ensure we're using the correct timezone when creating dates
        const facilityTimezone = process.env.FACILITY_TIMEZONE || 'America/Chicago';
        console.log(`Using facility timezone: ${facilityTimezone}`);
        console.log(`Date in local timezone: ${newStart.toLocaleString('en-US', { timeZone: facilityTimezone })}`);
        
        
        // Create a new booking based on the original
        const newBookingData: InsertBooking = {
          title: originalBooking.title,
          description: originalBooking.description,
          type: originalBooking.type,
          userId: originalBooking.userId,
          start: newStart,
          end: newEnd,
          studioId: originalBooking.studioId,
          pcrRoomId: originalBooking.pcrRoomId,
          templateId: originalBooking.templateId,
          notifyList: originalBooking.notifyList,
          severity: originalBooking.severity,
          color: originalBooking.color // Copy the original booking's color
        };
        
        // Create the new booking
        const newBooking = await this.createBooking(newBookingData);
        
        // Link the new booking to the same studios as the original
        if (studioIds.length > 0) {
          await this.createBookingStudioLinks(newBooking.id, studioIds);
        }
        
        newBookings.push(newBooking);
        console.log(`Created new booking with ID ${newBooking.id} for date ${targetDate.toISOString()}`);
      }
      
      return newBookings;
    } catch (error) {
      console.error(`Error copying booking ID ${bookingId} to multiple dates:`, error);
      return [];
    }
  }
  
  // Booking-Studio junction table methods
  async getBookingStudioLinks(bookingId: number): Promise<BookingStudio[]> {
    try {
      // Get all links for this booking from database
      const links = await db.select()
        .from(bookingStudios)
        .where(eq(bookingStudios.bookingId, bookingId));
      
      return links;
    } catch (error) {
      console.error(`Error getting booking-studio links for booking ID ${bookingId}:`, error);
      // Fall back to memory cache or empty array
      const memoryLinks: BookingStudio[] = [];
      // If we have a memory cache of links, use it
      if (this.bookingStudios) {
        this.bookingStudios.forEach((link, key) => {
          if (link.bookingId === bookingId) {
            memoryLinks.push(link);
          }
        });
      }
      return memoryLinks;
    }
  }
  
  async getAllBookingStudioLinks(): Promise<BookingStudio[]> {
    try {
      // First check if the table exists, since we just created it
      const tableCheck = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'booking_studios'
        );
      `);
      
      if (!tableCheck.rows?.[0]?.exists) {
        console.log("booking_studios table does not exist yet");
        return [];
      }
      
      // Get all booking-studio links from database
      const links = await db.query.bookingStudios.findMany();
      
      // Cache the results for fallback
      this.bookingStudiosCache = links;
      
      console.log(`Retrieved ${links.length} booking-studio links from database`);
      return links;
    } catch (error) {
      console.error("Error getting all booking-studio links:", error);
      // Fall back to memory cache if available
      const cachedLinks = this.bookingStudiosCache || [];
      console.log("Retrieved", cachedLinks.length, "booking-studio links from memory cache");
      return cachedLinks;
    }
  }
  
  async getStudiosForBooking(bookingId: number): Promise<Studio[]> {
    try {
      // Get all studios for this booking using a join
      const result = await db.select({
        studio: studios
      })
      .from(bookingStudios)
      .innerJoin(studios, eq(bookingStudios.studioId, studios.id))
      .where(eq(bookingStudios.bookingId, bookingId));
      
      // If no results, check if there's a legacy studioId (before junction table implementation)
      if (result.length === 0) {
        const booking = await this.getBooking(bookingId);
        if (booking && booking.studioId) {
          const studio = await this.getStudio(booking.studioId);
          return studio ? [studio] : [];
        }
        return [];
      }
      
      return result.map(row => row.studio);
    } catch (error) {
      console.error(`Error getting studios for booking ID ${bookingId}:`, error);
      return [];
    }
  }
  
  async createBookingStudioLinks(bookingId: number, studioIds: number[]): Promise<BookingStudio[]> {
    try {
      if (studioIds.length === 0) {
        return [];
      }
      
      console.log(`Creating booking-studio links for booking ID ${bookingId} with studios:`, studioIds);
      
      // Create the links in the database
      const linksToInsert = studioIds.map(studioId => ({
        bookingId,
        studioId
      }));
      
      const createdLinks = await db.insert(bookingStudios)
        .values(linksToInsert)
        .returning();
      
      console.log(`Created ${createdLinks.length} booking-studio links`);
      
      // Cache the links in memory
      if (this.bookingStudios) {
        createdLinks.forEach(link => {
          this.bookingStudios.set(`${link.bookingId}-${link.studioId}`, link);
        });
      }
      
      return createdLinks;
    } catch (error) {
      console.error(`Error creating booking-studio links for booking ID ${bookingId}:`, error);
      return [];
    }
  }
  
  async deleteBookingStudioLinks(bookingId: number): Promise<boolean> {
    try {
      console.log(`Deleting booking-studio links for booking ID ${bookingId}`);
      
      // Delete the links from the database
      const result = await db.delete(bookingStudios)
        .where(eq(bookingStudios.bookingId, bookingId))
        .returning();
      
      const deletedCount = result.length;
      console.log(`Deleted ${deletedCount} booking-studio links`);
      
      // Remove from memory cache if it exists
      if (this.bookingStudios) {
        const keysToDelete: string[] = [];
        this.bookingStudios.forEach((link, key) => {
          if (link.bookingId === bookingId) {
            keysToDelete.push(key);
          }
        });
        
        keysToDelete.forEach(key => {
          this.bookingStudios.delete(key);
        });
      }
      
      return deletedCount > 0;
    } catch (error) {
      console.error(`Error deleting booking-studio links for booking ID ${bookingId}:`, error);
      return false;
    }
  }
  
  // System Settings methods
  async getSiteName(): Promise<string> {
    const siteSetting = await this.getSystemSetting('siteName');
    return siteSetting?.value || 'BookStud.io';
  }
  
  async setSiteName(name: string): Promise<SystemSetting> {
    return this.upsertSystemSetting({ 
      key: 'siteName', 
      value: name 
    });
  }
  
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    try {
      // Check memory cache first
      if (this.systemSettings) {
        const cachedSetting = Array.from(this.systemSettings.values()).find(
          setting => setting.key === key
        );
        if (cachedSetting) {
          return cachedSetting;
        }
      }
      
      // If not in cache, fetch from database
      const [setting] = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key));
      
      if (setting) {
        // Add to cache
        if (!this.systemSettings) {
          this.systemSettings = new Map();
        }
        this.systemSettings.set(setting.id, setting);
      }
      
      return setting;
    } catch (error) {
      console.error(`Error getting system setting with key ${key}:`, error);
      return undefined;
    }
  }
  
  async getAllSystemSettings(): Promise<SystemSetting[]> {
    try {
      const settings = await db.select().from(systemSettings);
      
      // Update cache
      if (!this.systemSettings) {
        this.systemSettings = new Map();
      }
      
      settings.forEach(setting => {
        this.systemSettings.set(setting.id, setting);
      });
      
      return settings;
    } catch (error) {
      console.error("Error getting all system settings:", error);
      
      // Fall back to memory cache if available
      if (this.systemSettings) {
        return Array.from(this.systemSettings.values());
      }
      return [];
    }
  }
  
  async upsertSystemSetting(data: InsertSystemSetting): Promise<SystemSetting> {
    try {
      // Check if setting already exists
      const existingSetting = await this.getSystemSetting(data.key);
      
      if (existingSetting) {
        // Update existing setting
        const updatedSetting = await db.update(systemSettings)
          .set({ 
            value: data.value,
            updatedAt: new Date()
          })
          .where(eq(systemSettings.key, data.key))
          .returning();
        
        if (updatedSetting.length > 0) {
          // Update cache
          if (!this.systemSettings) {
            this.systemSettings = new Map();
          }
          this.systemSettings.set(updatedSetting[0].id, updatedSetting[0]);
          return updatedSetting[0];
        }
      }
      
      // Create new setting
      const [newSetting] = await db.insert(systemSettings)
        .values({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      // Add to cache
      if (!this.systemSettings) {
        this.systemSettings = new Map();
      }
      this.systemSettings.set(newSetting.id, newSetting);
      
      return newSetting;
    } catch (error) {
      console.error(`Error upserting system setting with key ${data.key}:`, error);
      throw new Error(`Failed to upsert system setting: ${error.message}`);
    }
  }
  
  async deleteSystemSetting(key: string): Promise<boolean> {
    try {
      // Delete from database
      const result = await db.delete(systemSettings)
        .where(eq(systemSettings.key, key))
        .returning();
      
      const deletedCount = result.length;
      
      if (deletedCount > 0 && this.systemSettings) {
        // Remove from cache if it exists
        const settingToDelete = Array.from(this.systemSettings.values())
          .find(setting => setting.key === key);
        
        if (settingToDelete) {
          this.systemSettings.delete(settingToDelete.id);
        }
      }
      
      return deletedCount > 0;
    } catch (error) {
      console.error(`Error deleting system setting with key ${key}:`, error);
      return false;
    }
  }
  
  async checkBookingConflicts(studioId: number, start: Date, end: Date, excludeBookingId: number | null): Promise<Booking[]> {
    try {
      // Get bookings associated with the studio during the specified time range
      const studioBookings = await db
        .select({
          booking: bookings,
        })
        .from(bookingStudios)
        .innerJoin(bookings, eq(bookingStudios.bookingId, bookings.id))
        .where(
          and(
            eq(bookingStudios.studioId, studioId),
            or(
              // Case 1: Booking starts during the new booking
              and(
                gte(bookings.start, start),
                lte(bookings.start, end)
              ),
              // Case 2: Booking ends during the new booking
              and(
                gte(bookings.end, start),
                lte(bookings.end, end)
              ),
              // Case 3: Booking completely overlaps the new booking
              and(
                lte(bookings.start, start),
                gte(bookings.end, end)
              )
            ),
            excludeBookingId ? not(eq(bookings.id, excludeBookingId)) : sql`1=1`
          )
        );
      
      // Extract and return the bookings
      const conflictingBookings = studioBookings.map(row => row.booking);
      return conflictingBookings;
    } catch (error) {
      console.error(`Error checking booking conflicts for studio ${studioId}:`, error);
      return [];
    }
  }
  
  async getBookingStudios(bookingId: number): Promise<Studio[]> {
    try {
      const result = await db
        .select({
          studio: studios,
        })
        .from(bookingStudios)
        .innerJoin(studios, eq(bookingStudios.studioId, studios.id))
        .where(eq(bookingStudios.bookingId, bookingId));
      
      return result.map(row => row.studio);
    } catch (error) {
      console.error(`Error getting studios for booking ${bookingId}:`, error);
      return [];
    }
  }
  
  async linkBookingToStudio(bookingId: number, studioId: number): Promise<BookingStudio> {
    try {
      const [link] = await db
        .insert(bookingStudios)
        .values({
          bookingId,
          studioId,
        })
        .returning();
        
      return link;
    } catch (error) {
      console.error(`Error linking booking ${bookingId} to studio ${studioId}:`, error);
      throw new Error(`Failed to link booking to studio: ${error}`);
    }
  }
}

// Use the database storage instead of memory storage
export const storage = new DatabaseStorage();
