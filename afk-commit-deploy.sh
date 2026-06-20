#!/bin/bash

# AFK Auto-commit Script for NTS Claims Tracker
# Automatically commits and pushes changes after 2 minutes of inactivity

REPO_DIR="/home/bender/nts.claimstracker"
COMMIT_MESSAGE="afk auto-commit and deploy - power dialer permissions req removed - $(date)"
WAIT_TIME=90  # 1.5 minutes in seconds

# Navigate to repository
cd "$REPO_DIR" || exit 1

# Wait for 1.5 minutes
echo "Waiting 1.5 minutes before committing changes..."
sleep $WAIT_TIME

# Check if there are changes to commit
if [[ -n $(git status -s) ]]; then
    echo "Changes detected. Committing and pushing..."
    
    git add .
    git commit -m "$COMMIT_MESSAGE"
    git push origin main
    
    echo "Changes pushed successfully at $(date)"
    
    # Deploy to Netlify production
    echo "Deploying to Netlify production..."
    netlify deploy --prod
    
    echo "Deployment completed at $(date)"
else
    echo "No changes to commit at $(date)"
fi

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
