import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import * as fs from 'fs';
import * as path from 'path';
import { storage } from "./storage";
import { fileService, upload } from "./services/fileService";
import { 
  insertUserSchema, 
  insertStudioSchema, 
  insertPcrRoomSchema,
  insertTemplateSchema, 
  insertBookingSchema, 
  insertNotificationSchema,
  insertNotificationGroupSchema
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
  sendMaintenanceAlert,
  sendSiteManagerNotification
} from "./services/emailService";

import {
  sendBookingNotificationToGroups,
  sendMaintenanceAlertToGroups,
  sendFacilityAlertToGroups,
  sendCustomNotificationToGroups,
  sendFacilityAlert,
  sendFileAttachmentNotificationToGroups
} from "./services/notificationGroupService";
import { 
  generatePasswordResetToken, 
  verifyPasswordResetToken, 
  invalidatePasswordResetToken, 
  generateInviteToken, 
  verifyInviteToken, 
  invalidateInviteToken, 
  sendInviteEmail, 
  sendPasswordResetEmail 
} from "./email";
import { migrateTemplatesApi } from "./migrate-templates-api";