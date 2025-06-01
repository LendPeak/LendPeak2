#!/bin/bash

# LendPeak2 Database Backup Management Script
# Provides comprehensive backup and restore operations

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./data/backups"
LOG_DIR="./data/logs"
DB_NAME="lendpeak2"
RETENTION_DAYS=30

# Functions
show_usage() {
    echo -e "${BLUE}LendPeak2 Backup Management${NC}"
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo -e "${CYAN}Commands:${NC}"
    echo "  create      Create a new backup"
    echo "  list        List all available backups"
    echo "  restore     Restore from a backup"
    echo "  cleanup     Remove old backups"
    echo "  schedule    Show backup schedule"
    echo "  test        Test backup system"
    echo ""
    echo -e "${CYAN}Options for 'create':${NC}"
    echo "  --compress  Compress the backup (default)"
    echo "  --no-compress  Don't compress"
    echo "  --exclude-sessions  Exclude session data"
    echo ""
    echo -e "${CYAN}Options for 'restore':${NC}"
    echo "  --backup-name NAME  Specify backup to restore"
    echo "  --confirm   Skip confirmation prompt"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  $0 create --compress"
    echo "  $0 restore --backup-name backup-2023-05-31"
    echo "  $0 cleanup"
}

check_dependencies() {
    local missing=0
    
    if ! command -v mongodump &> /dev/null; then
        echo -e "${RED}❌ mongodump not found${NC}"
        missing=1
    fi
    
    if ! command -v mongorestore &> /dev/null; then
        echo -e "${RED}❌ mongorestore not found${NC}"
        missing=1
    fi
    
    if ! pgrep -x "mongod" > /dev/null; then
        echo -e "${RED}❌ MongoDB is not running${NC}"
        missing=1
    fi
    
    if [ $missing -eq 1 ]; then
        echo -e "${YELLOW}Please ensure MongoDB and MongoDB tools are installed and running${NC}"
        exit 1
    fi
}

create_backup() {
    local compress=true
    local exclude_sessions=true
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-compress)
                compress=false
                shift
                ;;
            --compress)
                compress=true
                shift
                ;;
            --exclude-sessions)
                exclude_sessions=true
                shift
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                exit 1
                ;;
        esac
    done
    
    echo -e "${BLUE}🚀 Creating database backup...${NC}"
    
    # Create directories
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
    
    # Generate backup name
    local timestamp=$(date +"%Y-%m-%d_%H-%M-%S")
    local backup_name="backup-$timestamp"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    echo -e "${YELLOW}📁 Backup path: $backup_path${NC}"
    
    # Build mongodump command
    local cmd="mongodump --uri=\"mongodb://localhost:27017/$DB_NAME\" --out=\"$backup_path\""
    
    if [ "$exclude_sessions" = true ]; then
        cmd="$cmd --excludeCollection=sessions --excludeCollection=cache"
    fi
    
    # Execute backup
    echo -e "${YELLOW}⏳ Running mongodump...${NC}"
    eval $cmd > "$LOG_DIR/backup_$timestamp.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database backup completed${NC}"
        
        # Show backup size
        local size=$(du -sh "$backup_path" | cut -f1)
        echo -e "   Size: $size"
        
        # Compress if requested
        if [ "$compress" = true ]; then
            echo -e "${YELLOW}🗜️  Compressing backup...${NC}"
            local compressed_path="$backup_path.tar.gz"
            tar -czf "$compressed_path" -C "$BACKUP_DIR" "$backup_name"
            
            if [ $? -eq 0 ]; then
                # Remove original and show compressed size
                rm -rf "$backup_path"
                local compressed_size=$(du -sh "$compressed_path" | cut -f1)
                echo -e "${GREEN}✅ Backup compressed successfully${NC}"
                echo -e "   Compressed size: $compressed_size"
                backup_path="$compressed_path"
            else
                echo -e "${RED}❌ Compression failed${NC}"
            fi
        fi
        
        echo -e "${GREEN}🎉 Backup created: $(basename $backup_path)${NC}"
        
    else
        echo -e "${RED}❌ Backup failed. Check log: $LOG_DIR/backup_$timestamp.log${NC}"
        exit 1
    fi
}

list_backups() {
    echo -e "${BLUE}📋 Available Backups${NC}"
    echo "===================="
    
    if [ ! -d "$BACKUP_DIR" ]; then
        echo -e "${YELLOW}No backup directory found${NC}"
        return
    fi
    
    local count=0
    for file in "$BACKUP_DIR"/backup-*; do
        if [ -e "$file" ]; then
            local name=$(basename "$file")
            local size=$(du -sh "$file" | cut -f1)
            local date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || stat -c "%y" "$file" 2>/dev/null | cut -d' ' -f1-2)
            
            echo -e "${GREEN}$name${NC}"
            echo -e "  Size: $size"
            echo -e "  Date: $date"
            echo ""
            ((count++))
        fi
    done
    
    if [ $count -eq 0 ]; then
        echo -e "${YELLOW}No backups found${NC}"
    else
        echo -e "${CYAN}Total backups: $count${NC}"
    fi
}

restore_backup() {
    local backup_name=""
    local confirm=false
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup-name)
                backup_name="$2"
                shift 2
                ;;
            --confirm)
                confirm=true
                shift
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                exit 1
                ;;
        esac
    done
    
    if [ -z "$backup_name" ]; then
        echo -e "${YELLOW}Available backups:${NC}"
        list_backups
        echo ""
        read -p "Enter backup name to restore: " backup_name
    fi
    
    local backup_path="$BACKUP_DIR/$backup_name"
    
    # Check if backup exists
    if [ ! -e "$backup_path" ]; then
        echo -e "${RED}❌ Backup not found: $backup_name${NC}"
        exit 1
    fi
    
    # Warning
    if [ "$confirm" = false ]; then
        echo -e "${RED}⚠️  WARNING: This will overwrite the current database!${NC}"
        echo -e "${YELLOW}Database: $DB_NAME${NC}"
        echo -e "${YELLOW}Backup: $backup_name${NC}"
        echo ""
        read -p "Are you sure? (yes/no): " response
        
        if [ "$response" != "yes" ]; then
            echo -e "${YELLOW}Restore cancelled${NC}"
            exit 0
        fi
    fi
    
    echo -e "${BLUE}🔄 Restoring database from backup...${NC}"
    
    local restore_path="$backup_path"
    
    # If it's compressed, extract it first
    if [[ "$backup_path" == *.tar.gz ]]; then
        echo -e "${YELLOW}📦 Extracting compressed backup...${NC}"
        local extract_path="$BACKUP_DIR/temp_restore_$$"
        mkdir -p "$extract_path"
        tar -xzf "$backup_path" -C "$extract_path"
        restore_path="$extract_path/$(basename ${backup_path%.tar.gz})"
    fi
    
    # Execute restore
    echo -e "${YELLOW}⏳ Running mongorestore...${NC}"
    local timestamp=$(date +"%Y-%m-%d_%H-%M-%S")
    mongorestore --uri="mongodb://localhost:27017" --drop "$restore_path/$DB_NAME" > "$LOG_DIR/restore_$timestamp.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database restored successfully${NC}"
    else
        echo -e "${RED}❌ Restore failed. Check log: $LOG_DIR/restore_$timestamp.log${NC}"
        exit 1
    fi
    
    # Cleanup temporary files
    if [[ "$backup_path" == *.tar.gz ]]; then
        rm -rf "$extract_path"
    fi
}

cleanup_backups() {
    echo -e "${BLUE}🧹 Cleaning up old backups...${NC}"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        echo -e "${YELLOW}No backup directory found${NC}"
        return
    fi
    
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%s 2>/dev/null || date -v-${RETENTION_DAYS}d +%s 2>/dev/null)
    local removed=0
    
    for file in "$BACKUP_DIR"/backup-*; do
        if [ -e "$file" ]; then
            local file_date=$(stat -f "%m" "$file" 2>/dev/null || stat -c "%Y" "$file" 2>/dev/null)
            
            if [ "$file_date" -lt "$cutoff_date" ]; then
                echo -e "${YELLOW}Removing old backup: $(basename $file)${NC}"
                rm -rf "$file"
                ((removed++))
            fi
        fi
    done
    
    echo -e "${GREEN}✅ Cleanup completed. Removed $removed old backups${NC}"
}

show_schedule() {
    echo -e "${BLUE}📅 Backup Schedule Information${NC}"
    echo "==============================="
    echo ""
    echo -e "${CYAN}Recommended Schedule:${NC}"
    echo "  • Daily backups during business hours"
    echo "  • Weekly full backups on weekends"
    echo "  • Monthly archived backups"
    echo ""
    echo -e "${CYAN}Retention Policy:${NC}"
    echo "  • Daily backups: 30 days"
    echo "  • Weekly backups: 12 weeks"
    echo "  • Monthly backups: 12 months"
    echo ""
    echo -e "${CYAN}Cron Examples:${NC}"
    echo "  # Daily backup at 2 AM"
    echo "  0 2 * * * cd /path/to/lendpeak2 && ./scripts/backup-management.sh create --compress"
    echo ""
    echo "  # Weekly cleanup on Sundays"
    echo "  0 3 * * 0 cd /path/to/lendpeak2 && ./scripts/backup-management.sh cleanup"
}

# Main script logic
case "${1:-}" in
    create)
        check_dependencies
        shift
        create_backup "$@"
        ;;
    list)
        list_backups
        ;;
    restore)
        check_dependencies
        shift
        restore_backup "$@"
        ;;
    cleanup)
        cleanup_backups
        ;;
    schedule)
        show_schedule
        ;;
    test)
        check_dependencies
        ./scripts/test-backup.sh
        ;;
    -h|--help|help)
        show_usage
        ;;
    "")
        show_usage
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac