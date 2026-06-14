import { storage } from "../storage";
import { InsertAuditLog } from "@shared/schema";

interface AuditContext {
  userId: number;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  static async log(
    contextOrAction: AuditContext | string,
    actionOrEntityType: string,
    entityTypeOrEntityTitle: string,
    entityIdOrReq?: number | any,
    entityTitleOrDetails?: string | Record<string, any>,
    detailsArg?: Record<string, any>
  ) {
    // Support two calling conventions used across the codebase:
    //  A) log(context, action, entityType, entityId?, entityTitle?, details?)
    //  B) log(action, entityType, entityTitle, req, details?)  -- req-derived context
    let context: AuditContext;
    let action: string;
    let entityType: string;
    let entityId: number | undefined;
    let entityTitle: string | undefined;
    let details: Record<string, any> | undefined;

    if (typeof contextOrAction === "string") {
      // Convention B: first arg is the action, 4th arg is the Express request
      action = contextOrAction;
      entityType = actionOrEntityType;
      entityTitle = entityTypeOrEntityTitle;
      context = getAuditContext(entityIdOrReq ?? {});
      entityId = undefined;
      details = entityTitleOrDetails as Record<string, any> | undefined;
    } else {
      // Convention A: first arg is an AuditContext object
      context = contextOrAction;
      action = actionOrEntityType;
      entityType = entityTypeOrEntityTitle;
      entityId = typeof entityIdOrReq === "number" ? entityIdOrReq : undefined;
      entityTitle = entityTitleOrDetails as string | undefined;
      details = detailsArg;
    }

    try {
      // Ensure details can be safely serialized to JSON with deep cleaning
      let safeDetails = {};
      if (details) {
        try {
          // Clean the details object to remove circular references and non-serializable data
          safeDetails = this.cleanObjectForSerialization(details);
          // Test serialization
          JSON.stringify(safeDetails);
        } catch (jsonError) {
          console.warn('Failed to serialize audit details, using fallback:', jsonError);
          safeDetails = { 
            error: 'Failed to serialize details', 
            originalType: typeof details,
            errorMessage: jsonError instanceof Error ? jsonError.message : 'Unknown serialization error'
          };
        }
      }

      const auditLog: InsertAuditLog = {
        userId: context.userId,
        action,
        entityType,
        entityId: entityId || null,
        entityTitle: entityTitle || null,
        details: safeDetails,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
      };

      await storage.createAuditLog(auditLog);
    } catch (error) {
      console.error("Failed to create audit log:", error);
      // Don't throw - audit logging should not break the main operation
    }
  }

  // Convenience methods for common actions
  static async logLogin(context: AuditContext, username: string) {
    await this.log(context, "LOGIN", "authentication", undefined, username, {
      success: true,
      username,
    });
  }

  static async logLogout(context: AuditContext, username: string) {
    await this.log(context, "LOGOUT", "authentication", undefined, username, {
      username,
    });
  }

  static async logBookingCreate(context: AuditContext, bookingId: number, title: string, details: Record<string, any>) {
    await this.log(context, "CREATE", "booking", bookingId, title, details);
  }

  static async logBookingUpdate(context: AuditContext, bookingId: number, title: string, oldValues: Record<string, any>, newValues: Record<string, any>) {
    await this.log(context, "UPDATE", "booking", bookingId, title, {
      oldValues,
      newValues,
      changes: this.getChanges(oldValues, newValues),
    });
  }

  static async logBookingDelete(context: AuditContext, bookingId: number, title: string, bookingData: Record<string, any>) {
    await this.log(context, "DELETE", "booking", bookingId, title, {
      deletedData: bookingData,
    });
  }

  static async logAlertCreate(context: AuditContext, alertId: number, title: string, details: Record<string, any>) {
    await this.log(context, "CREATE", "alert", alertId, title, details);
  }

  static async logAlertUpdate(context: AuditContext, alertId: number, title: string, oldValues: Record<string, any>, newValues: Record<string, any>) {
    await this.log(context, "UPDATE", "alert", alertId, title, {
      oldValues,
      newValues,
      changes: this.getChanges(oldValues, newValues),
    });
  }

  static async logAlertDelete(context: AuditContext, alertId: number, title: string, alertData: Record<string, any>) {
    await this.log(context, "DELETE", "alert", alertId, title, {
      deletedData: alertData,
    });
  }

  static async logUserCreate(context: AuditContext, userId: number, username: string, role: string) {
    await this.log(context, "CREATE", "user", userId, username, {
      role,
      createdUser: username,
    });
  }

  static async logUserUpdate(context: AuditContext, userId: number, username: string, oldValues: Record<string, any>, newValues: Record<string, any>) {
    await this.log(context, "UPDATE", "user", userId, username, {
      oldValues,
      newValues,
      changes: this.getChanges(oldValues, newValues),
    });
  }

  static async logUserDelete(context: AuditContext, userId: number, username: string, userData: Record<string, any>) {
    await this.log(context, "DELETE", "user", userId, username, {
      deletedData: userData,
    });
  }

  static async logTemplateCreate(context: AuditContext, templateId: number, name: string, details: Record<string, any>) {
    await this.log(context, "CREATE", "template", templateId, name, details);
  }

  static async logTemplateUpdate(context: AuditContext, templateId: number, name: string, oldValues: Record<string, any>, newValues: Record<string, any>) {
    await this.log(context, "UPDATE", "template", templateId, name, {
      oldValues,
      newValues,
      changes: this.getChanges(oldValues, newValues),
    });
  }

  static async logTemplateDelete(context: AuditContext, templateId: number, name: string, templateData: Record<string, any>) {
    await this.log(context, "DELETE", "template", templateId, name, {
      deletedData: templateData,
    });
  }

  static async logSystemSettingUpdate(context: AuditContext, key: string, oldValue: any, newValue: any) {
    await this.log(context, "UPDATE", "system_setting", undefined, key, {
      key,
      oldValue,
      newValue,
    });
  }

  static async logPasswordReset(context: AuditContext, targetUserId: number, targetUsername: string) {
    await this.log(context, "PASSWORD_RESET", "user", targetUserId, targetUsername, {
      targetUser: targetUsername,
    });
  }

  static async logInviteCreate(context: AuditContext, email: string, role: string) {
    await this.log(context, "INVITE_CREATE", "user", undefined, email, {
      email,
      role,
    });
  }

  static async logFailedLogin(context: AuditContext, username: string, reason: string) {
    await this.log(context, "LOGIN_FAILED", "authentication", undefined, username, {
      success: false,
      username,
      reason,
    });
  }

  // Helper method to clean objects for safe JSON serialization
  private static cleanObjectForSerialization(obj: any, seen = new WeakSet()): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Prevent circular references
    if (seen.has(obj)) {
      return '[Circular Reference]';
    }
    seen.add(obj);

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanObjectForSerialization(item, seen));
    }

    // Handle objects
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip functions, symbols, and known problematic properties
      if (typeof value === 'function' || 
          typeof value === 'symbol' ||
          key === 'parser' || 
          key === 'socket' || 
          key === '_handle' ||
          key === 'req' ||
          key === 'res') {
        continue;
      }

      try {
        cleaned[key] = this.cleanObjectForSerialization(value, seen);
      } catch (error) {
        cleaned[key] = '[Unserializable]';
      }
    }

    return cleaned;
  }

  // Helper method to identify what changed between old and new values
  private static getChanges(oldValues: Record<string, any>, newValues: Record<string, any>): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};
    
    // Check all keys in both objects
    const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
    
    for (const key of allKeys) {
      const oldVal = oldValues[key];
      const newVal = newValues[key];
      
      // Skip if values are the same (including undefined/null equality)
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = {
          from: oldVal,
          to: newVal,
        };
      }
    }
    
    return changes;
  }
}

// Middleware to extract audit context from Express request
export function getAuditContext(req: any): AuditContext {
  return {
    userId: req?.user?.id || 0,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: typeof req?.get === "function" ? req.get("User-Agent") : req?.headers?.["user-agent"],
  };
}