# SkillSwap 🌱

A full-stack skill exchange & paid-learning platform built with **React (Vite)**, **Node.js/Express**, **MongoDB**, **Socket.io**, and **Razorpay**. UI theme: pista green.

Implements all 45 user stories: registration/login, profiles, offered/wanted skills, matching, skill exchanges (send/accept/reject/complete/cancel), paid learning listings & bookings, Razorpay payments, real-time chat, ratings & reviews, live notifications, a unified dashboard, and an admin panel (users, categories, reports, transactions).

## Project structure

```
skillswap/
├── server/     Node.js + Express + MongoDB + Socket.io + Razorpay API
│   ├── config/db.js
│   ├── models/          (User, Category, Exchange, PaidListing, Booking, Message, Review, Notification, Report)
│   ├── middleware/auth.js
│   ├── routes/           (one file per feature area, see below)
│   ├── sockets/index.js  (real-time chat + live notifications)
│   ├── utils/
│   └── server.js
└── client/     React (Vite) frontend
    └── src/
        ├── context/  (AuthContext, SocketContext)
        ├── components/
        ├── pages/
        └── styles.css  (pista green theme)
```

## User story → route map (backend)

| Routes file | User Stories |
|---|---|
| `routes/auth.js` | US-01 Register, US-02 Login, US-40 Admin login |
| `routes/users.js` | US-03 Profile, US-04 Offered skill, US-05 Wanted skill, US-06 Skill level, US-07 Search, US-08 View provider |
| `routes/matches.js` | US-09 Get matches |
| `routes/exchanges.js` | US-10–US-15 Send/Accept/Reject/Manage/Complete/Cancel exchange |
| `routes/paidListings.js` | US-16–US-24 Paid listing browse/create/availability/price |
| `routes/bookings.js` | US-18–US-21, US-25, US-26 Select provider/request/manage/accept/slots/book |
| `routes/payments.js` | US-27 Make payment (Razorpay), US-28 Payment confirmation |
| `routes/messages.js` + `sockets/index.js` | US-29 Send message, US-30 Receive message |
| `routes/reviews.js` | US-31–US-34 Rate/review provider, rate exchange, view reviews |
| `routes/notifications.js` | US-35–US-37 Match/request/booking notifications |
| `routes/dashboard.js` | US-38, US-39 Dashboard, my exchanges/learning |
| `routes/admin.js` + `routes/reports.js` | US-41–US-45 Manage users/categories/reports/bookings, plus expert verification queue |
| `routes/auth.js` (`/register-expert`) | Separate expert/teacher sign-up with qualification, experience, optional certificate |

## Prerequisites
- Node.js 18+
- A MongoDB database (local `mongod` or a free MongoDB Atlas cluster)
- A Razorpay account (test mode is fine) — get your Key ID & Key Secret from the Razorpay dashboard

## 1. Backend setup

```bash
cd server
cp .env.example .env
# edit .env: set MONGO_URI, JWT_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
npm install
npm run dev        # starts on http://localhost:5000 (uses nodemon, included in devDependencies)
# or: npm start
```

## 2. Frontend setup

```bash
cd client
cp .env.example .env
# edit .env: set VITE_RAZORPAY_KEY_ID to the SAME key id as the backend
npm install
npm run dev         # starts on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

## 3. Creating an admin user

There's no public admin sign-up (by design). After registering a normal account, promote it to admin directly in MongoDB:

```js
// in mongosh, connected to your skillswap database
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```

Then log in normally at `/login` — you'll land on `/admin`.

## 4. Razorpay test payments

In test mode, use Razorpay's test card `4111 1111 1111 1111`, any future expiry, any CVV, to complete checkout without real money. The backend verifies every payment's HMAC signature server-side (`routes/payments.js`) before marking a booking as paid — never trust the frontend alone for payment confirmation.

## Expert/Teacher accounts & admin verification

Paid learning providers go through a **separate registration flow** from regular users, and must be approved by an admin before they can publish anything:

1. **Expert sign-up** (`/register-expert`, `POST /api/auth/register-expert`) — collects name/email/password plus **qualification**, **experience**, and an **optional certificate link** (a URL to a certificate, portfolio, or LinkedIn — there's no file-upload storage wired up here; plug in S3/Cloudinary if you want real file uploads). The account is created with `role: "expert"` and `expertProfile.verificationStatus: "pending"`.
2. **Login** is the same `/api/auth/login` endpoint for users, experts and admins — the account's `role` and `expertProfile.verificationStatus` determine what it can do once logged in, rather than a separate login endpoint.
3. **Admin review** — the Admin Panel's **Experts** tab (`GET /api/admin/experts`, `PUT /api/admin/experts/:id/verify`) lists pending applications with their qualification, experience and certificate link, and lets the admin **Verify** or **Reject** (with an optional note shown back to the expert). The expert gets a live notification either way.
4. **Gated actions** — creating a paid listing or adding time slots (`POST /api/paid-listings`, `POST /api/paid-listings/:id/slots`) requires `role === "expert"` **and** `expertProfile.verificationStatus === "verified"` (enforced server-side by the `verifiedExpertOnly` middleware in `middleware/auth.js` — the frontend also disables the create-listing form and shows the pending/rejected/verified status on `/my-paid-listings` and `/profile`, but the real enforcement is on the backend).

A regular user can still register normally and only ever book paid sessions as a learner; only accounts that went through `/register-expert` and were verified can teach them.

## Profile fields & skill taxonomy

- **Edit Profile** now covers: name, age, gender, email (editable, checked for uniqueness), bio, location.
- **Offered/Wanted skills** each capture: skill name, **category**, **sub-category** (cascades from the chosen category), **level** (Beginner/Intermediate/Advanced/Expert), **mode** (Online Voice / Online Video / Offline), and **language** (Hindi / English / Hinglish). Categories & sub-categories are managed by the admin (Admin Panel → Categories) and fetched by the frontend from the public `GET /api/categories` endpoint.
- **Search** (`/search`) lets a learner filter by skill name, category, sub-category, mode and language simultaneously — the backend matches all of these against the *same* skill entry via Mongo's `$elemMatch` (so "Guitar, Offline, Hindi" won't match someone who only offers Guitar online).

## Who can create paid listings

Only **verified Expert accounts** can create paid listings or add time slots — this is enforced in two places:
- **Backend (authoritative):** `verifiedExpertOnly` middleware on `POST /api/paid-listings` and `POST /api/paid-listings/:id/slots` rejects any request where `role !== "expert"` or `expertProfile.verificationStatus !== "verified"`, with a 403.
- **Frontend (UX):** `/my-paid-listings` shows a "become an expert" prompt to regular users and disables the create-listing form until the account is verified.

A regular user account can never publish a paid listing, no matter what the frontend does — the API itself refuses it.

## FAQ: "Why does Search / Matches / Chat show nothing?"

This is expected on a **freshly created, empty MongoDB database** — there's no seed/demo data in it yet, so:
- **Search** returns nothing because no user has added any offered skills.
- **Matches** returns nothing because there are no other users with skills that overlap with yours.
- **Chat/Messages** is empty because no messages have been sent yet.

This is not a bug — it's just an empty database. Three common causes if it stays empty even after you *think* you've added data:

1. **You only registered one account.** Search/Matches need *other* users with skills in the database — register a second account (or use the seed script below) to see results.
2. **Your MongoDB connection resets between runs.** If `MONGO_URI` points at an in-memory or ephemeral database (some free-tier setups, Docker containers without a mounted volume, or a `mongodb-memory-server` used for quick testing), every restart wipes all data. Check `server/.env`'s `MONGO_URI` — for anything you want to persist, point it at a real local `mongod` with a data directory, or a MongoDB Atlas cluster.
3. **Backend and frontend are pointed at different databases**, e.g. the backend was restarted with a different `MONGO_URI` than when you added your data. Double check `server/.env` hasn't changed.

### Quick fix: seed script

Run this once your backend `.env` is configured, to populate default categories, a demo admin, two demo users with complementary skills (so Matches/Search return something immediately), and one pre-verified expert with a bookable paid listing:

```bash
cd server
npm run seed
```

It prints the demo login credentials it creates (e.g. `asha@example.com` / `raj@example.com` — a mutual React ⇄ Guitar match — and `expert@example.com`, a pre-verified expert with a bookable Python session). The script is safe to re-run; it skips anything that already exists rather than duplicating it.

## How a paid session flows end-to-end

1. Provider creates a listing with price + availability (`/my-paid-listings`) — US-22/23/24
2. Learner browses/searches listings and requests a slot (`/paid-providers` → `/paid-listings/:id`) — US-16/17/18/19/25
3. Provider accepts/rejects the request (`/provider/requests`) — US-20/21
4. Once accepted, learner pays via Razorpay (`/booking/:bookingId`) — US-26/27/28
5. Backend verifies the payment signature and marks the booking `confirmed`
6. After the session, provider marks it `completed`, learner rates & reviews — US-31/32

## Notes & simplifications (harden before production)

- **Matching (US-09)** uses a straightforward case-insensitive name match, mutual matches ranked first. A production version would add fuzzy matching, categories, and location weighting.
- **Messaging** persists to MongoDB and delivers live via Socket.io when the recipient is online; offline users only get the in-app Notification record (no email/push).
- **Avatars** are a plain URL string field — wire up S3/Cloudinary for real uploads.
- **Validation** is basic (required fields). Add `zod`/`joi` schema validation for production.
- **Refunds/cancellations** after payment aren't wired to Razorpay's refund API — only booking status is updated.
- Never commit real `.env` files — only `.env.example` files are included here.
