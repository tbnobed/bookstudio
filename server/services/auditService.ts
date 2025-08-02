import { storage } from "../storage";
import { InsertAuditLog } from "@shared/schema";

interface AuditContext {
  userId: number;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  static async log(
    context: AuditContext,
    action: string,
    entityType: string,
    entityId?: number,
    entityTitle?: string,
    details?: Record<string, any>
  ) {
    try {
      const auditLog: InsertAuditLog = {
        userId: context.userId,
        action,
        entityType,
        entityId: entityId || null,
        entityTitle: entityTitle || null,
        details: details || {},
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
    userId: req.user?.id || 0,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
  };
}