#!/bin/bash

# Exit on any failure
set -e

echo "============================================="
echo "🚀 LeetCode Tracker — Auto Deployment Script"
echo "============================================="
echo ""

# 1. Force pull latest changes from GitHub
echo "📥 STEP 1: Pulling latest changes from GitHub..."
git fetch --all
# Force reset to match origin/main exactly, overwriting any local changes
git reset --hard origin/main
echo "✅ GitHub sync complete!"
echo ""

# 2. Package and Deploy Backend to AWS Lambda
echo "⚡ STEP 2: Packaging & Deploying Backend to AWS Lambda..."
cd server
npm install

echo "🗜️ Zipping backend files..."
npm run package

echo "☁️ Uploading leettracker-api to AWS..."
aws lambda update-function-code \
  --function-name leettracker-api \
  --zip-file fileb://lambda-deploy.zip \
  --region ap-south-1 \
  --no-cli-pager > /dev/null

echo "☁️ Uploading leettracker-backup to AWS..."
aws lambda update-function-code \
  --function-name leettracker-backup \
  --zip-file fileb://lambda-deploy.zip \
  --region ap-south-1 \
  --no-cli-pager > /dev/null

echo "✅ Backend deployed to AWS!"
cd ..
echo ""

# 3. Frontend Deployment Note
echo "🌐 STEP 3: Frontend Deployment"
echo "Vercel is linked to the GitHub repository and will automatically deploy the frontend when changes are pushed!"
echo ""

echo "🎉 ALL DONE! Backend is successfully updated and live! Vercel is handling the frontend! 🚀"
