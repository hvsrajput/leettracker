# 🚀 LeetCode Tracker — Deployment Guide

Free-forever deployment using **AWS Lambda + DynamoDB + S3 + Vercel**.

---

## Prerequisites

- AWS account (free tier)
- Vercel account (free)
- Node.js 18+ installed locally
- AWS CLI configured (`aws configure`) OR manual console setup

---

## Step 1: Create DynamoDB Table

### Via AWS Console:

1. Go to [DynamoDB Console](https://console.aws.amazon.com/dynamodb)
2. Click **Create table**
3. Settings:
   - **Table name**: `LeetTrackerTable`
   - **Partition key**: `PK` (String)
   - **Sort key**: `SK` (String)
4. Under **Table settings**, select **Customize settings**
5. Under **Read/Write capacity settings**, select **On-demand** (pay-per-request, best for low traffic)
6. Click **Create table**

### Via AWS CLI:
```bash
aws dynamodb create-table \
  --table-name LeetTrackerTable \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

---

## Step 2: Seed Default Patterns

```bash
cd server
npm install
```

Set your AWS credentials, then run:
```bash
AWS_REGION=ap-south-1 DYNAMODB_TABLE=LeetTrackerTable npm run seed
```

This creates the 16 default patterns (Arrays, DP, Trees, etc.).

---

## Step 3: Create S3 Backup Bucket

### Via AWS Console:

1. Go to [S3 Console](https://console.aws.amazon.com/s3)
2. Click **Create bucket**
3. Settings:
   - **Bucket name**: `leettracker-backups` (must be globally unique — add your username e.g. `leettracker-backups-hvsrajput`)
   - **Region**: `ap-south-1` (same as DynamoDB)
   - Keep all other defaults (Block all public access = ON)
4. Click **Create bucket**

### Via AWS CLI:
```bash
aws s3 mb s3://leettracker-backups-hvsrajput --region ap-south-1
```

> **Tip**: S3 free tier gives 5 GB storage free for 12 months. Your backups will be <1 MB — effectively free forever.

---

## Step 4: Create API Lambda Function

### 4a. Package the code

```bash
cd server
npm run package
```

This creates `lambda-deploy.zip`.

### 4b. Create Lambda Function (Console)

1. Go to [Lambda Console](https://console.aws.amazon.com/lambda)
2. Click **Create function**
3. Settings:
   - **Function name**: `leettracker-api`
   - **Runtime**: Node.js 20.x
   - **Architecture**: x86_64
4. Click **Create function**

### 4c. Upload Code

1. In the function page, go to **Code** tab
2. Click **Upload from** → **.zip file**
3. Upload `lambda-deploy.zip`

### 4d. Configure Handler

1. Go to **Runtime settings** → **Edit**
2. Set **Handler** to: `lambda.handler`
3. Click **Save**

### 4e. Set Environment Variables

1. Go to **Configuration** → **Environment variables** → **Edit**
2. Add:
   - `JWT_SECRET` = `your-strong-secret-key-here`
   - `DYNAMODB_TABLE` = `LeetTrackerTable`
   - `S3_BACKUP_BUCKET` = `leettracker-backups-hvsrajput` (your bucket name)
3. Click **Save**

### 4f. Set Timeout & Memory

1. Go to **Configuration** → **General configuration** → **Edit**
2. Set **Timeout** to **30 seconds**
3. Set **Memory** to **256 MB**
4. Click **Save**

### 4g. Add Permissions

1. Go to **Configuration** → **Permissions**
2. Click the **Role name** link (opens IAM) — **note this role name**, you'll reuse it for the backup Lambda
3. Click **Add permissions** → **Attach policies**
4. Search and attach: `AmazonDynamoDBFullAccess`
5. Search and attach: `AmazonS3FullAccess`
6. Click **Add permissions**

> For production, create a custom policy with only the needed permissions. For a personal project, full access is fine.

---

## Step 5: Create API Gateway

### 5a. Create HTTP API

1. Go to [API Gateway Console](https://console.aws.amazon.com/apigateway)
2. Click **Create API** → **HTTP API** → **Build**
3. Add integration:
   - **Integration type**: Lambda
   - **Lambda function**: `leettracker-api`
4. Set **API name**: `leettracker-api`
5. Click **Next**

### 5b. Configure Routes

1. Click **Add route**:
   - **Method**: `ANY`
   - **Path**: `/{proxy+}`
   - **Integration**: `leettracker-api`
2. Click **Next**

### 5c. Configure Stage

1. Keep **Stage name**: `$default` (auto-deploy)
2. Click **Next** → **Create**

### 5d. Enable CORS

1. In the API, go to **CORS**
2. Click **Configure**
3. Settings:
   - **Access-Control-Allow-Origin**: `*` (or your Vercel domain)
   - **Access-Control-Allow-Headers**: `Content-Type, Authorization`
   - **Access-Control-Allow-Methods**: `GET, POST, PUT, DELETE, OPTIONS`
4. Click **Save**

### 5e. Note Your API URL

Your API URL will look like:
```
https://abc123def4.execute-api.ap-south-1.amazonaws.com
```

Test it:
```bash
curl https://abc123def4.execute-api.ap-south-1.amazonaws.com/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## Step 6: Create Daily Backup Lambda

This is a **separate Lambda function** that runs once per day to back up all data to S3.

### 6a. Create Function

1. Go to [Lambda Console](https://console.aws.amazon.com/lambda)
2. Click **Create function**
3. Settings:
   - **Function name**: `leettracker-backup`
   - **Runtime**: Node.js 20.x
   - **Use an existing role**: Select the same role as `leettracker-api` (it already has DynamoDB + S3 permissions)
4. Click **Create function**

### 6b. Upload Same Code

1. Upload the **same** `lambda-deploy.zip` file
2. Go to **Runtime settings** → **Edit**
3. Set **Handler** to: `lambda-backup.handler`
4. Click **Save**

### 6c. Set Environment Variables

1. Add the same env vars:
   - `DYNAMODB_TABLE` = `LeetTrackerTable`
   - `S3_BACKUP_BUCKET` = `leettracker-backups-hvsrajput`
2. Click **Save**

### 6d. Set Timeout

1. Set **Timeout** to **60 seconds** (backup scans the full table)
2. Set **Memory** to **256 MB**

### 6e. Add Daily Schedule (EventBridge)

1. In the `leettracker-backup` function, go to **Configuration** → **Triggers**
2. Click **Add trigger**
3. Select **EventBridge (CloudWatch Events)**
4. Choose **Create a new rule**:
   - **Rule name**: `leettracker-daily-backup`
   - **Rule type**: Schedule expression
   - **Schedule expression**: `rate(1 day)`
5. Click **Add**

> ✅ This will automatically run the backup Lambda once every 24 hours. Backups are stored in S3 organized by date: `backups/2026-03-11/leettracker-2026-03-11T...json`

---

## Step 7: Deploy Frontend to Vercel

### 7a. Update Frontend API URL

Edit `client/.env`:
```
VITE_API_URL=https://abc123def4.execute-api.ap-south-1.amazonaws.com/api
```

### 7b. Deploy

**Option A: Vercel CLI**
```bash
cd client
npx -y vercel --prod
```

**Option B: Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo: `hvsrajput/leettracker`
3. Set:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variable:
   - `VITE_API_URL` = `https://your-api-gateway-url.amazonaws.com/api`
5. Deploy!

---

## 💰 Cost Analysis (Free Tier)

| Service | Free Tier | Your Usage | Cost |
|---------|-----------|------------|------|
| **Lambda** | 1M requests + 400,000 GB-seconds/month | ~130 requests/month (100 API + 30 backup) | **$0** |
| **API Gateway** | 1M HTTP API calls/month (12 months) | ~100 calls/month | **$0** |
| **DynamoDB** | 25 GB storage + 25 RCU + 25 WCU | <1 MB, minimal reads | **$0** |
| **S3** | 5 GB storage (12 months) | <1 MB of backups | **$0** |
| **Vercel** | Unlimited static sites | 1 site | **$0** |

> **Total: $0/month forever** for 2-3 users with low traffic.

> After the 12-month free tier expires for API Gateway, it's $1/million calls — still effectively free at your usage.

---

## 🔄 Updating the Code

When you make changes:

```bash
cd server
npm run package
# Upload lambda-deploy.zip to Lambda console
```

For frontend:
```bash
cd client
npx -y vercel --prod
# Or push to GitHub (auto-deploys if connected)
```

---

## 📦 Backup

**Automatic**: Daily backups run automatically via EventBridge → Lambda → S3.

Backups are stored at: `s3://your-bucket/backups/YYYY-MM-DD/leettracker-TIMESTAMP.json`

**Manual**: Trigger a backup + download anytime:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api-url.amazonaws.com/api/backup \
  -o backup.json
```

**View backups in S3**:
```bash
aws s3 ls s3://leettracker-backups-hvsrajput/backups/ --recursive
```

---

## 🛠 Local Development

You can still run the server locally for development:

```bash
cd server
npm install
npm start
# Server runs on http://localhost:5000
```

Make sure your `.env` has valid AWS credentials for DynamoDB access:
```
JWT_SECRET=your-secret
AWS_REGION=ap-south-1
DYNAMODB_TABLE=LeetTrackerTable
S3_BACKUP_BUCKET=leettracker-backups-hvsrajput
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

Frontend:
```bash
cd client
npm install
npm run dev
# Frontend runs on http://localhost:5173
```
