#!/bin/bash

# MongoDB Setup Script - Creates system-wide symlinks for MongoDB binaries
# Run this with: sudo bash setup-mongodb-links.sh

MONGODB_DIR="/Users/winfinit/mongodb-macos-x86_64-7.0.14/bin"
TARGET_DIR="/usr/local/bin"

echo "Setting up MongoDB symlinks..."

# Create /usr/local/bin if it doesn't exist
if [ ! -d "$TARGET_DIR" ]; then
    echo "Creating $TARGET_DIR directory..."
    mkdir -p "$TARGET_DIR"
fi

# Create symlinks for MongoDB binaries
echo "Creating symlink for mongod..."
ln -sf "$MONGODB_DIR/mongod" "$TARGET_DIR/mongod"

echo "Creating symlink for mongos..."
ln -sf "$MONGODB_DIR/mongos" "$TARGET_DIR/mongos"

# Verify the symlinks
echo ""
echo "Verifying symlinks..."
ls -la "$TARGET_DIR/mongod"
ls -la "$TARGET_DIR/mongos"

echo ""
echo "MongoDB setup complete!"
echo "You can now use 'mongod' and 'mongos' commands from anywhere."
echo ""
echo "To test, run: mongod --version"