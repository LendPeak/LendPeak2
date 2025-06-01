#!/bin/bash

echo "🧪 Simple Backend Test"
echo "===================="
echo ""

# Check if backend can compile
echo "1. Checking TypeScript compilation..."
cd /Users/winfinit/workspace/lendpeak2
if npx tsc --noEmit 2>&1 | grep -q "error"; then
    echo "❌ Backend has compilation errors"
    echo ""
    echo "Most common issues:"
    echo "- authorize() expects UserRole enum, not string arrays"
    echo "- Routes using yup instead of Joi for validation"
    echo ""
    echo "To fix: Comment out problematic routes in src/api/index.ts"
    exit 1
else
    echo "✅ TypeScript compilation OK"
fi

# Test if backend starts
echo ""
echo "2. Testing backend startup..."
timeout 10s npm run dev > /tmp/backend-test.log 2>&1 &
PID=$!

sleep 5

if ps -p $PID > /dev/null; then
    echo "✅ Backend started successfully"
    kill $PID
else
    echo "❌ Backend crashed on startup"
    echo "Check /tmp/backend-test.log for details"
    exit 1
fi

echo ""
echo "✅ Backend tests passed!"