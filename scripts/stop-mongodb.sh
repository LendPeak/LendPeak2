#!/bin/bash

# MongoDB stop script for LendPeak2 development

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PORT=27017

echo -e "${YELLOW}Stopping MongoDB...${NC}"

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo -e "${YELLOW}MongoDB is not running${NC}"
    exit 0
fi

# Try graceful shutdown first
if command -v mongosh &> /dev/null; then
    echo -e "${YELLOW}Attempting graceful shutdown...${NC}"
    mongosh --port $PORT --eval "db.adminCommand({ shutdown: 1 })" 2>/dev/null || true
    sleep 2
fi

# Check if still running and force kill if necessary
if pgrep -x "mongod" > /dev/null; then
    echo -e "${YELLOW}Force stopping MongoDB...${NC}"
    pkill -9 mongod
    sleep 1
fi

# Verify stopped
if ! pgrep -x "mongod" > /dev/null; then
    echo -e "${GREEN}MongoDB stopped successfully!${NC}"
else
    echo -e "${RED}Failed to stop MongoDB!${NC}"
    exit 1
fi