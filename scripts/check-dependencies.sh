#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== LendPeak2 Dependency Check ==="
echo ""

# Check Node.js
echo -n "Node.js: "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Installed ($NODE_VERSION)${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
    echo "  Install: https://nodejs.org/"
fi

# Check npm
echo -n "npm: "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓ Installed (v$NPM_VERSION)${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
fi

# Check MongoDB
echo -n "MongoDB: "
if command -v mongod &> /dev/null || command -v mongosh &> /dev/null; then
    if command -v mongod &> /dev/null; then
        MONGO_VERSION=$(mongod --version 2>/dev/null | grep "db version" | awk '{print $3}' | head -1)
        echo -e "${GREEN}✓ Installed (v$MONGO_VERSION)${NC}"
    else
        echo -e "${GREEN}✓ Installed${NC}"
    fi
else
    echo -e "${YELLOW}✗ Not installed (optional for demo mode)${NC}"
    echo "  To install MongoDB:"
    echo "    macOS: brew install mongodb-community"
    echo "    Ubuntu: sudo apt-get install mongodb"
    echo "    Other: https://docs.mongodb.com/manual/installation/"
fi

# Check Git
echo -n "Git: "
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | awk '{print $3}')
    echo -e "${GREEN}✓ Installed (v$GIT_VERSION)${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
fi

echo ""
echo "=== Quick Start Options ==="
echo ""

if command -v mongod &> /dev/null; then
    echo "1. Full development (with database):"
    echo "   ${GREEN}npm start${NC}"
    echo ""
    echo "2. Fresh start with sample data:"
    echo "   ${GREEN}npm run start:fresh${NC}"
else
    echo "1. Frontend only (demo mode - no database needed):"
    echo "   ${GREEN}npm run start:frontend${NC}"
    echo ""
    echo "2. To use full features, install MongoDB first"
fi

echo ""