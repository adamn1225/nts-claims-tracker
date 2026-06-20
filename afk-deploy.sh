#!/bin/bash

# AFK Auto-deploy Script for NTS Claims Tracker
# Automatically deploys to Netlify production after 2 minutes of inactivity

REPO_DIR="/home/bender/nts.claimstracker"
WAIT_TIME=150  # 2 minutes in seconds

# Navigate to repository
cd "$REPO_DIR" || exit 1

# Wait for 2 minutes
echo "Waiting 2 minutes before deploying..."
sleep $WAIT_TIME

# Deploy to Netlify production
echo "Deploying to Netlify production at $(date)..."
netlify deploy --prod

if [ $? -eq 0 ]; then
    echo "Deployment completed successfully at $(date)"
else
    echo "Deployment failed at $(date)"
    exit 1
fi
