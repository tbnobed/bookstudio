import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as cron from 'node-cron';

interface BackupConfig {
  enabled: boolean;
  schedule: string;
  retentionDays: number;
  backupPath: string;
}

interface BackupStatus {
  lastBackup: Date | null;
  lastBackupSize: number | null;
  lastBackupStatus: 'success' | 'failed' | 'in_progress';
  nextScheduledBackup: Date | null;
  totalBackups: number;
}

class BackupManager {
  private config: BackupConfig;
  private status: BackupStatus;
  private backupInProgress = false;
  private statusFilePath: string;

  constructor() {
    this.config = {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      retentionDays: 30,
      backupPath: './backups'
    };

    this.statusFilePath = path.join(this.config.backupPath, 'backup_status.json');

    this.status = {
      lastBackup: null,
      lastBackupSize: null,
      lastBackupStatus: 'success',
      nextScheduledBackup: null,
      totalBackups: 0
    };
    
    this.initializeBackupSystem();
  }

  private async initializeBackupSystem() {
    try {
      // Ensure backup directory exists
      if (!fsSync.existsSync(this.config.backupPath)) {
        await fs.mkdir(this.config.backupPath, { recursive: true });
        console.log(`Created backup directory: ${this.config.backupPath}`);
      }
      
      // Load previous status if available
      await this.loadBackupStatus();
      
      // Schedule automatic backups
      if (this.config.enabled) {
        this.scheduleBackups();
      }
      
      console.log('Backup system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize backup system:', error);
    }
  }

  private async loadBackupStatus() {
    try {
      if (fsSync.existsSync(this.statusFilePath)) {
        const data = await fs.readFile(this.statusFilePath, 'utf8');
        const parsedStatus = JSON.parse(data);
        this.status = {
          ...parsedStatus,
          lastBackup: parsedStatus.lastBackup ? new Date(parsedStatus.lastBackup) : null,
          nextScheduledBackup: parsedStatus.nextScheduledBackup ? new Date(parsedStatus.nextScheduledBackup) : null
        };
      }
    } catch (error) {
      console.log('No previous backup status found, starting fresh');
    }
  }

  private async saveBackupStatus() {
    try {
      await fs.writeFile(this.statusFilePath, JSON.stringify(this.status, null, 2));
    } catch (error) {
      console.error('Failed to save backup status:', error);
    }
  }

  private scheduleBackups() {
    cron.schedule(this.config.schedule, async () => {
      if (!this.backupInProgress) {
        console.log('Starting scheduled backup...');
        await this.createBackup();
      }
    });

    this.updateNextBackupTime();
  }

  private updateNextBackupTime() {
    // Calculate next backup time based on cron schedule
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // 2:00 AM
    this.status.nextScheduledBackup = tomorrow;
  }

  async createBackup(): Promise<{ success: boolean; message: string; filename?: string }> {
    if (this.backupInProgress) {
      return { success: false, message: 'Backup already in progress' };
    }

    this.backupInProgress = true;
    this.status.lastBackupStatus = 'in_progress';
    await this.saveBackupStatus();

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `bookstudio_backup_${timestamp}.sql`;
      const backupPath = path.join(this.config.backupPath, filename);

      console.log(`Creating database backup: ${filename}`);

      const result = await this.executeBackup(backupPath);

      if (result.success) {
        // Get file size
        const stats = await fs.stat(backupPath);
        
        this.status.lastBackup = new Date();
        this.status.lastBackupSize = stats.size;
        this.status.lastBackupStatus = 'success';
        this.status.totalBackups += 1;
        
        // Clean up old backups
        await this.cleanupOldBackups();
        
        await this.saveBackupStatus();
        
        return { 
          success: true, 
          message: `Backup created successfully: ${filename}`,
          filename 
        };
      } else {
        this.status.lastBackupStatus = 'failed';
        await this.saveBackupStatus();
        
        return { 
          success: false, 
          message: result.error || 'Backup failed'
        };
      }
    } catch (error) {
      console.error('Backup failed:', error);
      this.status.lastBackupStatus = 'failed';
      await this.saveBackupStatus();
      
      return { 
        success: false, 
        message: `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    } finally {
      this.backupInProgress = false;
    }
  }

  private executeBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // First check if pg_dump is available
      const which = spawn('which', ['pg_dump']);
      
      which.on('close', (code) => {
        if (code !== 0) {
          resolve({ 
            success: false, 
            error: 'PostgreSQL client tools (pg_dump) not found. Please ensure postgresql-client is installed in the container.' 
          });
          return;
        }
        
        // pg_dump is available, proceed with backup
        console.log('Starting pg_dump with connection params:', {
          host: process.env.PGHOST || 'localhost',
          port: process.env.PGPORT || '5432',
          user: process.env.PGUSER || 'postgres',
          database: process.env.PGDATABASE || 'bookstudio'
        });
        
        const pgDump = spawn('pg_dump', [
          '--host', process.env.PGHOST || 'localhost',
          '--port', process.env.PGPORT || '5432',
          '--username', process.env.PGUSER || 'postgres',
          '--no-password',
          '--clean',
          '--create',
          '--verbose',
          process.env.PGDATABASE || 'bookstudio'
        ], {
          env: {
            ...process.env,
            PGPASSWORD: process.env.PGPASSWORD || 'postgres'
          }
        });

        const writeStream = fsSync.createWriteStream(backupPath);
        pgDump.stdout.pipe(writeStream);

        let errorOutput = '';
        pgDump.stderr.on('data', (data) => {
          const output = data.toString();
          errorOutput += output;
          console.log('pg_dump stderr:', output);
        });

        pgDump.on('close', (code) => {
          writeStream.end();
          if (code === 0) {
            console.log('pg_dump completed successfully');
            resolve({ success: true });
          } else {
            console.error(`pg_dump failed with code ${code}`);
            resolve({ success: false, error: `pg_dump exited with code ${code}: ${errorOutput}` });
          }
        });

        pgDump.on('error', (error) => {
          writeStream.end();
          console.error('pg_dump spawn error:', error);
          resolve({ success: false, error: `Failed to start pg_dump: ${error.message}` });
        });
      });

      which.on('error', (error) => {
        resolve({ 
          success: false, 
          error: `Failed to check for pg_dump availability: ${error.message}` 
        });
      });
    });
  }

  private async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.config.backupPath);
      const backupFiles = files.filter(file => file.startsWith('bookstudio_backup_') && file.endsWith('.sql'));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      for (const file of backupFiles) {
        const filePath = path.join(this.config.backupPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`Deleted old backup: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  async listBackups(): Promise<Array<{ filename: string; size: number; date: Date }>> {
    try {
      const files = await fs.readdir(this.config.backupPath);
      const backupFiles = files.filter(file => file.startsWith('bookstudio_backup_') && file.endsWith('.sql'));
      
      const backups = [];
      for (const file of backupFiles) {
        const filePath = path.join(this.config.backupPath, file);
        const stats = await fs.stat(filePath);
        backups.push({
          filename: file,
          size: stats.size,
          date: stats.mtime
        });
      }
      
      // Sort by date, newest first
      return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  async restoreBackup(filename: string): Promise<{ success: boolean; message: string }> {
    try {
      const backupPath = path.join(this.config.backupPath, filename);
      
      // Check if file exists
      if (!fsSync.existsSync(backupPath)) {
        return { success: false, message: 'Backup file not found' };
      }

      console.log(`Restoring database from: ${filename}`);
      
      const result = await this.executeRestore(backupPath);
      
      if (result.success) {
        return { success: true, message: `Database restored successfully from ${filename}` };
      } else {
        return { success: false, message: result.error || 'Restore failed' };
      }
    } catch (error) {
      console.error('Restore failed:', error);
      return { 
        success: false, 
        message: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private executeRestore(backupPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const psql = spawn('psql', [
        '--host', process.env.PGHOST || 'localhost',
        '--port', process.env.PGPORT || '5432',
        '--username', process.env.PGUSER || 'postgres',
        '--no-password',
        '--file', backupPath
      ], {
        env: {
          ...process.env,
          PGPASSWORD: process.env.PGPASSWORD || 'postgres'
        }
      });

      let errorOutput = '';
      psql.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log('psql:', data.toString());
      });

      psql.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `psql exited with code ${code}: ${errorOutput}` });
        }
      });

      psql.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  }

  getStatus(): BackupStatus & { config: BackupConfig } {
    return {
      ...this.status,
      config: this.config
    };
  }

  updateConfig(newConfig: Partial<BackupConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveBackupStatus();
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export const backupManager = new BackupManager();