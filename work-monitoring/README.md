# Work From Home Employee Monitoring & Real-Time Status System

A consent-based presence dashboard. Employees log in, see their own dashboard, and (optionally) share their location.
The browser detects only **active / inactive** (no mouse/keyboard content is recorded). Admins see every employee's
**Online / Inactive / Offline** status update live through Socket.IO.

**Stack:** HTML + CSS + JavaScript (ES modules) · Node.js 20+ · Express · MongoDB + Mongoose · JWT + bcryptjs · Socket.IO · Zod · Helmet

---

## 1. Quick start (5 steps)

**Step 1: Install**
- Node.js LTS (v20 or v22): https://nodejs.org
- MongoDB: pick ONE
  - **Atlas (cloud, easiest):** create a free cluster at https://www.mongodb.com/atlas, make a database user, allow your IP
    (Network Access), click *Connect > Drivers* and copy the connection string.
  - **Local:** install *MongoDB Community Server* + (optional) *MongoDB Compass*, then make sure the service is running.

**Step 2: Install packages**
```bash
cd backend
npm install
```

**Step 3: Configure `backend/.env`**
- Local MongoDB: nothing to change (`MONGO_URI=mongodb://127.0.0.1:27017`).
- Atlas: replace `MONGO_URI` with your string, e.g.
  `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
  (if the password has special characters like `@`, URL-encode them).
- The database `work_monitoring` and the `users` collection are created automatically on first use (`DB_NAME` in `.env`).

**Step 4: Create the first admin**
```bash
npm run create-admin
```
Default login: `admin@example.com` / `Admin@12345` (change in `.env` first if you like).

**Step 5: Start**
```bash
npm run dev
```
Open **http://localhost:5000/login.html** (the Express server serves the frontend too, so no Live Server is needed).

Expected console output:
```
MongoDB connected: ... / db: work_monitoring
Server running on http://localhost:5000
```

---

## 2. How to test everything

1. Normal window: open `/register.html`, create an employee (with a photo), then log in -> employee dashboard.
2. Incognito window: log in as the admin -> admin dashboard. The employee shows **Online**.
3. For a quick test set `INACTIVITY_TIMEOUT_SECONDS=10` in `.env` and restart. Stop moving the mouse in the employee window:
   after 10 s the admin card changes to **Inactive** without a refresh. Move the mouse -> **Online** again.
4. Close the employee tab -> after ~5 s the admin sees **Offline**. Reopen / log in -> **Online** again.
5. Turn on *Share my location* in the employee dashboard, allow the browser popup -> admin sees coordinates.
   Turn it off -> location is deleted and the admin sees "Not shared".
6. Stop your Wi-Fi for ~30-60 s on the employee side -> server marks **Offline**; reconnect -> **Online**.

---

## 3. Project structure

```
work-monitoring/
├── frontend/
│   ├── index.html  login.html  register.html  dashboard.html  admin.html
│   ├── css/style.css
│   └── js/ api.js  login.js  register.js  dashboard.js  admin.js
└── backend/
    ├── server.js              start: DB + HTTP + Socket.IO
    ├── app.js                 Express app: security, routes, static files
    ├── .env  .env.example  package.json
    ├── config/db.js           MongoDB connection
    ├── models/User.js         Mongoose schema (+ password hashing)
    ├── routes/                authRoutes.js  userRoutes.js
    ├── controllers/           authController.js  userController.js
    ├── middleware/            authMiddleware.js (JWT)  adminMiddleware.js (role)
    │                          uploadMiddleware.js (photo)  errorMiddleware.js
    ├── validators/            authValidator.js  userValidator.js (Zod)
    ├── sockets/index.js       Socket.IO auth, rooms, status logic
    ├── utils/                 generateToken.js asyncHandler.js AppError.js userSerializer.js
    ├── scripts/createAdmin.js
    └── uploads/               profile photos
```

---

## 4. API

| Method | Endpoint | Who | What |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create employee (multipart: name, email, password, confirmPassword, profilePhoto) |
| POST | `/api/auth/login` | public | Returns `{ token, user, settings }` |
| GET | `/api/auth/me` | logged in | Own profile + settings (inactivity timeout) |
| POST | `/api/auth/logout` | logged in | Marks employee offline, closes their sockets |
| GET | `/api/users` | **admin only** | All employees (location only if consented) |
| PATCH | `/api/users/status` | employee | `{ "status": "online" \| "inactive" }` (fallback; sockets are the main path) |
| PATCH | `/api/users/location` | employee | `{ consent:true, latitude, longitude }` or `{ consent:false }` (deletes location) |
| GET | `/api/health` | public | Server check |

Send the token as header: `Authorization: Bearer <token>`.

### Socket.IO events
| Event | Direction | Meaning |
|---|---|---|
| (handshake `auth.token`) | browser -> server | JWT is verified before connecting |
| `activity:active` | employee -> server | became active again / "still active" ping (max every 30 s) |
| `activity:inactive` | employee -> server | no activity for the timeout |
| `status:changed` | server -> room `admins` | full public employee object, admin UI updates live |
| `user:created` | server -> room `admins` | a new employee registered |

Rooms: `admins` (all admin sockets) and `user:<id>` (all tabs of one user, used to force-close sockets on logout).

---

## 5. How it works (Hinglish)

**Login flow:** Browser form -> `POST /api/auth/login` -> Express validates input (Zod) -> Mongoose finds the user by email
in MongoDB -> `bcrypt.compare` checks the password against the stored hash -> server creates a **JWT** -> browser saves it
(localStorage) -> sends it with every request as `Authorization: Bearer ...`.

**Password hashing:** `"mypass123"` -> bcrypt adds a random *salt* and hashes -> `"$2a$10$N9qo8uLOickgx2ZMRZoMye..."`.
Same password hashed twice gives different results (because of salt). Hash ko wapas password mein badla nahi ja sakta,
isliye login par hum *compare* karte hain.

**Online vs Inactive vs Offline**
- **Online**: socket connected + recent mouse/keyboard activity.
- **Inactive**: socket connected, but no activity for the timeout (mouse rukne se *Offline nahi* hota).
- **Offline**: socket disconnected (logout, tab/browser closed, internet gaya). Server waits 5 s before marking offline so a quick
  refresh or reconnect does not flicker.

**Activity detection:** The browser listens to `mousemove, mousedown, keydown, scroll, touchstart, click` only to restart a
timer. Nothing is recorded. The server hears only on *change* (plus a 30 s "still active" ping), not on every mouse move.
Better for privacy (no content) and performance (very few messages).

**MongoDB indexes:** `email` (unique: fast login + no duplicates), `status` (fast admin filter), `role` (list employees).

Example document:
```json
{
  "_id": "665f1c2e9a1b2c3d4e5f6a7b",
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "password": "$2a$10$N9qo8uLOickgx2ZMRZoMye...",
  "profilePhoto": "/uploads/1760000000000-ab12cd34ef56.jpg",
  "role": "employee",
  "locationConsent": true,
  "location": { "latitude": 26.85, "longitude": 80.91, "updatedAt": "2026-10-10T09:30:00Z" },
  "status": "inactive",
  "lastActivity": "2026-10-10T09:28:00Z",
  "statusUpdatedAt": "2026-10-10T09:30:00Z",
  "createdAt": "2026-10-01T08:00:00Z",
  "updatedAt": "2026-10-10T09:30:00Z"
}
```

---

## 6. Security measures included

| Measure | Where |
|---|---|
| Passwords hashed with bcryptjs (never plain text, never returned by queries) | `models/User.js` (`select:false`) |
| JWT authentication + expiry | `generateToken.js`, `authMiddleware.js` |
| Protected routes + role-based authorization (admin only list) | `authMiddleware.js`, `adminMiddleware.js` |
| Role cannot be chosen at registration (always `employee`); admins via script | `authController.js`, `createAdmin.js` |
| Input validation (server + browser) | Zod validators, form JS |
| Secrets in `.env`, `.env` ignored by Git | `.env`, `.gitignore` |
| CORS allow-list, Helmet headers + CSP | `app.js` |
| Rate limiting on login/register | `authRoutes.js` |
| Photo upload: type + size limit, server-generated file name | `uploadMiddleware.js` |
| Same error for wrong email/password; internal errors never leaked | `authController.js`, `errorMiddleware.js` |
| Socket connections need a valid JWT; only admins join `admins` room | `sockets/index.js` |
| HTML escaping on the frontend (prevents XSS) | `api.js` `escapeHtml` |

---

## 7. Privacy, consent and limitations (please read and mention in your viva/report)

- Works **only while the app tab is open**. There is no hidden or background tracking, no screenshots, no keylogging.
- Only active/inactive and timestamps are stored. Key presses and mouse paths are never read or saved.
- Location is **opt-in**: our confirm dialog first, then the browser's own permission popup. Turning it off deletes the stored location.
  The admin never sees a location without consent.
- The dashboard shows a visible privacy notice so employees know what is shared.
- Limitations: a browser cannot know if someone is really *working*, only that they interacted with this page. Activity is reported by
  the browser, so a technical user could fake it; treat this as a *presence indicator*, not proof of productivity. With several tabs open
  the most recent report wins. Use it only with clear employee knowledge and agreement, and follow your organisation's and local laws.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `MongoDB connection failed: connect ECONNREFUSED 127.0.0.1:27017` | Local MongoDB is not running: start the MongoDB service, or switch to Atlas |
| Atlas: `bad auth` / `ENOTFOUND` / timeout | Wrong user/password (URL-encode special characters), or your IP is not in *Network Access* |
| `Missing JWT_SECRET in backend/.env` | `.env` must be inside `backend/`; run commands from `backend/` |
| `Cannot use import statement outside a module` | `"type": "module"` must be in `backend/package.json` |
| `EADDRINUSE: port 5000` | Something else uses 5000: change `PORT` in `.env` (and `CLIENT_URL`) |
| `Invalid email or password` for admin | Run `npm run create-admin` first |
| `403 Access denied: admin only` | You are logged in as an employee; use the admin account |
| Location does nothing | Needs `localhost` or **HTTPS**; check browser site permission for location |
| Status never turns Inactive | Timeout is `INACTIVITY_TIMEOUT_SECONDS` (default 120). Lower it to test; move no mouse |
| Page shows old JS | Hard refresh (Ctrl+Shift+R) |

---

## 9. Deployment (example: Render + MongoDB Atlas)

1. Push the project to GitHub (`.env` is ignored, so secrets stay safe).
2. Atlas: create a cluster, DB user, and allow access from anywhere (`0.0.0.0/0`) for the first deploy.
3. Render: *New > Web Service*, root directory `backend`, build `npm install`, start `npm start`.
4. Environment variables on Render: `NODE_ENV=production`, `MONGO_URI`, `DB_NAME=work_monitoring`, `JWT_SECRET` (a NEW long random value),
   `JWT_EXPIRES_IN=1d`, `INACTIVITY_TIMEOUT_SECONDS=120`, `CLIENT_URL=https://your-app.onrender.com`.
5. Open a Render shell (or run locally against the Atlas URI) and execute `npm run create-admin`.
6. Always use **HTTPS** in production (needed for geolocation). Uploaded photos on free hosting disappear on redeploy: for a real
   product move them to cloud storage (Cloudinary / S3).

Generate a strong secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 10. Ideas to extend (portfolio upgrades)
React/Vite frontend, httpOnly cookie instead of localStorage for the JWT, daily active-time reports, admin map view (Leaflet),
email verification, automated tests (Jest + Supertest), Docker.
