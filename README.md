# College Course Registration System (Team-7)

A full-stack **College Course Registration System** built with **React (Vite) + Tailwind CSS** and **Node.js + Express + SQLite (`better-sqlite3`)**, featuring JWT authentication, bcrypt password hashing, Zod input validation, real-time prerequisite verification, 24-credit cap enforcement, seat management, and automated waiting list promotion.

---

## 1. Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, React Router, Lucide Icons, Axios
- **Backend**: Node.js, Express, TypeScript (`tsx`)
- **Database**: SQLite via `better-sqlite3` (`server/schema.sql`, `server/db.ts`, `server/seed.ts`)
- **Authentication**: JWT (`jsonwebtoken`) + `bcryptjs` password hashing
- **Validation & Security**: `zod`, `helmet`, `cors`, `express-rate-limit`
- **Testing**: `vitest` + `supertest` (`server/api.test.ts`)

---

## 2. Quick Start & Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Seed or reset the SQLite database with initial demo data
npm run seed
# Or reset at any time:
npm run reset-db

# 4. Run backend tests (Vitest + Supertest)
npm test

# 5. Start full-stack dev server (Express API + Vite frontend on http://localhost:3000)
npm run dev
```

### Production Build & Start
```bash
npm run build
npm start
```

---

## 3. Demo Student Credentials

All demo students belong to **CSE, Semester 5** (`credit_limit = 24`) and share the password **`student123`**:

| Student ID | Name | Completed Courses (Sem 1–4) | Demo Role |
| :--- | :--- | :--- | :--- |
| **`20241CSE0837`** | **Shalini K** | `CS101`, `CS102`, `MA101`, `CS201`, `CS203` | Standard student (`CS401` blocked by missing `MA201`) |
| **`20241CSE0838`** | **Sahana H C** | `CS101`, `CS102`, `MA101`, `CS201`, `CS203` | Pre-seeded at Position `#1` on `CS305` waitlist |
| **`20241CSE0839`** | **Ranjan Gowda N** | `CS101`, `CS102`, `MA101`, `CS201`, `CS203` | Standard student |
| **`20241CSE0840`** | **Ayaj Rajak Valasang** | `CS101`, `CS102`, `MA101`, `CS201` | Missing `CS203` Operating Systems (`CS301`, `CS304`, `CS308` blocked) |
| **`20241CSE0841`** | **Chinmay J C** | `CS101`, `CS102`, `MA101`, `CS201`, `CS203`, `MA201` | Completed `MA201` (`CS401 Machine Learning` is unlocked!) |

---

## 4. REST API Endpoints

All endpoints except `POST /api/auth/login` require an `Authorization: Bearer <token>` header. Errors follow `{ "error": { "code": "...", "message": "..." } }`.

- `POST /api/auth/login` — Authenticate with `{ studentCode, password }` -> `{ token, student }`
- `GET /api/auth/me` — Get current student profile and registered credit load
- `GET /api/courses?search=&department=&credits=&availability=&sort=` — List Semester 5 courses with per-student prerequisite status and live seat counts
- `GET /api/courses/:id` — Single course details
- `POST /api/registration/validate` — Validate `{ courseIds: [] }` against prerequisites, seats, and 24-credit limit
- `POST /api/registration/confirm` — Transactional confirmation `{ courseIds: [], waitlistCourseIds: [] }` (decrements seats, updates academic record, generates `REG-YYYY-<studentCode>-<random4>`)
- `GET /api/registration/my` — List current registered courses and confirmation codes
- `DELETE /api/registration/course/:courseId` — Drop a registered course (increments seat and auto-promotes the first eligible waitlisted student)
- `GET /api/waitlist/my` — List student's active/promoted waitlist entries
- `POST /api/waitlist/join` — Join waiting list for a full course `{ courseId }`
- `DELETE /api/waitlist/:id` — Leave waiting list and re-index queue positions
- `GET /api/academic-record` — View completed (`COMPLETED`) and active (`REGISTERED`) courses + CGPA
- `POST /api/demo/reset` — Reset database back to initial seed state

---

## 5. Step-by-Step Demo Script

1. **Invalid Password Check**: On `/login`, enter `20241CSE0837` and a wrong password (`wrong123`). Observe the inline 401 error banner.
2. **Valid Login**: Click **Shalini K (`20241CSE0837`)** in the Demo Student selector (or enter `student123`) and click **Sign In**.
3. **Blocked Prerequisite (`CS401`)**: In the Course Catalog, locate **`CS401 Machine Learning`**. Observe the red **`✕ MA201 Probability & Linear Algebra`** prerequisite chip and the disabled **`Blocked: Complete MA201 First`** button. (If you sign in as **`20241CSE0841` Chinmay**, `CS401` is unlocked!).
4. **Full Course -> Waiting List (`CS305`)**: Locate **`CS305 Artificial Intelligence`** (`0 / 40` seats). Click **`Join Waiting List (#2)`**. You are added at queue position `#2`.
5. **Credit Limit Exceeded (>24 Credits)**: Click the **`Demo: Select >24 Credits`** button in the catalog header (or manually select 7 four-credit courses = 28 credits). Observe the sticky credit meter turn red (`28 / 24 Credits`).
6. **Review & Remove Course**: Click **`Review & Validate`**. Observe the red **Credit Limit Exceeded** banner and disabled **Proceed to Confirm** button. Click **Remove** on two courses so total credits drop to `<= 24` (e.g., 20 credits). Notice **Proceed to Confirm** becomes enabled.
7. **Confirm Registration**: Click **Proceed to Confirm**, check the verification box, click **Confirm Registration**, and confirm in the **"Are you sure?"** modal.
8. **Confirmation Receipt & Updated Seats**: View the generated Registration ID (`REG-2026-20241CSE0837-XXXX`), print/download the receipt, and click **Back to Course Catalog** to verify that `CS306 Compiler Design` (`1 / 40` -> `0 / 40`) and your other registered courses have updated seat counts.

---

## 6. Deployment Guide (Docker / Render / Railway)

- **Render**: Connect this repository to Render. The included `render.yaml` automatically provisions the Node service and mounts a 1 GB persistent disk at `/var/data` for `DB_PATH=/var/data/registration.db`.
- **Docker**:
  ```bash
  docker build -t course-registration-system .
  docker run -p 3000:3000 -v $(pwd)/sqlite-data:/app/data -e JWT_SECRET="super-secret" course-registration-system
  ```
- **SQLite Persistence Note**: Because SQLite stores data in a local file (`DB_PATH`), cloud deployments on Render, Railway, or Fly.io **must** attach a persistent volume/disk to the directory containing `DB_PATH`, or swap the data access layer in `server/db.ts` to a managed PostgreSQL database.
