# Loan Management System

Borrower portal plus an operations dashboard for a small lending flow:
**apply → sanction → disburse → collect → auto-close**.

| Layer    | Stack                                                  |
| -------- | ------------------------------------------------------ |
| Frontend | Next.js 16 (App Router) · TypeScript · Tailwind CSS 4  |
| Backend  | Node.js · Express 5 · TypeScript (run with `tsx`)      |
| Database | MongoDB · Mongoose                                     |
| Auth     | JWT (Bearer) · bcrypt (`bcryptjs`)                     |

## Quick start

Prerequisites: Node 20+ and MongoDB on `localhost:27017`. If you don't have MongoDB:
`docker run -d -p 27017:27017 --name lms-mongo mongo:7`

```bash
# API → http://localhost:4000
cd server
cp .env.example .env
npm install
npm run seed        # one account per role (idempotent)
npm run dev

# Web → http://localhost:3000 (second terminal)
cd client
cp .env.example .env.local
npm install
npm run dev
```

## Tests

```bash
cd server
npm test            # unit: BRE rules (age/salary/PAN/employment boundaries) + interest math
npm run test:e2e    # API end-to-end: 70 checks over auth, RBAC (401/403), BRE, uploads,
                    # loan math, every status transition, payments, auto-close, reject path
npm run typecheck
cd ../client && npm run lint && npm run build
```

`test:e2e` needs only MongoDB running. It starts its own API on port 4100 against a throwaway `lms_e2e` database and drops it afterwards, so your dev data is untouched. Override with `E2E_PORT` / `E2E_MONGO_URI` (the database name must contain `e2e`).

## Login credentials

All seeded accounts use the password **`Password@123`**.

| Role         | Email                  | Lands on                  |
| ------------ | ---------------------- | ------------------------- |
| Admin        | `admin@lms.dev`        | all four dashboard modules |
| Sales        | `sales@lms.dev`        | `/dashboard/sales`        |
| Sanction     | `sanction@lms.dev`     | `/dashboard/sanction`     |
| Disbursement | `disbursement@lms.dev` | `/dashboard/disbursement` |
| Collection   | `collection@lms.dev`   | `/dashboard/collection`   |
| Borrower     | `borrower@lms.dev`     | `/apply`                  |

New borrowers can also sign up at `/signup`. Public signup only creates borrowers.

## Loan lifecycle

```
                 sanction                disbursement              collection
  APPLIED ──approve──▶ SANCTIONED ──disburse──▶ DISBURSED ──payments == total──▶ CLOSED (automatic)
     │
     └──reject (reason required)──▶ REJECTED
```

- Every transition is one atomic `findOneAndUpdate({ _id, status: <from> })`. A double click or a race can't skip or repeat a state; the loser gets `409`.
- A borrower can hold one active loan (`APPLIED | SANCTIONED | DISBURSED`). They may apply again after `REJECTED` or `CLOSED`.

## Business rules

**BRE** (`server/src/lib/bre.ts`): the application is rejected, with every failing rule listed, if:

| Rule       | Rejects when                                     |
| ---------- | ------------------------------------------------ |
| Age        | not 23–50 inclusive (exact age from DOB)        |
| Salary     | below ₹25,000 / month                            |
| PAN        | doesn't match `^[A-Z]{5}[0-9]{4}[A-Z]$`        |
| Employment | `unemployed`                                     |

PAN: 5 letters, 4 digits, 1 letter (e.g. `ABCDE1234F`). Input is uppercased before matching.

**Where the BRE runs:** on the server, because a client-side check can be bypassed with one curl. It runs when personal details are saved (`422` with the list of failures, nothing is stored) and again when the loan is created, since age changes over time. The client only uses native `pattern`/`min` attributes for typing feedback and displays the server's errors.

**Interest:** `SI = P × 12 × T / (365 × 100)`, with T in days, and `total = P + SI`, rounded to paise. Amount must be ₹50,000–₹5,00,000 and tenure 30–365 days. The client duplicates the formula for the live slider panel. The server recomputes it and ignores any totals the client sends.

**Payments:** each needs a UTR (6–30 alphanumerics, **unique index**, so a duplicate returns `409`), an amount (> 0 and ≤ outstanding), and a date (not in the future). Outstanding is `totalRepayment − amountPaid`. The loan's `amountPaid` increments in one atomic pipeline update, guarded by `amountPaid + amount ≤ totalRepayment`, which also sets `CLOSED` when the loan is fully paid.

## RBAC

- `role` is a string enum on `User` and is included in the JWT (`{ sub, role }`, 1-day expiry).
- `authenticate` returns **401** for a missing or invalid token. `requireRole(...roles)` returns **403** for a valid token with the wrong role. Admin is listed explicitly on every ops route instead of being a hidden bypass, and is **not** allowed into the borrower portal.
- Frontend: `useRequireRole()` redirects signed-out users to `/login` and wrong roles to their own home. The dashboard shows only the tabs for the user's role and renders a 403 for any other module URL. This is a convenience only: the API enforces the same rules independently.

## API

All routes are under `/api`. Errors look like `{ error: string, errors?: string[] }`.

| Method | Route                              | Roles               | Notes |
| ------ | ---------------------------------- | ------------------- | ----- |
| POST   | `/auth/signup`                     | public              | `{name,email,password}` → `201 {token,user}`; `409` if the email exists |
| POST   | `/auth/login`                      | public              | `{email,password}` → `{token,user}`; `401` on bad credentials |
| GET    | `/auth/me`                         | any                 | user plus borrower profile / slip name |
| PUT    | `/borrower/profile`                | borrower            | runs BRE → `200` or `422 {errors}` |
| POST   | `/borrower/salary-slip`            | borrower            | multipart `file`: PDF/JPG/PNG, ≤ 5 MB (`400` / `413`) |
| POST   | `/borrower/loans`                  | borrower            | `{amount,tenureDays}` → `201`; `422` if BRE fails or the slip is missing, `409` if a loan is active |
| GET    | `/borrower/loans`                  | borrower            | own loans, newest first |
| GET    | `/ops/sales`                       | sales, admin        | borrowers with no loan, with progress flags |
| GET    | `/ops/sanction`                    | sanction, admin     | `APPLIED` loans |
| POST   | `/ops/sanction/:id`                | sanction, admin     | `{decision:'approve'}` or `{decision:'reject', reason}` |
| GET    | `/ops/disbursement`                | disbursement, admin | `SANCTIONED` loans |
| POST   | `/ops/disbursement/:id`            | disbursement, admin | → `DISBURSED` |
| GET    | `/ops/collection`                  | collection, admin   | `DISBURSED` loans |
| POST   | `/ops/collection/:id/payments`     | collection, admin   | `{utr,amount,paidOn}` → `201 {payment,loan}` |

## Data model

- **User**: `name, email (unique), passwordHash, role, profile?, salarySlip?`. The borrower's profile and slip are embedded because each user has exactly one.
- **Loan**: `borrower → User, amount, tenureDays, interestRate, simpleInterest, totalRepayment, amountPaid, status, profile (snapshot), salarySlip, rejectionReason, reviewedBy/At, disbursedBy/At, closedAt`. The profile and slip are copied at apply time, so later edits don't change what was underwritten.
- **Payment**: `loan → Loan, utr (unique), amount, paidOn, recordedBy → User`.

Salary slip bytes are stored in an `uploads` collection; the user and loan keep a reference plus the original filename, type and size. Keeping files in MongoDB means the API needs no disk, so it runs on serverless hosts.

## Project layout

```
server/src
  index.ts              app, routes, error handler
  models.ts             User, Loan, Payment
  middleware/auth.ts    authenticate, requireRole
  lib/bre.ts, loan.ts   business rules + interest (pure, unit-tested)
  routes/               auth, borrower, ops
  seed.ts
client/
  app/                  login, signup, apply, dashboard/{sales,sanction,disbursement,collection}
  components/           ui primitives, apply steps, dashboard cards
  lib/                  api client, session/RBAC hook, loan math
```

## Deploy (free, always on)

MongoDB Atlas free cluster for the database, and two Vercel Hobby projects (API + web) from this repo.

1. **Atlas**: create a free cluster, a database user, and allow network access from `0.0.0.0/0` (Vercel has no fixed IPs). Copy the connection string and add the database name: `mongodb+srv://USER:PASS@HOST/lms`.
2. **Seed it** from your machine: `cd server`, then `MONGO_URI="<atlas uri>" npm run seed` (PowerShell: `$env:MONGO_URI="<atlas uri>"; npm run seed`).
3. **API on Vercel**: new project from this repo, root directory `server`. Env vars: `MONGO_URI`, `JWT_SECRET` (a long random string), `CLIENT_ORIGIN` (the web URL from step 4; update it after step 4 and redeploy). Check `https://<api>.vercel.app/api/health`.
4. **Web on Vercel**: new project from this repo, root directory `client`. Env var: `NEXT_PUBLIC_API_URL=https://<api>.vercel.app/api`.

Vercel caps request bodies at 4.5 MB, so on the hosted version slips between 4.5 and 5 MB are rejected by the platform before reaching the API.

## Known limits

- Payment recording has no Mongo transaction: the payment is inserted first and deleted if the guarded loan update misses, because standalone `mongod` has no transactions. On a replica set or Atlas, use a session.
- Two simultaneous "Apply" requests from the same borrower could both pass the one-active-loan check. A partial unique index would close that gap.
- The sanction view shows the salary slip's filename, but there is no authenticated download link for the file.
