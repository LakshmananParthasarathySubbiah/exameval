# ExamEval — Setup Guide
## AI-Powered University Exam Evaluation System

---

## Prerequisites

Fresh Ubuntu 22.04 / WSL2 machine. Run all commands from your terminal.

---

## 1. Install System Dependencies

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # should be v20.x
npm --version

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install build tools (needed for some npm packages)
sudo apt install -y build-essential python3
```

---

## 2. Start Services

```bash
# Start PostgreSQL
sudo service postgresql start

# Start Redis
sudo service redis-server start

# Verify Redis
redis-cli ping  # should print PONG
```

---

## 3. Create PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside psql:
CREATE USER postgres WITH PASSWORD 'postgres';
CREATE DATABASE exameval OWNER postgres;
GRANT ALL PRIVILEGES ON DATABASE exameval TO postgres;
\q
```

---

## 4. Clone / Extract Project

```bash
# If copying from this output, place files in:
mkdir -p ~/exameval
cd ~/exameval
# (copy backend/ and frontend/ folders here)
```

---

## 5. Backend Setup

```bash
cd ~/exameval/backend

# Install dependencies
npm install

# Copy and configure environment
cp .env .env.local
# Edit .env — set your GROQ_API_KEY:
nano .env

# Required changes in .env:
# GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx   ← get from console.groq.com
# JWT_ACCESS_SECRET=<generate: openssl rand -hex 32>
# JWT_REFRESH_SECRET=<generate: openssl rand -hex 32>

# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate
# When prompted for migration name, type: init

# Seed database with demo data
npm run db:seed
```

Expected seed output:
```
Seed complete!
Admin: admin@exameval.com / Admin@123
Staff: staff@exameval.com / Staff@123
Created 3 students for exam: DBMS Mid-Term Examination
```

---

## 6. Frontend Setup

```bash
cd ~/exameval/frontend

# Install dependencies
npm install

# Environment is pre-configured for localhost
# Edit if your backend runs on a different port:
cat .env  # VITE_API_URL=http://localhost:5000/api
```

---

## 7. Run the Application

### Terminal 1 — Backend
```bash
cd ~/exameval/backend
npm run dev
```

### Terminal 2 — Frontend
```bash
cd ~/exameval/frontend
npm run dev
```

### Access
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000/api
- **Health check:** http://localhost:5000/api/health

---

## 8. First Login

1. Open http://localhost:5173
2. Login with `admin@exameval.com` / `Admin@123`
3. The sidebar shows: Courses → Exams → Students → Scripts → Evaluations

---

## 9. Full Workflow (End-to-End Test)

### Step 1: Create a Course
- Navigate to **Courses** → Add Course
- Name: `Computer Networks`, Code: `BCSE308L`

### Step 2: Create an Exam
- Navigate to **Exams** → New Exam
- Select your course, set a date
- Upload a rubric PDF (or skip — a text rubric from seed is available)

### Step 3: Add Students
- Navigate to **Students** → Add Student
- Or use **Import CSV** with format:
  ```
  name,rollnumber,email
  Arjun Kumar,21BCE0001,arjun@vit.ac.in
  Priya Sharma,21BCE0002,priya@vit.ac.in
  ```

### Step 4: Upload Scripts
- Navigate to **Scripts** → Upload Scripts
- Select exam + student, upload a PDF answer sheet
- The system extracts text (pdf-parse) or uses OCR (tesseract) as fallback

### Step 5: Run Evaluation
- Click the ▶ (Play) button on any script row
- Or go to **Evaluations** page — click the script → View Detail
- Watch the **live SSE progress bar** as the AI evaluates question by question

### Step 6: Review Results
- Open any completed evaluation
- See per-question scores, feedback, strengths, mistakes, confidence bars
- Staff can override scores and add notes in the **Staff Review** panel
- All overrides are logged in the **Audit Trail**

---

## 10. Get a Groq API Key

1. Visit https://console.groq.com
2. Sign up / Log in
3. Go to **API Keys** → Create Key
4. Copy the key (starts with `gsk_`)
5. Paste into `backend/.env` as `GROQ_API_KEY=gsk_...`

---

## 11. Prisma Studio (Database GUI)

```bash
cd ~/exameval/backend
npm run db:studio
# Opens at http://localhost:5555
```

---

## 12. Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED` on Redis | `sudo service redis-server start` |
| `ECONNREFUSED` on PostgreSQL | `sudo service postgresql start` |
| Groq API errors | Check `GROQ_API_KEY` in `.env`, verify key at console.groq.com |
| PDF text extraction fails | tesseract.js kicks in automatically; ensure the PDF is readable |
| JWT errors | Regenerate secrets: `openssl rand -hex 32` |
| Prisma migration error | `npm run db:reset` (WARNING: drops all data) |
| Port 5000 in use | Change `PORT=5001` in `.env` and `VITE_API_URL` in frontend `.env` |

---

## 13. Production Deployment Notes

```bash
# Backend
NODE_ENV=production
npm run db:migrate:prod   # safe migration (no reset)
npm start

# Frontend
npm run build             # outputs to dist/
# Serve dist/ with nginx or Vercel
```

For production, also:
- Use `HTTPS` and set cookie `secure: true`
- Use a managed Redis (Upstash) and PostgreSQL (Supabase / Neon)
- Set strong random values for JWT secrets
- Add rate limiting (express-rate-limit)
- Configure CORS to your actual frontend domain

---

## Architecture Summary

```
Browser (React + Zustand + React Query)
    │
    │  HTTP/REST + SSE
    ▼
Express API (Node.js)
    │           │
    │           └── BullMQ Queue → Redis
    │                    │
    │                    └── Worker (AI Engine)
    │                            │
    │                            ├── 1. pdf-parse / tesseract OCR
    │                            ├── 2. Groq: parseRubric
    │                            ├── 3. Groq: mapAnswers
    │                            ├── 4. Groq: evaluateQuestion (parallel, ≤5)
    │                            └── 5. aggregateResults → DB
    │
    └── PostgreSQL (via Prisma ORM)
```

**SSE flow:** Worker emits events → `sseManager.sseEmit()` → Express SSE route → `EventSource` in browser → Zustand store → live UI update.
