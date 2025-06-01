#!/bin/bash

# MongoDB startup script for LendPeak2 development

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MONGODB_VERSION="8.0"
DATA_DIR="./data/db"
LOG_DIR="./data/logs"
PORT=27017
DB_NAME="lendpeak2"

# Create necessary directories
echo -e "${YELLOW}Setting up MongoDB directories...${NC}"
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"

# Check for MongoDB in PATH
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGOD_PATH="mongod"

# Check if MongoDB is available
if ! command -v $MONGOD_PATH &> /dev/null; then
    echo -e "${RED}MongoDB not found in PATH!${NC}"
    echo "Please run: sudo bash setup-mongodb-links.sh"
    echo "Or install MongoDB and ensure it's in your PATH"
    exit 1
fi

# Check if MongoDB is already running
if pgrep -x "mongod" > /dev/null; then
    echo -e "${YELLOW}MongoDB is already running. Checking if it's using our data directory...${NC}"
    
    # Check if it's our instance
    if lsof -i:$PORT > /dev/null 2>&1; then
        echo -e "${GREEN}MongoDB is running on port $PORT${NC}"
        echo "Use './scripts/stop-mongodb.sh' to stop it first if you want to restart"
        exit 0
    fi
fi

# Start MongoDB
echo -e "${GREEN}Starting MongoDB...${NC}"
echo "Data directory: $DATA_DIR"
echo "Log file: $LOG_DIR/mongodb.log"
echo "Port: $PORT"

# Start MongoDB without replica set (transactions not available)
$MONGOD_PATH \
    --dbpath "$DATA_DIR" \
    --logpath "$LOG_DIR/mongodb.log" \
    --port $PORT \
    --bind_ip localhost \
    --fork

# Wait for MongoDB to start
echo -e "${YELLOW}Waiting for MongoDB to start...${NC}"
sleep 3

# Check if MongoDB started successfully
if pgrep -x "mongod" > /dev/null; then
    echo -e "${GREEN}MongoDB started successfully!${NC}"
    
    # Initialize replica set if not already initialized
    echo -e "${YELLOW}Checking replica set status...${NC}"
    
    # Try to get replica set status
    # MongoDB 7.0 doesn't include mongosh, skip initialization steps
    RS_STATUS="0"
    echo -e "${YELLOW}Note: MongoDB shell not available in this version. Skipping replica set initialization.${NC}"
    
    # Skip replica set initialization for MongoDB 7.0 without shell
    echo -e "${YELLOW}Note: Running without replica set. Transactions will not be available.${NC}"
    
    # Skip database setup for MongoDB 7.0 without shell
    echo -e "${YELLOW}Note: Database collections will be created on first use.${NC}"
    
    # Comment out the mongosh eval command
    : << 'SKIP_MONGOSH'
        use $DB_NAME;
        
        // Create collections if they don't exist
        if (!db.getCollectionNames().includes('users')) {
            db.createCollection('users');
            db.users.createIndex({ email: 1 }, { unique: true });
            print('Created users collection');
        }
        
        if (!db.getCollectionNames().includes('loans')) {
            db.createCollection('loans');
            db.loans.createIndex({ loanNumber: 1 }, { unique: true });
            db.loans.createIndex({ borrowerId: 1 });
            db.loans.createIndex({ status: 1 });
            db.loans.createIndex({ createdAt: -1 });
            print('Created loans collection');
        }
        
        if (!db.getCollectionNames().includes('documents')) {
            db.createCollection('documents');
            db.documents.createIndex({ loanId: 1 });
            db.documents.createIndex({ uploadedAt: -1 });
            print('Created documents collection');
        }
        
        if (!db.getCollectionNames().includes('borrowers')) {
            db.createCollection('borrowers');
            db.borrowers.createIndex({ email: 1 });
            db.borrowers.createIndex({ ssn: 1 });
            db.borrowers.createIndex({ createdAt: -1 });
            print('Created borrowers collection');
        }
        
        print('Database setup complete!');
    "
SKIP_MONGOSH
    
    echo -e "${GREEN}MongoDB is ready!${NC}"
    echo -e "Connection string: ${YELLOW}mongodb://localhost:$PORT/$DB_NAME${NC}"
    echo -e "Note: Install mongosh separately with: ${YELLOW}brew install mongosh${NC}"
    echo -e "To stop MongoDB: ${YELLOW}./scripts/stop-mongodb.sh${NC}"
else
    echo -e "${RED}Failed to start MongoDB!${NC}"
    echo "Check the log file for errors: $LOG_DIR/mongodb.log"
    exit 1
fi