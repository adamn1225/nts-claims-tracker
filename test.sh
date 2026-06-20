#!/bin/bash

# NTS Claims Tracker - Playwright Test Quick Start Script
# Automates common Playwright testing tasks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}NTS Claims Tracker - Test Suite${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    npm install -D @playwright/test
fi

# Check if dev server is running
check_dev_server() {
    if ! nc -z localhost 3000 2>/dev/null; then
        echo -e "${YELLOW}Dev server not running on port 3000${NC}"
        echo -e "${BLUE}Starting dev server...${NC}"
        npm run dev &
        DEV_PID=$!
        sleep 5
        echo -e "${GREEN}Dev server started (PID: $DEV_PID)${NC}"
    else
        echo -e "${GREEN}Dev server is running${NC}"
    fi
}

# Parse command
case "${1:-help}" in
    run)
        echo -e "${BLUE}Running all tests...${NC}"
        check_dev_server
        npm run test
        ;;
    
    ui)
        echo -e "${BLUE}Starting test UI mode...${NC}"
        check_dev_server
        npm run test:ui
        ;;
    
    headed)
        echo -e "${BLUE}Running tests in headed mode...${NC}"
        check_dev_server
        npm run test:headed
        ;;
    
    debug)
        echo -e "${BLUE}Starting debug mode...${NC}"
        check_dev_server
        npm run test:debug
        ;;
    
    report)
        echo -e "${BLUE}Showing test report...${NC}"
        npm run test:report
        ;;
    
    auth)
        echo -e "${BLUE}Running authentication tests...${NC}"
        check_dev_server
        npx playwright test tests/auth.spec.ts
        ;;
    
    dashboard)
        echo -e "${BLUE}Running dashboard tests...${NC}"
        check_dev_server
        npx playwright test tests/broker-dashboard.spec.ts
        ;;
    
    tasks)
        echo -e "${BLUE}Running tasks tests...${NC}"
        check_dev_server
        npx playwright test tests/tasks.spec.ts
        ;;
    
    settings)
        echo -e "${BLUE}Running settings tests...${NC}"
        check_dev_server
        npx playwright test tests/settings.spec.ts
        ;;
    
    features)
        echo -e "${BLUE}Running features tests...${NC}"
        check_dev_server
        npx playwright test tests/features.spec.ts
        ;;
    
    install)
        echo -e "${BLUE}Installing Playwright browsers...${NC}"
        npx playwright install --with-deps
        ;;
    
    help)
        echo -e "${BLUE}Available commands:${NC}"
        echo ""
        echo -e "  ${GREEN}npm run test${NC}              Run all tests"
        echo -e "  ${GREEN}npm run test:ui${NC}           Run tests in UI mode (interactive)"
        echo -e "  ${GREEN}npm run test:headed${NC}       Run tests with visible browser"
        echo -e "  ${GREEN}npm run test:debug${NC}        Debug tests with step-through"
        echo -e "  ${GREEN}npm run test:report${NC}       View HTML test report"
        echo ""
        echo -e "${BLUE}Or use this script with:${NC}"
        echo ""
        echo -e "  ${GREEN}./test.sh run${NC}             Run all tests"
        echo -e "  ${GREEN}./test.sh ui${NC}              UI mode"
        echo -e "  ${GREEN}./test.sh headed${NC}          Headed mode"
        echo -e "  ${GREEN}./test.sh debug${NC}           Debug mode"
        echo -e "  ${GREEN}./test.sh report${NC}          View report"
        echo -e "  ${GREEN}./test.sh auth${NC}            Auth tests only"
        echo -e "  ${GREEN}./test.sh dashboard${NC}       Dashboard tests only"
        echo -e "  ${GREEN}./test.sh tasks${NC}           Tasks tests only"
        echo -e "  ${GREEN}./test.sh settings${NC}        Settings tests only"
        echo -e "  ${GREEN}./test.sh features${NC}        Features tests only"
        echo -e "  ${GREEN}./test.sh install${NC}         Install browsers"
        echo ""
        ;;
    
    *)
        echo -e "${RED}Unknown command: ${1}${NC}"
        echo -e "${BLUE}Use './test.sh help' for available commands${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
