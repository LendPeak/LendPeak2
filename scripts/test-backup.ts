#!/usr/bin/env ts-node

import { databaseBackup } from '../src/utils/database-backup';
import { logger } from '../src/utils/logger';

async function testBackup(): Promise<void> {
  try {
    console.log('🔧 Testing database backup system...');

    // Test listing existing backups
    console.log('\n📋 Listing existing backups:');
    const existingBackups = await databaseBackup.listBackups();
    console.log(`Found ${existingBackups.length} existing backups:`, existingBackups);

    // Test backup creation (local only, no compression, no S3)
    console.log('\n💾 Creating test backup...');
    const backupName = await databaseBackup.createBackup({
      compress: false,
      s3Upload: false,
      includeOplog: false,
      excludeCollections: ['sessions', 'cache'],
    });

    console.log(`✅ Backup created successfully: ${backupName}`);

    // List backups again to verify
    console.log('\n📋 Listing backups after creation:');
    const updatedBackups = await databaseBackup.listBackups();
    console.log(`Now found ${updatedBackups.length} backups:`, updatedBackups);

    // Test compressed backup
    console.log('\n🗜️  Creating compressed backup...');
    const compressedBackupName = await databaseBackup.createBackup({
      compress: true,
      s3Upload: false,
      includeOplog: false,
      excludeCollections: ['sessions', 'cache'],
    });

    console.log(`✅ Compressed backup created: ${compressedBackupName}`);

    console.log('\n✨ Backup system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Backup test failed:', error);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testBackup().catch(error => {
    console.error('💥 Fatal error during backup test:', error);
    process.exit(1);
  });
}

export { testBackup };