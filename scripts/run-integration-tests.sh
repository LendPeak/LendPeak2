#!/bin/bash

# Integration test runner script
echo "🧪 Running LendPeak Integration Tests..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests and check results
run_test_suite() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${YELLOW}Running $test_name...${NC}"
    
    if eval $test_command; then
        echo -e "${GREEN}✅ $test_name passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
}

# Set up environment
export NODE_ENV=test
export REQUIRE_DATABASE=false
export REQUIRE_REDIS=false

# Track failures
FAILED_TESTS=0

# Run backend health tests
run_test_suite "Backend Health Tests" "npm run test -- __tests__/integration/backend-health.test.ts --testTimeout=60000" || ((FAILED_TESTS++))

# Run API route tests
run_test_suite "API Route Tests" "npm run test -- __tests__/integration/api-routes.test.ts" || ((FAILED_TESTS++))

# Run frontend feature tests
run_test_suite "Frontend Feature Tests" "npm run test -- __tests__/integration/frontend-features.test.tsx" || ((FAILED_TESTS++))

# Run calculation tests
run_test_suite "Calculation Engine Tests" "npm run test -- tests/unit/core/calculations/*.test.ts" || ((FAILED_TESTS++))

# Summary
echo ""
echo "=============================="
echo "Integration Test Summary"
echo "=============================="

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All integration tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAILED_TESTS test suite(s) failed${NC}"
    echo ""
    echo "To debug failing tests:"
    echo "1. Check backend logs: tail -f backend.log"
    echo "2. Run individual test: npm run test -- <test-file>"
    echo "3. Run in watch mode: npm run test:watch -- <test-file>"
    exit 1
fi