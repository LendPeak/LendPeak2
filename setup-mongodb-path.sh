#!/bin/bash

# Alternative MongoDB Setup - Add MongoDB to PATH
# This doesn't require sudo but needs to be added to your shell profile

MONGODB_BIN_DIR="/Users/winfinit/mongodb-macos-x86_64-7.0.14/bin"

echo "MongoDB PATH Setup"
echo "=================="
echo ""
echo "Add the following line to your shell profile:"
echo ""

# Detect shell
if [[ "$SHELL" == *"zsh"* ]]; then
    PROFILE_FILE="~/.zshrc"
elif [[ "$SHELL" == *"bash"* ]]; then
    PROFILE_FILE="~/.bash_profile"
else
    PROFILE_FILE="your shell profile"
fi

echo "For $SHELL, add to $PROFILE_FILE:"
echo ""
echo "export PATH=\"$MONGODB_BIN_DIR:\$PATH\""
echo ""
echo "Then reload your shell configuration:"
echo "source $PROFILE_FILE"
echo ""
echo "Or simply restart your terminal."