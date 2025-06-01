#!/usr/bin/env ts-node

import { databaseBackup } from '../src/utils/database-backup';
import { logger } from '../src/utils/logger';

async function main(): Promise<void> {
  try {
    logger.info('Starting scheduled database backup');

    // Create backup with compression and S3 upload
    const backupName = await databaseBackup.createBackup({
      compress: true,
      s3Upload: process.env.NODE_ENV === 'production',
      includeOplog: false,
      excludeCollections: ['sessions', 'cache'],
    });

    logger.info('Backup completed successfully', { backupName });

    // Cleanup old backups (keep last 30 days)
    await databaseBackup.cleanupOldBackups(30);
    
    process.exit(0);
  } catch (error) {
    logger.error('Backup script failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as backupDatabase };