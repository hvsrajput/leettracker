# LeetTracker

LeetTracker is a full-stack LeetCode tracking app for personal practice and group collaboration. It lets users track problems with `unsolved`, `attempted`, and `solved` states, organize work by topics and companies, sync solved problems from LeetCode, and view progress through dashboards and shared group views.

## What The App Does

- Personal problem tracking with `unsolved`, `attempted`, and `solved` states
- Dynamic topic filters generated from the actual tracked problem set
- Difficulty, company, and status filters
- Group problem sets with per-member progress columns
- Add-to-group from your own problem set, including multi-select flows
- Dashboard with activity heatmap, pattern insights, company progress, group stats, and recent activity
- LeetCode import and sync using a saved public LeetCode username
- Mobile-friendly and desktop-friendly React SPA
- Manual and scheduled DynamoDB backups to S3

## Current Architecture

- Frontend: React single-page app deployed to Vercel
- Backend API: Express app wrapped for AWS Lambda with `serverless-http`
- API entrypoint: AWS API Gateway -> Lambda -> Express routes
- Primary data store: Amazon DynamoDB using a single-table design
- Backup worker: separate scheduled Lambda that exports data to Amazon S3
- LeetCode integration: backend requests LeetCode's public GraphQL endpoints
- Problem metadata source: local JSON dataset plus live LeetCode fallback for sync/import edge cases

## Complete Tech Stack

This section reflects the code that is currently in the repository.

| Category | Technologies in use | Notes |
| --- | --- | --- |
| Languages | JavaScript, JSON, CSS, Bash | JavaScript is used on both client and server |
| Frontend framework | React 19, React DOM 19 | SPA UI |
| Frontend routing | React Router DOM 7 | Page routing and protected routes |
| Frontend build tool | Vite 5, `@vitejs/plugin-react` | Dev server and production build |
| Frontend HTTP client | Axios | API requests from the browser |
| Frontend styling | Tailwind CSS 3, PostCSS, Autoprefixer, custom CSS | Tailwind utility styling plus custom styles |
| Fonts | Google Fonts: Inter, JetBrains Mono | Loaded in [`client/index.html`](client/index.html) |
| Frontend quality tooling | ESLint 9, `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` | Linting setup |
| Backend runtime | Node.js, Express 4 | API server logic |
| Backend serverless adapter | `serverless-http` | Wraps Express for Lambda |
| Backend HTTP client | Axios | Used for LeetCode GraphQL calls |
| Authentication | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` | JWT auth and password hashing |
| Backend middleware/utilities | `cors`, `dotenv`, `uuid` | CORS, env loading, short group IDs |
| Database | Amazon DynamoDB | Single-table model |
| DynamoDB client layer | AWS SDK v3: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` | Uses `DynamoDBDocumentClient` helpers |
| Object storage | Amazon S3, AWS SDK v3 `@aws-sdk/client-s3` | Stores JSON backups |
| Compute | AWS Lambda | One API Lambda and one backup Lambda |
| Scheduling | Amazon EventBridge | Triggers scheduled backups |
| API ingress | Amazon API Gateway | Frontend points to the `/api` base URL |
| Hosting | Vercel, AWS | Vercel for client, AWS for backend services |
| External integration | LeetCode GraphQL | Import/sync and metadata fallback |
| Local dataset | [`server/data/problems.json`](server/data/problems.json) | Bundled dataset with 3,865 problems |
| Packaging/deployment tooling | `zip`, Bash, AWS CLI, Vercel rewrites | `server/package.json`, [`deploy.sh`](deploy.sh), [`client/vercel.json`](client/vercel.json) |

## What Is Not In This Repo

- No TypeScript
- No Next.js
- No Docker setup
- No Prisma or other ORM
- No relational database
- No server-rendered frontend

## Repository Structure

```text
leettracker/
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vercel.json
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       ├── api/
│       │   └── index.js
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── components/
│       │   ├── Heatmap.jsx
│       │   ├── LeetCodeImport.jsx
│       │   ├── Navbar.jsx
│       │   ├── ProtectedRoute.jsx
│       │   └── groups/
│       │       ├── AddFromProblemsetModal.jsx
│       │       └── ProblemRow.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── GroupDetail.jsx
│       │   ├── Groups.jsx
│       │   ├── Login.jsx
│       │   ├── Problems.jsx
│       │   ├── Profile.jsx
│       │   └── Register.jsx
│       └── utils/
│           └── problemFilters.js
├── server/
│   ├── index.js
│   ├── lambda.js
│   ├── lambda-backup.js
│   ├── backup.js
│   ├── package.json
│   ├── middleware/
│   │   └── auth.js
│   ├── db/
│   │   ├── dynamodb.js
│   │   ├── seed-dynamodb.js
│   │   └── wipe-dynamodb.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── groups.js
│   │   ├── leetcode.js
│   │   ├── patterns.js
│   │   └── problems.js
│   ├── utils/
│   │   └── problemsDataset.js
│   └── data/
│       └── problems.json
├── deploy.sh
├── package.json
└── README.md
```

## Environment Variables

### Server

Create `server/.env`:

```env
JWT_SECRET=your-jwt-secret-here
AWS_REGION=ap-south-1
DYNAMODB_TABLE=LeetTrackerTable
S3_BACKUP_BUCKET=leettracker-backups

# Optional when not using an IAM role or configured AWS profile
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
```

Notes:

- `PORT` is optional for local Express usage and defaults to `5000`
- In AWS Lambda, the API uses the deployed environment instead of a local port

### Client

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Example production value:

```env
VITE_API_URL=https://your-api-gateway-id.execute-api.ap-south-1.amazonaws.com/api
```

## Local Development

### 1. Clone and install

```bash
git clone <your-repo-url>
cd leettracker
npm run install-all
```

### 2. Seed default patterns

```bash
npm run seed
```

This runs the DynamoDB seed script from the server package.

### 3. Start the backend

```bash
npm start --prefix server
```

The local API will run at `http://localhost:5000/api`.

### 4. Start the frontend

```bash
npm run dev --prefix client
```

### 5. Optional root command

On Unix-like shells you can also run:

```bash
npm start
```

That starts the server and client together using the root script.

## Available Scripts

### Root

```bash
npm run install-all
npm run seed
npm start
```

### Client

```bash
npm run dev --prefix client
npm run build --prefix client
npm run preview --prefix client
npm run lint --prefix client
```

### Server

```bash
npm start --prefix server
npm run seed --prefix server
npm run package --prefix server
```

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/me/leetcode-username`

### Patterns

- `GET /api/patterns`
- `POST /api/patterns`

### Problems

- `GET /api/problems`
- `GET /api/problems/search`
- `GET /api/problems/lookup/:number`
- `POST /api/problems`
- `POST /api/problems/:id/status`
- `POST /api/problems/:id/toggle` (legacy route still present)
- `DELETE /api/problems/:id`

### Groups

- `GET /api/groups`
- `POST /api/groups`
- `GET /api/groups/:id`
- `POST /api/groups/:id/members`
- `POST /api/groups/:id/problems`
- `DELETE /api/groups/:id/leave`

### Dashboard

- `GET /api/dashboard`
- `GET /api/dashboard/heatmap`
- `GET /api/dashboard/pattern-heatmap/:userId`
- `GET /api/dashboard/company-progress/:userId`

### LeetCode Integration

- `POST /api/leetcode/import`
- `POST /api/leetcode/sync`

### Operational Endpoints

- `GET /api/health`
- `GET /api/backup`

## Data Model Notes

The backend uses a single DynamoDB table and stores multiple entity types with partition/sort key prefixes, including:

- `USER#...`
- `USERNAME#...`
- `PROGRESS#...`
- `PROBLEM#...`
- `GROUP#...`
- `USERGROUP#...`
- `PATTERN`

This is why most route code works through helper functions in [`server/db/dynamodb.js`](server/db/dynamodb.js) instead of an ORM.

## Deployment Notes

### Frontend

- Designed for Vercel
- SPA routing is handled by [`client/vercel.json`](client/vercel.json)

### Backend

- Package the Lambda bundle with:

```bash
npm run package --prefix server
```

- This creates `server/lambda-deploy.zip`
- That zip is used for both:
  - the main API Lambda
  - the scheduled backup Lambda

### Scheduled backups

- [`server/lambda-backup.js`](server/lambda-backup.js) is the EventBridge-triggered backup worker
- [`server/backup.js`](server/backup.js) scans DynamoDB and writes JSON snapshots to S3

### `deploy.sh`

[`deploy.sh`](deploy.sh) exists to automate packaging and Lambda uploads, but review it before using it in development. It currently runs a hard reset against `origin/main`, so it will discard uncommitted local changes.

## Current Frontend And Backend Hosting

Based on the current project setup:

- Frontend is intended to be hosted on Vercel
- Backend is intended to run on AWS Lambda behind API Gateway
- Backups are intended to go to S3 on a schedule via EventBridge

## License

This project is private and not licensed for public use.
