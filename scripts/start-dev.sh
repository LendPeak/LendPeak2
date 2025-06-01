#!/bin/bash

# Development startup script
echo "🚀 Starting LendPeak Development Server..."
echo "ℹ️  This script runs the backend without requiring MongoDB or Redis"
echo ""

# Set environment variables for development
export NODE_ENV=development
export MONGODB_URI=mongodb://localhost:27017/lendpeak_dev
export REQUIRE_DATABASE=false
export REQUIRE_REDIS=false

# Copy development env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📋 Copying development environment file..."
    cp .env.development .env
fi

# Start the backend with --no-deps flag
echo "🔧 Starting backend (without database dependencies)..."
echo ""

# Use ts-node directly to bypass database connection
npx ts-node --transpile-only src/index.ts 2>&1 | grep -v "ioredis" | grep -v "ECONNREFUSED"