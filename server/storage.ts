import { 
  users, type User, type InsertUser,
  studios, type Studio, type InsertStudio,
  templates, type Template, type InsertTemplate,
  bookings, type Booking, type InsertBooking,
  notifications, type Notification, type InsertNotification
} from "@shared/schema";

import session from "express-session";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  // Studio management
  getStudio(id: number): Promise<Studio | undefined>;
  getAllStudios(): Promise<Studio[]>;
  createStudio(studio: InsertStudio): Promise<Studio>;
  updateStudioStatus(id: number, status: string): Promise<Studio | undefined>;
  
  // Template management
  getTemplate(id: number): Promise<Template | undefined>;
  getAllTemplates(): Promise<Template[]>;
  getTemplatesByUser(userId: number): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  deleteTemplate(id: number): Promise<boolean>;
  
  // Booking management
  getBooking(id: number): Promise<Booking | undefined>;
  getAllBookings(): Promise<Booking[]>;
  getBookingsByStudio(studioId: number): Promise<Booking[]>;
  getBookingsByUser(userId: number): Promise<Booking[]>;
  getBookingsByDateRange(start: Date, end: Date): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, data: Partial<InsertBooking>): Promise<Booking | undefined>;
  deleteBooking(id: number): Promise<boolean>;
  
  // Notification management
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  
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
  
  private userIdCounter: number;
  private studioIdCounter: number;
  private templateIdCounter: number;
  private bookingIdCounter: number;
  private notificationIdCounter: number;
  
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.studios = new Map();
    this.templates = new Map();
    this.bookings = new Map();
    this.notifications = new Map();
    
    this.userIdCounter = 1;
    this.studioIdCounter = 1;
    this.templateIdCounter = 1;
    this.bookingIdCounter = 1;
    this.notificationIdCounter = 1;
    
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

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Studio methods
  async getStudio(id: number): Promise<Studio | undefined> {
    return this.studios.get(id);
  }

  async getAllStudios(): Promise<Studio[]> {
    return Array.from(this.studios.values());
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

  async getBookingsByStudio(studioId: number): Promise<Booking[]> {
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

  async updateBooking(id: number, data: Partial<InsertBooking>): Promise<Booking | undefined> {
    const booking = await this.getBooking(id);
    if (!booking) return undefined;
    
    const updatedBooking: Booking = { ...booking, ...data };
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }

  async deleteBooking(id: number): Promise<boolean> {
    return this.bookings.delete(id);
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
}

export const storage = new MemStorage();
