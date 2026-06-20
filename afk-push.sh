#!/bin/bash

# AFK Auto-commit Script for NTS Claims Tracker
# Automatically commits and pushes changes after 2 minutes of inactivity

REPO_DIR="/home/bender/nts.claimstracker"
COMMIT_MESSAGE="afk auto-commit and deploy - analytics revamp - activity heatmap and maintenance page revamp- $(date)"
WAIT_TIME=150  # 2 minutes in seconds

# Navigate to repository
cd "$REPO_DIR" || exit 1

# Wait for 2 minutes
echo "Waiting 2 minutes before committing changes..."
sleep $WAIT_TIME

# Check if there are changes to commit
if [[ -n $(git status -s) ]]; then
    echo "Changes detected. Committing and pushing..."
    
    git add .
    git commit -m "$COMMIT_MESSAGE"
    git push origin main
    
    echo "Changes pushed successfully at $(date)"
    
else
    echo "No changes to commit at $(date)"
fi
