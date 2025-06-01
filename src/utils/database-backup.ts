import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';
import { logger } from './logger';

const execAsync = promisify(exec);

export interface BackupOptions {
  includeOplog?: boolean;
  compress?: boolean;
  excludeCollections?: string[];
  s3Upload?: boolean;
}

export interface RestoreOptions {
  dropDatabase?: boolean;
  preserveUUIDs?: boolean;
  s3Download?: boolean;
  backupId?: string;
}

export class DatabaseBackupService {
  private s3Client: S3Client;
  private backupDir: string;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({ region: config.aws.region });
    this.backupDir = process.env.BACKUP_DIR || '/tmp/mongodb-backups';
    this.bucketName = process.env.BACKUP_BUCKET || 'lendpeak2-backups';
  }

  /**
   * Creates a backup of the MongoDB database
   */
  async createBackup(options: BackupOptions = {}): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);

    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      // Build mongodump command
      const command = this.buildBackupCommand(backupPath, options);
      
      logger.info('Starting database backup', { backupName, options });
      
      // Execute backup
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('writing')) {
        logger.warn('Backup completed with warnings', { stderr });
      }

      logger.info('Database backup completed', { backupName, stdout });

      // Compress if requested
      let finalPath = backupPath;
      if (options.compress) {
        finalPath = await this.compressBackup(backupPath);
      }

      // Upload to S3 if requested
      if (options.s3Upload) {
        await this.uploadToS3(finalPath, backupName);
      }

      return backupName;
    } catch (error) {
      logger.error('Database backup failed', { error, backupName });
      throw new Error(`Backup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Restores a database from backup
   */
  async restoreBackup(backupName: string, options: RestoreOptions = {}): Promise<void> {
    let backupPath = path.join(this.backupDir, backupName);

    try {
      // Download from S3 if needed
      if (options.s3Download && options.backupId) {
        backupPath = await this.downloadFromS3(options.backupId);
      }

      // Check if backup exists
      await fs.access(backupPath);

      // Decompress if needed
      if (backupPath.endsWith('.gz')) {
        backupPath = await this.decompressBackup(backupPath);
      }

      // Build mongorestore command
      const command = this.buildRestoreCommand(backupPath, options);
      
      logger.info('Starting database restore', { backupName, options });
      
      // Execute restore
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('restoring')) {
        logger.warn('Restore completed with warnings', { stderr });
      }

      logger.info('Database restore completed', { backupName, stdout });
    } catch (error) {
      logger.error('Database restore failed', { error, backupName });
      throw new Error(`Restore failed: ${(error as Error).message}`);
    }
  }

  /**
   * Lists available backups
   */
  async listBackups(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      return files.filter(file => file.startsWith('backup-'));
    } catch (error) {
      logger.error('Failed to list backups', { error });
      return [];
    }
  }

  /**
   * Deletes old backups based on retention policy
   */
  async cleanupOldBackups(retentionDays = 30): Promise<void> {
    try {
      const files = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.rm(filePath, { recursive: true, force: true });
          logger.info('Deleted old backup', { file, age: stats.mtime });
        }
      }
    } catch (error) {
      logger.error('Backup cleanup failed', { error });
    }
  }

  /**
   * Builds the mongodump command
   */
  private buildBackupCommand(outputPath: string, options: BackupOptions): string {
    const parts = [
      'mongodump',
      `--uri="${config.mongodb.uri}"`,
      `--out="${outputPath}"`,
    ];

    if (options.includeOplog) {
      parts.push('--oplog');
    }

    if (options.excludeCollections?.length) {
      options.excludeCollections.forEach(collection => {
        parts.push(`--excludeCollection=${collection}`);
      });
    }

    return parts.join(' ');
  }

  /**
   * Builds the mongorestore command
   */
  private buildRestoreCommand(inputPath: string, options: RestoreOptions): string {
    const parts = [
      'mongorestore',
      `--uri="${config.mongodb.uri}"`,
      inputPath,
    ];

    if (options.dropDatabase) {
      parts.push('--drop');
    }

    if (options.preserveUUIDs) {
      parts.push('--preserveUUIDs');
    }

    return parts.join(' ');
  }

  /**
   * Compresses a backup directory
   */
  private async compressBackup(backupPath: string): Promise<string> {
    const compressedPath = `${backupPath}.tar.gz`;
    const command = `tar -czf "${compressedPath}" -C "${path.dirname(backupPath)}" "${path.basename(backupPath)}"`;
    
    await execAsync(command);
    await fs.rm(backupPath, { recursive: true, force: true });
    
    return compressedPath;
  }

  /**
   * Decompresses a backup file
   */
  private async decompressBackup(compressedPath: string): Promise<string> {
    const outputDir = compressedPath.replace('.tar.gz', '');
    const command = `tar -xzf "${compressedPath}" -C "${path.dirname(compressedPath)}"`;
    
    await execAsync(command);
    
    return outputDir;
  }

  /**
   * Uploads backup to S3
   */
  private async uploadToS3(filePath: string, key: string): Promise<void> {
    const fileContent = await fs.readFile(filePath);
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: `mongodb-backups/${key}`,
      Body: fileContent,
      ServerSideEncryption: 'AES256',
      StorageClass: 'STANDARD_IA',
    });

    await this.s3Client.send(command);
    logger.info('Backup uploaded to S3', { key, bucket: this.bucketName });
  }

  /**
   * Downloads backup from S3
   */
  private async downloadFromS3(key: string): Promise<string> {
    // Implementation would download from S3
    // Placeholder for now
    throw new Error('S3 download not implemented');
  }
}

// Singleton instance
export const databaseBackup = new DatabaseBackupService();