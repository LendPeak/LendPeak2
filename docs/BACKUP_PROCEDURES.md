# Database Backup and Recovery Procedures

This document outlines the comprehensive backup and recovery procedures for the LendPeak2 MongoDB database.

## Overview

The LendPeak2 backup system provides:
- Automated daily backups with compression
- Point-in-time recovery capabilities
- Local and cloud storage options
- Automated retention management
- Comprehensive logging and monitoring

## Quick Start

### Create a Backup
```bash
./scripts/backup-management.sh create --compress
```

### List Available Backups
```bash
./scripts/backup-management.sh list
```

### Restore from Backup
```bash
./scripts/backup-management.sh restore --backup-name backup-2023-05-31_14-30-00.tar.gz
```

### Test Backup System
```bash
./scripts/backup-management.sh test
```

## Backup Management Script

The `backup-management.sh` script provides a comprehensive interface for all backup operations:

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `create` | Create a new backup | `./scripts/backup-management.sh create --compress` |
| `list` | List all available backups | `./scripts/backup-management.sh list` |
| `restore` | Restore from a backup | `./scripts/backup-management.sh restore --backup-name backup-name` |
| `cleanup` | Remove old backups | `./scripts/backup-management.sh cleanup` |
| `schedule` | Show backup schedule info | `./scripts/backup-management.sh schedule` |
| `test` | Test backup system | `./scripts/backup-management.sh test` |

### Create Backup Options

| Option | Description | Default |
|--------|-------------|---------|
| `--compress` | Compress the backup | Enabled |
| `--no-compress` | Don't compress the backup | Disabled |
| `--exclude-sessions` | Exclude session data | Enabled |

### Restore Options

| Option | Description | Required |
|--------|-------------|----------|
| `--backup-name NAME` | Specify backup to restore | Yes |
| `--confirm` | Skip confirmation prompt | No |

## Backup Types

### 1. Local Backups
- Stored in `./data/backups/`
- Compressed using gzip
- Automatic cleanup after 30 days
- Suitable for development and testing

### 2. Production Backups
- Uses the DatabaseBackupService class
- Supports S3 upload for cloud storage
- Automated scheduling via cron
- Comprehensive logging

### 3. Emergency Backups
- Manual backups before major changes
- Full database dumps with oplog
- Stored with special naming convention

## Automated Scheduling

### Recommended Cron Jobs

Add these to your crontab (`crontab -e`):

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/lendpeak2 && ./scripts/backup-management.sh create --compress

# Weekly cleanup on Sundays at 3 AM
0 3 * * 0 cd /path/to/lendpeak2 && ./scripts/backup-management.sh cleanup

# Monthly full backup on 1st of month at 1 AM
0 1 1 * * cd /path/to/lendpeak2 && ./scripts/backup-database.ts
```

### Environment-Specific Schedules

#### Development
- Daily backups during business hours
- 7-day retention
- Local storage only

#### Staging
- Daily backups at midnight
- 30-day retention
- Local + S3 storage

#### Production
- Every 6 hours
- 90-day retention
- S3 primary storage
- Cross-region replication

## Recovery Procedures

### Standard Recovery

1. **Identify the backup to restore**:
   ```bash
   ./scripts/backup-management.sh list
   ```

2. **Stop application services** (if running):
   ```bash
   # Stop backend services
   pm2 stop all
   
   # Stop frontend development server
   pkill -f "vite"
   ```

3. **Restore the database**:
   ```bash
   ./scripts/backup-management.sh restore --backup-name backup-2023-05-31_14-30-00.tar.gz
   ```

4. **Verify restoration**:
   ```bash
   mongosh mongodb://localhost:27017/lendpeak2 --eval "db.loans.countDocuments()"
   ```

5. **Restart services**:
   ```bash
   pm2 restart all
   ```

### Emergency Recovery

For production emergencies:

1. **Immediate Assessment**:
   - Determine scope of data loss
   - Identify last known good backup
   - Estimate recovery time objective (RTO)

2. **Cloud Recovery (Production)**:
   ```bash
   # Download from S3
   aws s3 cp s3://lendpeak2-backups/backup-name ./data/backups/
   
   # Restore
   ./scripts/backup-management.sh restore --backup-name backup-name --confirm
   ```

3. **Point-in-Time Recovery**:
   ```bash
   # Restore to specific timestamp
   mongorestore --uri="mongodb://localhost:27017/lendpeak2" \
     --oplogReplay \
     --oplogLimit 1640995200:1 \
     ./backup-path
   ```

### Disaster Recovery

#### Cross-Region Failover

1. **Switch to backup region**:
   - Update DNS to backup region
   - Start services in backup region
   - Verify data integrity

2. **Rebuild primary region**:
   - Restore from latest backup
   - Sync any missing data
   - Test failback procedures

## Backup Verification

### Automated Verification

The system includes automated backup verification:

```bash
# Test backup integrity
./scripts/test-backup.sh

# Verify specific backup
mongorestore --dryRun --uri="mongodb://localhost:27017/test_restore" ./backup-path
```

### Manual Verification

1. **Check backup completeness**:
   ```bash
   # List collections in backup
   ls ./data/backups/backup-name/lendpeak2/
   
   # Verify document counts
   mongorestore --dryRun --verbose ./backup-path
   ```

2. **Test restoration in isolated environment**:
   ```bash
   # Restore to test database
   mongorestore --uri="mongodb://localhost:27017/lendpeak2_test" ./backup-path
   
   # Run application tests
   npm test
   ```

## Monitoring and Alerting

### Log Monitoring

Backup logs are stored in `./data/logs/`:
- `backup_TIMESTAMP.log` - Backup execution logs
- `restore_TIMESTAMP.log` - Restore execution logs

### Health Checks

```bash
# Check last backup age
find ./data/backups -name "backup-*" -mtime +1 -ls

# Verify backup sizes
du -sh ./data/backups/backup-*
```

### Alerting Setup

Configure alerts for:
- Backup failures
- Missing backups (age > 24 hours)
- Storage space issues
- Restoration failures

## Security Considerations

### Backup Encryption

Production backups should be encrypted:

```bash
# Encrypt backup
gpg --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
    --s2k-digest-algo SHA512 --s2k-count 65536 --symmetric \
    backup-file.tar.gz
```

### Access Control

- Backup files should have restricted permissions (600)
- S3 buckets should use encryption at rest
- Access to backups should be logged and audited

### Data Retention

- Follow compliance requirements for data retention
- Implement secure deletion for expired backups
- Maintain audit trail of backup operations

## Troubleshooting

### Common Issues

1. **MongoDB not running**:
   ```bash
   ./scripts/start-mongodb.sh
   ```

2. **Insufficient disk space**:
   ```bash
   df -h
   ./scripts/backup-management.sh cleanup
   ```

3. **Permission errors**:
   ```bash
   chmod +x ./scripts/backup-management.sh
   sudo chown -R $USER:$USER ./data/
   ```

4. **Corrupted backup**:
   ```bash
   # Test backup integrity
   tar -tzf backup-file.tar.gz
   
   # Use previous backup
   ./scripts/backup-management.sh list
   ```

### Log Analysis

Check logs for detailed error information:

```bash
# View backup logs
tail -f ./data/logs/backup_*.log

# View MongoDB logs
tail -f ./data/logs/mongodb.log

# System logs
journalctl -u mongod
```

## Performance Optimization

### Backup Performance

- Use `--numParallelCollections` for faster backups
- Schedule backups during low-traffic periods
- Consider incremental backups for large datasets

### Storage Optimization

- Enable compression (default)
- Exclude unnecessary collections
- Implement tiered storage (hot/cold)

## Compliance and Auditing

### Regulatory Requirements

- GDPR: Implement right to be forgotten
- SOX: Maintain audit trails
- PCI DSS: Encrypt sensitive data

### Audit Trail

All backup operations are logged with:
- Timestamp
- User/system performing operation
- Backup name and location
- Success/failure status
- Data changes (for restores)

## Best Practices

1. **Regular Testing**: Test restore procedures monthly
2. **Documentation**: Keep runbooks updated
3. **Monitoring**: Set up proactive alerting
4. **Security**: Encrypt backups and control access
5. **Retention**: Follow compliance requirements
6. **Automation**: Minimize manual intervention
7. **Verification**: Always verify backup integrity

## Emergency Contacts

In case of backup/recovery emergencies:

- Database Administrator: [Contact Info]
- DevOps Team: [Contact Info]
- System Administrator: [Contact Info]
- Management: [Contact Info]

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2023-05-31 | Initial backup procedures |
| 1.1 | 2023-05-31 | Added automated management script |

---

For questions or issues with backup procedures, please refer to the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) guide or contact the development team.