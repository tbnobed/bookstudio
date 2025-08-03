import { spawn } from 'child_process';
import { promises as fs, createWriteStream } from 'fs';
import { join } from 'path';
import cron from 'node-cron';

interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron format
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

  constructor() {
    this.config = {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      retentionDays: 30,
      backupPath: '/app/backups'
    };
    
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
      await fs.mkdir(this.config.backupPath, { recursive: true });
      
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
      const statusFile = join(this.config.backupPath, 'backup_status.json');
      const statusData = await fs.readFile(statusFile, 'utf8');
      const savedStatus = JSON.parse(statusData);
      
      this.status = {
        ...savedStatus,
        lastBackup: savedStatus.lastBackup ? new Date(savedStatus.lastBackup) : null,
        nextScheduledBackup: savedStatus.nextScheduledBackup ? new Date(savedStatus.nextScheduledBackup) : null
      };
    } catch (error) {
      // Status file doesn't exist yet, use defaults
      console.log('No previous backup status found, using defaults');
    }
  }

  private async saveBackupStatus() {
    try {
      const statusFile = join(this.config.backupPath, 'backup_status.json');
      await fs.writeFile(statusFile, JSON.stringify(this.status, null, 2));
    } catch (error) {
      console.error('Failed to save backup status:', error);
    }
  }

  private scheduleBackups() {
    console.log(`Scheduling automatic backups with cron: ${this.config.schedule}`);
    
    cron.schedule(this.config.schedule, async () => {
      console.log('Starting scheduled backup...');
      await this.createBackup();
    });
    
    // Calculate next backup time
    this.updateNextBackupTime();
  }

  private updateNextBackupTime() {
    // Simple calculation for next 2 AM
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(2, 0, 0, 0);
    this.status.nextScheduledBackup = next;
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
      const backupPath = join(this.config.backupPath, filename);

      console.log(`Creating database backup: ${filename}`);

      const result = await this.executeBackup(backupPath);
      
      if (result.success) {
        const stats = await fs.stat(backupPath);
        
        this.status.lastBackup = new Date();
        this.status.lastBackupSize = stats.size;
        this.status.lastBackupStatus = 'success';
        this.status.totalBackups += 1;
        
        // Clean up old backups
        await this.cleanupOldBackups();
        
        console.log(`Backup completed successfully: ${filename} (${this.formatFileSize(stats.size)})`);
        
        await this.saveBackupStatus();
        
        return { 
          success: true, 
          message: `Backup created successfully: ${filename}`,
          filename 
        };
      } else {
        this.status.lastBackupStatus = 'failed';
        await this.saveBackupStatus();
        return { success: false, message: result.error || 'Backup failed' };
      }
    } catch (error) {
      this.status.lastBackupStatus = 'failed';
      await this.saveBackupStatus();
      console.error('Backup failed:', error);
      return { success: false, message: `Backup failed: ${error instanceof Error ? error.message : String(error)}` };
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
          '-h', process.env.PGHOST || 'localhost',
          '-p', process.env.PGPORT || '5432',
          '-U', process.env.PGUSER || 'postgres',
          '-d', process.env.PGDATABASE || 'bookstudio',
          '--no-password',
          '--verbose',
          '--clean',
          '--if-exists',
          '--create'
        ], {
          env: {
            ...process.env,
            PGPASSWORD: process.env.PGPASSWORD || 'postgres'
          }
        });

        const writeStream = createWriteStream(backupPath);
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
        const filePath = join(this.config.backupPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`Deleted old backup: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }

  async listBackups(): Promise<Array<{ filename: string; size: number; date: Date }>> {
    try {
      const files = await fs.readdir(this.config.backupPath);
      const backupFiles = files.filter(file => file.startsWith('bookstudio_backup_') && file.endsWith('.sql'));
      
      const backups = [];
      for (const file of backupFiles) {
        const filePath = join(this.config.backupPath, file);
        const stats = await fs.stat(filePath);
        backups.push({
          filename: file,
          size: stats.size,
          date: stats.mtime
        });
      }
      
      return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  async restoreBackup(filename: string): Promise<{ success: boolean; message: string }> {
    try {
      const backupPath = join(this.config.backupPath, filename);
      
      // Verify file exists
      await fs.access(backupPath);
      
      console.log(`Restoring database from backup: ${filename}`);
      
      const result = await this.executeRestore(backupPath);
      
      if (result.success) {
        console.log(`Database restored successfully from: ${filename}`);
        return { success: true, message: `Database restored successfully from ${filename}` };
      } else {
        return { success: false, message: result.error || 'Restore failed' };
      }
    } catch (error) {
      console.error('Restore failed:', error);
      return { success: false, message: `Restore failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async restoreBackupSafe(filename: string): Promise<{ success: boolean; message: string }> {
    try {
      const backupPath = join(this.config.backupPath, filename);
      
      // Verify file exists
      await fs.access(backupPath);
      
      console.log(`Performing safe restore from backup: ${filename}`);
      
      const result = await this.executeSafeRestore(backupPath);
      
      if (result.success) {
        console.log(`Database restored safely from: ${filename}`);
        return { success: true, message: `Database restored safely from ${filename}` };
      } else {
        return { success: false, message: result.error || 'Safe restore failed' };
      }
    } catch (error) {
      console.error('Safe restore failed:', error);
      return { success: false, message: `Safe restore failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private executeRestore(backupPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // First, drop and recreate the database to avoid conflicts
      const dropAndRestore = spawn('bash', ['-c', `
        # Drop the existing database
        psql -h ${process.env.PGHOST || 'localhost'} \
             -p ${process.env.PGPORT || '5432'} \
             -U ${process.env.PGUSER || 'postgres'} \
             -d postgres \
             -c "DROP DATABASE IF EXISTS ${process.env.PGDATABASE || 'bookstudio'};"
        
        # Create a new empty database
        psql -h ${process.env.PGHOST || 'localhost'} \
             -p ${process.env.PGPORT || '5432'} \
             -U ${process.env.PGUSER || 'postgres'} \
             -d postgres \
             -c "CREATE DATABASE ${process.env.PGDATABASE || 'bookstudio'};"
        
        # Restore from backup
        psql -h ${process.env.PGHOST || 'localhost'} \
             -p ${process.env.PGPORT || '5432'} \
             -U ${process.env.PGUSER || 'postgres'} \
             -d ${process.env.PGDATABASE || 'bookstudio'} \
             -f "${backupPath}"
      `], {
        env: {
          ...process.env,
          PGPASSWORD: process.env.PGPASSWORD || 'postgres'
        }
      });

      let errorOutput = '';
      let stdOutput = '';
      
      dropAndRestore.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log('restore stderr:', data.toString());
      });

      dropAndRestore.stdout.on('data', (data) => {
        stdOutput += data.toString();
        console.log('restore stdout:', data.toString());
      });

      dropAndRestore.on('close', (code) => {
        if (code === 0) {
          console.log('Database restore completed successfully');
          resolve({ success: true });
        } else {
          console.error('Database restore failed with code:', code);
          resolve({ success: false, error: `Database restore failed (exit code ${code}): ${errorOutput}` });
        }
      });

      dropAndRestore.on('error', (error) => {
        console.error('Database restore error:', error);
        resolve({ success: false, error: error.message });
      });
    });
  }

  private executeSafeRestore(backupPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // Create a script that truncates all data and restores without dropping database
      const safeRestore = spawn('bash', ['-c', `
        # Create a temporary script to truncate all tables
        psql -h ${process.env.PGHOST || 'localhost'} \
             -p ${process.env.PGPORT || '5432'} \
             -U ${process.env.PGUSER || 'postgres'} \
             -d ${process.env.PGDATABASE || 'bookstudio'} \
             -t -c "
               SELECT 'TRUNCATE TABLE ' || table_name || ' RESTART IDENTITY CASCADE;' 
               FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_type = 'BASE TABLE'
               AND table_name NOT LIKE 'pg_%'
             " > /tmp/truncate_script.sql
        
        # Execute truncate script
        psql -h ${process.env.PGHOST || 'localhost'} \
             -p ${process.env.PGPORT || '5432'} \
             -U ${process.env.PGUSER || 'postgres'} \
             -d ${process.env.PGDATABASE || 'bookstudio'} \
             -f /tmp/truncate_script.sql
        
        # Extract and execute only the data portion from the backup
        # Skip CREATE statements and constraints, only COPY data
        grep -E '^COPY|^\\\\\\.|^[0-9]' "${backupPath}" > /tmp/data_only.sql
        
        # Restore only the data
        psql -h ${process.env.PGHOST || 'localhost'} \
             -p ${process.env.PGPORT || '5432'} \
             -U ${process.env.PGUSER || 'postgres'} \
             -d ${process.env.PGDATABASE || 'bookstudio'} \
             -f /tmp/data_only.sql
        
        # Clean up temporary files
        rm -f /tmp/truncate_script.sql /tmp/data_only.sql
      `], {
        env: {
          ...process.env,
          PGPASSWORD: process.env.PGPASSWORD || 'postgres'
        }
      });

      let errorOutput = '';
      let stdOutput = '';
      
      safeRestore.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log('safe restore stderr:', data.toString());
      });

      safeRestore.stdout.on('data', (data) => {
        stdOutput += data.toString();
        console.log('safe restore stdout:', data.toString());
      });

      safeRestore.on('close', (code) => {
        if (code === 0) {
          console.log('Safe database restore completed successfully');
          resolve({ success: true });
        } else {
          console.error('Safe database restore failed with code:', code);
          resolve({ success: false, error: `Safe restore failed (exit code ${code}): ${errorOutput}` });
        }
      });

      safeRestore.on('error', (error) => {
        console.error('Safe database restore error:', error);
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
    
    // Reschedule if schedule changed
    if (newConfig.schedule) {
      this.scheduleBackups();
    }
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export const backupManager = new BackupManager();