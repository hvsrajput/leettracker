# ⚡ LeetTracker

A multi-user LeetCode problem tracker where users can organize and track coding problems by patterns, collaborate in groups, and visualize their progress.

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?logo=aws&logoColor=white)
![DynamoDB](https://img.shields.io/badge/Amazon-DynamoDB-4053D6?logo=amazon-dynamodb&logoColor=white)

---

## ✨ Features

- **🔐 Authentication** — Register / login with JWT-based sessions
- **📝 Problem Tracking** — Add problems by LeetCode number; title, difficulty, pattern, and URL are auto-fetched from a built-in 150+ problem dataset
- **🏷️ Pattern Tabs** — 16 default patterns (Arrays, DP, Graphs, Trees, etc.) + create your own custom patterns
- **✅ Checkmark Progress** — One-click solved/unsolved toggle per problem
- **🔍 Filters** — Filter by solved/unsolved, difficulty (Easy/Medium/Hard), and pattern
- **👥 Groups** — Create study groups, add members by username, and track per-member solve status on shared problem lists
- **📊 Dashboard** — SVG progress ring, difficulty breakdown, pattern-wise progress bars, group stats, and recent activity
- **🔗 LeetCode Links** — Click any problem title to open it on LeetCode in a new tab
- **🌙 Dark Theme** — Modern dark UI with glassmorphism cards, gradient accents, and smooth animations

---

## 🛠️ Tech Stack

| Layer    | Technology                  |
|----------|-----------------------------|
| Frontend | React 19, Vite 7, Axios    |
| Backend  | Node.js, Express on AWS Lambda |
| Database | Amazon DynamoDB (Single Table) |
| Auth     | JWT (jsonwebtoken, bcryptjs)|
| Styling  | Vanilla CSS, Inter font     |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm

### 1. Clone the repo

```bash
git clone https://github.com/hvsrajput/leettracker.git
cd leettracker
```

### 2. Set up the backend

```bash
cd server
npm install
```

Create a `.env` file (see `.env.example`):

```env
JWT_SECRET=your-secret-key-here
PORT=5000
AWS_REGION=ap-south-1
DYNAMODB_TABLE=LeetTrackerTable
S3_BACKUP_BUCKET=leettracker-backups
```

*(Note: If running locally without an IAM role, also add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`).*

Seed the DynamoDB table with default patterns:

```bash
npm run seed
```

Start the local Express server:

```bash
npm start
```

### 3. Set up the frontend

```bash
cd client
npm install
```

Create a `.env` file pointing to your local server (or AWS API Gateway URL):

```env
VITE_API_URL=http://localhost:5000/api
```

Start the dev server:

```bash
npm run dev
```

### 4. Deploying to Production

The app is built for **zero-cost serverless** deployment:
- **Frontend**: Deploy to Vercel (free tier)
- **Backend API**: Package with `npm run package` and deploy to AWS Lambda
- **Database**: AWS DynamoDB (on-demand capacity)
- **Automated Backup**: AWS EventBridge scheduling Lambda to upload JSON to S3

Check out [`DEPLOY.md`](./DEPLOY.md) for full deployment instructions, or simply run `./deploy.sh` to automatically push changes to AWS and Vercel.

---

## 📁 Project Structure

```
leettracker/
├── server/
│   ├── index.js                # Express local entry & app logic
│   ├── lambda.js               # AWS Lambda handler (API endpoint)
│   ├── lambda-backup.js        # AWS Lambda handler (Scheduled EventBridge backup)
│   ├── backup.js               # S3 Backup logic
│   ├── middleware/auth.js       # JWT verification
│   ├── routes/
│   │   ├── auth.js             # Register, login, me
│   │   ├── patterns.js         # List & add patterns
│   │   ├── problems.js         # CRUD, lookup, toggle
│   │   ├── groups.js           # Groups, members, status
│   │   └── dashboard.js        # Aggregated stats
│   ├── data/problems.json      # 150+ curated LC problems
│   ├── db/
│   │   ├── dynamodb.js         # DynamoDB client & helpers
│   │   └── seed-dynamodb.js    # Seed script for patterns
│   ├── .env.example
│   └── package.json
├── client/
│   ├── vercel.json             # Vercel SPA routing rules
│   └── src/
│       ├── api/index.js        # Axios + JWT interceptor
│       ├── context/AuthContext.jsx
│       ├── components/
│       │   ├── Navbar.jsx
│       │   └── ProtectedRoute.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Problems.jsx
│       │   ├── Groups.jsx
│       │   └── GroupDetail.jsx
│       └── index.css           # Design system
├── DEPLOY.md                   # Full AWS + Vercel deployment guide
├── deploy.sh                   # Automated deployment shell script
├── .gitignore
└── README.md
```

---

## 📡 API Endpoints

| Method | Endpoint                      | Description                         |
|--------|-------------------------------|-------------------------------------|
| POST   | `/api/auth/register`          | Create account                      |
| POST   | `/api/auth/login`             | Login, returns JWT                  |
| GET    | `/api/auth/me`                | Current user info                   |
| GET    | `/api/patterns`               | List all patterns                   |
| POST   | `/api/patterns`               | Add custom pattern                  |
| GET    | `/api/problems`               | Filtered problem list               |
| POST   | `/api/problems`               | Add problem by LC number            |
| GET    | `/api/problems/lookup/:num`   | Preview problem from dataset        |
| POST   | `/api/problems/:id/toggle`    | Toggle solved status                |
| GET    | `/api/groups`                 | List user's groups                  |
| POST   | `/api/groups`                 | Create group                        |
| GET    | `/api/groups/:id`             | Group detail + member statuses      |
| POST   | `/api/groups/:id/members`     | Add member by username              |
| POST   | `/api/groups/:id/problems`    | Add problem to group                |
| GET    | `/api/dashboard`              | Stats: solved, patterns, groups     |

---

## 👥 Contributors

- [@hvsrajput](https://github.com/hvsrajput)
- [@sahaymihir](https://github.com/sahaymihir)

---

## 📄 License

This project is private and not licensed for public use.
