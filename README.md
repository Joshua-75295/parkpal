# ParkPal

ParkPal is a full-stack parking management and booking platform built for three roles:

- `user`: search, save, book, cancel, and rebook parking slots
- `admin`: manage owned inventory, upload slot images, validate arrivals, and monitor daily operations
- `super_admin`: manage admins, view cross-admin inventory, and monitor analytics across managed slots

The project now goes well beyond a basic CRUD demo. It includes cookie-based auth with refresh tokens, role-aware routing, real-time updates, Google-style traffic-aware routing when configured, booking lifecycle automation, analytics, favorites, quick rebook, responsive search results, and local image upload for parking slots.

## Quick Start

From the project root:

```powershell
npm --prefix client install
npm --prefix server install
npm run seed:demo
npm run dev
```

If you want a populated local database for testing, run `npm run seed:demo` before `npm run dev`.

The server needs a `server/.env` file with at least:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
```

Recommended for real local development:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=fallback_secret_for_legacy_resolution
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
BOOKING_EXPIRY_MINUTES=15
UPLOADS_DIRECTORY=optional_persistent_uploads_root
MONGO_RETRY_DELAY_MS=5000
MONGO_SERVER_SELECTION_TIMEOUT_MS=10000
```

Optional client env:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_SERVER_URL=http://localhost:5000
VITE_ROUTING_API_BASE_URL=https://router.project-osrm.org
VITE_GOOGLE_MAPS_API_KEY=your_browser_restricted_google_maps_key
VITE_GOOGLE_MAPS_MAP_ID=optional_google_map_id
```

Optional server env for Google-style ETA and route alternatives:

```env
GOOGLE_MAPS_API_KEY=your_server_google_maps_key
```

To use the Google-style routing experience, enable billing and turn on:

- Maps JavaScript API
- Routes API

## Deploy for Other Users

GitHub stores your code, but other users need live hosting to actually use the app in a browser. For this project, the cleanest setup is:

- GitHub for source code
- MongoDB Atlas for the database
- Render Web Service for the API
- Render Static Site for the React frontend

This repo now includes:

- [render.yaml](./render.yaml) for Render Blueprint deployment
- [server/.env.example](./server/.env.example) for backend env values
- [client/.env.example](./client/.env.example) for frontend env values

### Recommended Deploy Order

1. Push your latest code to GitHub.
2. Create a MongoDB Atlas cluster and copy its `mongodb+srv://...` connection string.
3. In Atlas, create a database user and make sure your network access settings allow the environments that need to connect.
4. In Render, create a new Blueprint and point it at this repo so Render reads `render.yaml`.
5. Fill the backend `MONGO_URI` value when Render prompts for it.
6. Let Render create both services once so you get the actual public URLs.
7. Set `CLIENT_ORIGIN` on `parkpal-api` to your real frontend URL.
8. Set `VITE_API_BASE_URL` on `parkpal-web` to `https://your-backend-url.onrender.com/api`.
9. Set `VITE_SOCKET_SERVER_URL` on `parkpal-web` to `https://your-backend-url.onrender.com`.
10. Redeploy both services after those URLs are in place.

### Production Env Values

Backend service:

```env
MONGO_URI=your_mongodb_atlas_connection_string
CLIENT_ORIGIN=https://your-frontend-url.onrender.com
JWT_SECRET=generate_a_long_random_secret
JWT_ACCESS_SECRET=generate_a_long_random_access_secret
JWT_REFRESH_SECRET=generate_a_long_random_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BOOKING_EXPIRY_MINUTES=15
UPLOADS_DIRECTORY=/opt/render/project/src/uploads
MONGO_RETRY_DELAY_MS=5000
MONGO_SERVER_SELECTION_TIMEOUT_MS=10000
```

Frontend service:

```env
VITE_API_BASE_URL=https://your-backend-url.onrender.com/api
VITE_SOCKET_SERVER_URL=https://your-backend-url.onrender.com
VITE_ROUTING_API_BASE_URL=https://router.project-osrm.org
```

Optional Google Maps routing:

```env
GOOGLE_MAPS_API_KEY=your_server_google_maps_api_key
VITE_GOOGLE_MAPS_API_KEY=your_browser_restricted_google_maps_api_key
VITE_GOOGLE_MAPS_MAP_ID=your_google_map_id
```

### Important Deployment Notes

- Do not upload `.env` files, MongoDB passwords, or JWT secrets to GitHub.
- `render.yaml` cannot automatically know your final frontend/backend public URLs, so `CLIENT_ORIGIN`, `VITE_API_BASE_URL`, and `VITE_SOCKET_SERVER_URL` must be filled with the real deployed URLs after the first Render provision.
- Uploaded parking images are stored on disk. If you want them to survive redeploys, attach a Render persistent disk and keep its mount path aligned with `UPLOADS_DIRECTORY=/opt/render/project/src/uploads`.
- If you want demo accounts and sample parking slots on the deployed app, point your local `server/.env` at the same Atlas cluster and run `npm run seed:demo` once before sharing the public link.

## Demo Data

Seed a ready-to-test local database with:

```powershell
npm run seed:demo
```

That command creates:

- 1 super admin
- 10 mall admin accounts
- 6 demo user accounts
- 10 parking locations owned by the mall admins
- demo bookings for today and recent days, so bookings, validation, analytics, and favorites are easy to test

If you want to replace previously seeded demo bookings, run:

```powershell
npm run seed:demo:force
```

### Seeded Demo Accounts

These credentials are intentionally for local testing and demo data only. Do not reuse them in a public deployment or in a real production database.

#### Super Admin

| Role | Email | Password |
| --- | --- | --- |
| `super_admin` | `superadmin@parkpal.test` | `SuperAdmin@123` |

#### Mall Admins

| Mall | Email | Password |
| --- | --- | --- |
| Phoenix Mall Guntur | `phnxgntgtroad@gmail.com` | `Mall@123` |
| Naaz Centre Guntur | `naazgntctr@gmail.com` | `Mall@123` |
| PVP Square Vijayawada | `pvpvjamgrd@gmail.com` | `Mall@123` |
| Trendset Mall Benz Circle | `trndstvjabnzc@gmail.com` | `Mall@123` |
| LEPL Centro Vijayawada | `leplvjamgrd@gmail.com` | `Mall@123` |
| CMR Central Vizag | `cmrvizmddlp@gmail.com` | `Mall@123` |
| Dmart Vizag Madhurawada | `dmartvizmadhw@gmail.com` | `Mall@123` |
| Ongole Dmart | `dmartongtrnkrd@gmail.com` | `Mall@123` |
| MGB Felicity Mall Nellore | `mgbnlrctr@gmail.com` | `Mall@123` |
| Garuda Mall Tirupati | `grdtrpaktp@gmail.com` | `Mall@123` |

#### Demo Users

| Name | Email | Password |
| --- | --- | --- |
| Ananya Reddy | `ananya@parkpal.test` | `User@123` |
| Bharat Kumar | `bharat@parkpal.test` | `User@123` |
| Charan Teja | `charan@parkpal.test` | `User@123` |
| Divya Sri | `divya@parkpal.test` | `User@123` |
| Harsha Vardhan | `harsha@parkpal.test` | `User@123` |
| Keerthi Priya | `keerthi@parkpal.test` | `User@123` |

## Current Feature Set

### User Features

- Register and login with secure HTTP-only cookie sessions
- Search parking slots by location, price, and optional live time range
- View parking inventory on OpenStreetMap by default, or Google Maps when configured
- Use browser location to see road distance, estimated drive time, and sort by the best parking route
- Compare alternate route chips with Google-style ETA when Google routing is configured
- Browse results in a compact map-first responsive grid instead of one long mobile-heavy column
- Create bookings with spot preference:
  - `nearest`
  - `standard`
  - `vip`
  - `accessible`
- Save favorite parking slots
- Quick rebook from booking history
- Cancel active bookings
- Track validation, expiry, cancellation reason, and completion state

### Admin Features

- Create, edit, and delete owned parking slots
- Upload real slot images from the admin console
- Optionally use external image URLs
- Auto-fill slot map coordinates from browser or device location settings
- Drop a fallback admin map pin manually when device location is blocked
- Mark slots as `active`, `maintenance`, or `inactive`
- Configure spot mix:
  - accessible spots
  - VIP spots
  - standard spots
- Manage inventory from a more compact responsive card grid with quick map focus, edit, and remove actions
- Monitor bookings for a selected day
- Validate customer arrivals
- View booking analytics:
  - revenue
  - occupancy
  - peak hours
  - cancellations

### Super Admin Features

- Everything admins can do
- Create new admins
- View all admins
- View and manage platform-wide inventory
- Monitor analytics and bookings across managed operators

## Manual Example Accounts

If you use `npm run seed:demo`, use the seeded demo accounts above.

If you prefer to create accounts manually through the UI or Postman, these are good local development examples:

| Role | Email | Password | Setup |
| --- | --- | --- | --- |
| Super Admin | `superadmin@parkpal.com` | `Pass@123` | Register normally, then update the user role in MongoDB to `super_admin` |
| Admin | `admin@parkpal.com` | `Pass@123` | Create from the super admin panel or `POST /api/admin/users/admins` |
| User | `user1@parkpal.com` | `Pass@123` | Register from the app or `POST /api/auth/register` |

Important:

- `super_admin` must still be promoted manually in MongoDB
- if you already created these users with different passwords locally, use your real local values instead

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router, Axios |
| Maps and Routing | Leaflet, React Leaflet, OpenStreetMap, OSRM, Google Maps JavaScript API, Google Routes API |
| Realtime | Socket.IO client and server |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Auth | JWT access and refresh tokens stored in HTTP-only cookies |
| Testing | Node built-in test runner |

## Security and Session Model

ParkPal no longer stores auth tokens in `localStorage`.

Current auth behavior:

- access token is stored in an HTTP-only cookie
- refresh token is stored in an HTTP-only cookie
- the frontend uses `withCredentials: true`
- Axios automatically attempts `/api/auth/refresh` on `401`
- the app restores the current user from `/api/auth/me`
- logout clears cookies and server-side refresh state

This gives you:

- short-lived access tokens
- rotating refresh behavior
- cleaner session recovery on reload/focus
- less XSS exposure than `localStorage` token storage

## Platform Hardening

The backend also includes:

- centralized async and error middleware
- route-level rate limiting for auth, booking mutations, and admin mutations
- MongoDB retry/backoff and database-readiness health reporting
- regression tests for auth, booking conflicts, admin permissions, storage, and readiness behavior

## Product Highlights

### 1. Real-Time Availability

Socket.IO pushes updates when:

- bookings are created
- bookings are cancelled
- bookings are validated
- parking inventory changes
- expired/completed bookings are processed

This keeps search results, booking history, analytics, and the admin console in sync without manual refreshes.

### 2. Booking Lifecycle Automation

Bookings include:

- `status`: `booked`, `cancelled`, `completed`
- `validationStatus`: `pending`, `validated`, `expired`
- `expiresAt`
- `cancelledAt`
- `cancellationReason`

The backend periodically runs booking lifecycle maintenance to:

- assign missing expiry deadlines
- auto-expire unvalidated bookings
- complete finished bookings
- emit realtime availability updates

### 3. Smarter Slot Allocation

Bookings are assigned to physical `ParkingSpot` records instead of a simple counter.

Allocation supports:

- nearest spot
- standard spot
- VIP spot
- accessible spot

Each parking slot expands into physical spot records, so the system can track actual numbered spaces and entrance rank.

### 4. Map Intelligence

The search experience includes:

- map and list synchronization
- current-user location
- nearest parking sorting
- road-distance and drive-time labels
- traffic-aware ETA when Google routing is configured
- alternate route chips like a Google Maps-style comparison bar
- highlighted selected slot
- real road-route preview for the focused slot
- graceful fallback to standard road routing or approximate distance if premium routing is temporarily unavailable

By default the map uses OpenStreetMap tiles and the OSRM routing service. If Google Maps keys are configured, the search page upgrades to a Google-style route view with traffic-aware ETA and alternate routes.

### 5. Favorites and Quick Rebook

Users can:

- save favorite parking slots
- view saved-slot status directly from search cards
- rebook from booking history with prefilled start/end time and spot preference

### 6. Real Slot Images

Admins can now:

- upload a local slot image from the browser
- preview it before saving
- replace it later
- remove it
- optionally use an external image URL instead

Uploaded files are stored under the backend uploads directory and served via `/uploads/...`. By default that is `server/uploads/parking`, and you can move it to a persistent location with `UPLOADS_DIRECTORY`.

## Project Structure

```text
parkpal/
|-- client/
|   |-- public/
|   |-- src/
|   |   |-- components/
|   |   |   |-- AdminRoute.jsx
|   |   |   |-- BookingForm.jsx
|   |   |   |-- Loader.jsx
|   |   |   |-- Navbar.jsx
|   |   |   |-- ParkingMap.jsx
|   |   |   |-- ParkingSlotCard.jsx
|   |   |   |-- ProtectedRoute.jsx
|   |   |   `-- Toast.jsx
|   |   |-- context/
|   |   |   |-- auth-context.js
|   |   |   `-- AuthContext.jsx
|   |   |-- pages/
|   |   |   |-- AdminPage.jsx
|   |   |   |-- DashboardPage.jsx
|   |   |   |-- LoginPage.jsx
|   |   |   |-- MyBookingsPage.jsx
|   |   |   |-- RegisterPage.jsx
|   |   |   `-- SearchPage.jsx
|   |   |-- services/
|   |   |   |-- adminService.js
|   |   |   |-- api.js
|   |   |   |-- authService.js
|   |   |   |-- bookingService.js
|   |   |   |-- parkingService.js
|   |   |   |-- routingService.js
|   |   |   `-- realtimeService.js
|   |   |-- utils/
|   |   |   |-- constants.js
|   |   |   `-- formatDate.js
|   |   |-- App.jsx
|   |   `-- main.jsx
|   `-- package.json
|-- server/
|   |-- config/
|   |   |-- db.js
|   |   `-- storage.js
|   |-- controllers/
|   |   |-- adminController.js
|   |   |-- authController.js
|   |   |-- bookingController.js
|   |   |-- parkingController.js
|   |   `-- routingController.js
|   |-- middleware/
|   |   |-- adminMiddleware.js
|   |   |-- authMiddleware.js
|   |   |-- errorMiddleware.js
|   |   `-- rateLimitMiddleware.js
|   |-- models/
|   |   |-- Booking.js
|   |   |-- ParkingSlot.js
|   |   |-- ParkingSpot.js
|   |   `-- User.js
|   |-- routes/
|   |   |-- adminRoutes.js
|   |   |-- authRoutes.js
|   |   |-- bookingRoutes.js
|   |   |-- parkingRoutes.js
|   |   `-- routingRoutes.js
|   |-- tests/
|   |   |-- helpers/
|   |   `-- platformHardening.test.js
|   |-- utils/
|   |   |-- authSession.js
|   |   |-- bookingLifecycle.js
|   |   |-- googleRoutes.js
|   |   |-- httpError.js
|   |   |-- parkingImageStorage.js
|   |   |-- parkingSpotHelpers.js
|   |   `-- realtime.js
|   |-- app.js
|   |-- server.js
|   `-- package.json
|-- scripts/
|   `-- dev.js
|-- package.json
`-- .gitignore
```

## Frontend Architecture

### Entry and Routing

- `main.jsx` boots the app inside `AuthProvider`
- `App.jsx` lazy-loads route pages and handles route registration
- `ProtectedRoute.jsx` guards authenticated routes
- `AdminRoute.jsx` guards admin-only routes

### State and Session

- `AuthContext.jsx` hydrates the active session from `/api/auth/me`
- `api.js` centralizes Axios and refresh behavior
- `realtimeService.js` manages the shared Socket.IO client

### Main Screens

- `DashboardPage.jsx`: landing page and role-aware entry
- `LoginPage.jsx`: sign in
- `RegisterPage.jsx`: sign up
- `SearchPage.jsx`: filters, booking form, route chips, map, favorites, and location tools
- `MyBookingsPage.jsx`: history, cancellation, saved slots, quick rebook
- `AdminPage.jsx`: inventory, uploads, validation desk, analytics, admin management

## Backend Architecture

### App Bootstrap

- `server.js` loads env vars, starts Express and Socket.IO immediately, retries MongoDB until ready, and runs lifecycle maintenance only when the database is available
- `app.js` builds the Express app, enables CORS, parses JSON, serves uploads, exposes `/api/health`, and blocks API requests with a clear `503` while the database is still warming up

### Middleware

- `authMiddleware.js`: reads cookie-based access tokens and attaches `req.user`
- `adminMiddleware.js`: enforces `admin` and `super_admin` access
- `errorMiddleware.js`: centralized async and error handling
- `rateLimitMiddleware.js`: API, auth, booking mutation, and admin mutation throttling

### Business Logic

- `authController.js`: register, login, logout, refresh, current user
- `bookingController.js`: booking creation, cancellation, and user booking history
- `parkingController.js`: inventory CRUD, favorites, public search, managed slots
- `routingController.js`: traffic-aware route matrix and alternate route options
- `adminController.js`: booking validation, analytics, and admin management

## Database Model Overview

### User

Stores:

- name
- email
- hashed password
- role
- refresh token hash and expiry
- favorite parking slot IDs

### ParkingSlot

Stores:

- title
- image URL
- address and coordinates
- price per hour
- configured slot count
- accessible and VIP allocation config
- status
- owner

### ParkingSpot

Represents a real physical spot generated from a parking slot configuration.

### Booking

Stores:

- user
- parking slot
- assigned parking spot
- start and end time
- spot preference
- total price
- booking status
- validation status
- expiry deadline
- cancellation metadata
- validator metadata

## Data Relationships

- one `User` can own many `ParkingSlot` records
- one `User` can save many favorite parking slots
- one `ParkingSlot` generates many `ParkingSpot` records
- one `Booking` belongs to one `User`
- one `Booking` belongs to one `ParkingSlot`
- one `Booking` can reference one assigned `ParkingSpot`
- one validated `Booking` can reference the admin that validated it through `validatedBy`

## Environment Variables

Create a `.env` in the project root or in `server/`.

Minimum:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_fallback_jwt_secret
```

Recommended:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=fallback_secret_for_legacy_resolution
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
BOOKING_EXPIRY_MINUTES=15
UPLOADS_DIRECTORY=optional_persistent_uploads_root
MONGO_RETRY_DELAY_MS=5000
MONGO_SERVER_SELECTION_TIMEOUT_MS=10000
PORT=5000
NODE_ENV=development
```

Client:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_SERVER_URL=http://localhost:5000
VITE_ROUTING_API_BASE_URL=https://router.project-osrm.org
VITE_GOOGLE_MAPS_API_KEY=your_browser_restricted_google_maps_key
VITE_GOOGLE_MAPS_MAP_ID=optional_google_map_id
```

Optional server routing key:

```env
GOOGLE_MAPS_API_KEY=your_server_google_maps_key
```

Notes:

- `CLIENT_ORIGIN` can be a comma-separated list
- uploads are served from the backend automatically
- set `UPLOADS_DIRECTORY` to a persistent disk path in production if you do not want uploads stored inside the repo directory
- if `VITE_SOCKET_SERVER_URL` is not set, the client derives it from `VITE_API_BASE_URL`
- if `VITE_ROUTING_API_BASE_URL` is not set, the client uses the public OSRM endpoint by default
- if `VITE_GOOGLE_MAPS_API_KEY` is set, the search page renders the routed map on Google Maps instead of Leaflet
- if `GOOGLE_MAPS_API_KEY` is set on the server, `/api/routing/*` returns Google traffic-aware ETA and alternate routes

## Installation

From the project root:

```bash
npm install
npm --prefix client install
npm --prefix server install
```

## Scripts

### Root Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts frontend and backend together |
| `npm run dev:client` | Starts only the Vite client |
| `npm run dev:server` | Starts only the Express server with nodemon |
| `npm run build` | Builds the client for production |
| `npm run lint` | Runs client ESLint |
| `npm run seed:demo` | Seeds demo admins, users, parking slots, favorites, and bookings |
| `npm run seed:demo:force` | Replaces previously seeded demo bookings |
| `npm run start` | Starts the backend in production mode |
| `npm run test:server` | Runs backend tests |

### Client Scripts

| Command | Description |
| --- | --- |
| `npm --prefix client run dev` | Start Vite |
| `npm --prefix client run build` | Production build |
| `npm --prefix client run lint` | ESLint |
| `npm --prefix client run preview` | Preview built client |

### Server Scripts

| Command | Description |
| --- | --- |
| `npm --prefix server run dev` | Start backend with nodemon |
| `npm --prefix server run start` | Start backend with Node |
| `npm --prefix server run test` | Run Node test runner |

## Local URLs

- Client: `http://localhost:5173`
- Server: `http://localhost:5000`
- API Base: `http://localhost:5000/api`
- Health: `http://localhost:5000/api/health`
- Uploads: `http://localhost:5000/uploads/...`

## API Overview

### Health Route

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Report service and database readiness |

### Auth Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register a new user and issue cookie session |
| `POST` | `/api/auth/login` | Public | Login and issue cookie session |
| `POST` | `/api/auth/refresh` | Public with refresh cookie | Refresh session cookies |
| `POST` | `/api/auth/logout` | Session user | Clear session cookies |
| `GET` | `/api/auth/me` | Authenticated | Return current normalized user |

### Parking Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/parking` | Public | List public `active` parking slots |
| `GET` | `/api/parking/available` | Public | List live available slots for a time range |
| `GET` | `/api/parking/my` | Authenticated | List owned slots or all slots for super admin |
| `GET` | `/api/parking/favorites` | Authenticated | Get favorite parking slot IDs |
| `POST` | `/api/parking/:id/favorite` | Authenticated | Save a slot to favorites |
| `DELETE` | `/api/parking/:id/favorite` | Authenticated | Remove a saved favorite |
| `POST` | `/api/parking` | Admin or Super Admin | Create a parking slot |
| `PUT` | `/api/parking/:id` | Admin or Super Admin | Update a parking slot |
| `DELETE` | `/api/parking/:id` | Admin or Super Admin | Delete a parking slot |

### Booking Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/bookings` | Authenticated | Create a booking |
| `GET` | `/api/bookings/my` | Authenticated | Get the current user's bookings |
| `PUT` | `/api/bookings/cancel/:id` | Authenticated | Cancel an active owned booking |

### Routing Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/routing/matrix` | Authenticated | Rank visible parking slots by Google traffic-aware ETA when configured |
| `POST` | `/api/routing/routes` | Authenticated | Fetch the focused route and alternative route options for the selected slot |

### Admin Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/admin/bookings/today` | Admin or Super Admin | View managed bookings for a selected date |
| `PUT` | `/api/admin/bookings/:id/validate` | Admin or Super Admin | Validate customer arrival |
| `GET` | `/api/admin/analytics` | Admin or Super Admin | Fetch dashboard analytics |
| `GET` | `/api/admin/users/admins` | Super Admin | List admins and super admins |
| `POST` | `/api/admin/users/admins` | Super Admin | Create an admin account |

## End-to-End Workflows

### 1. Authentication Workflow

1. A user registers or logs in.
2. The backend issues access and refresh cookies.
3. The frontend stores only normalized user state in React context.
4. Protected requests run with `withCredentials: true`.
5. If the access token expires, Axios silently calls `/api/auth/refresh`.
6. The app restores the current user from `/api/auth/me`.

### 2. Super Admin Workflow

1. Register a normal account.
2. Promote the account to `super_admin` in MongoDB.
3. Login and open `/admin`.
4. Create admins from the admin management section.
5. Monitor platform inventory, analytics, and validation activity.

### 3. Admin Workflow

1. Login as an admin.
2. Open `/admin`.
3. Create a parking slot with:
   - title
   - address
   - coordinates
   - image upload or image URL
   - price
   - slot count
   - slot status
   - accessible and VIP spot counts
4. The backend creates physical `ParkingSpot` records.
5. Manage slot health through `active`, `maintenance`, and `inactive`.
6. Review daily bookings and validate arrivals.

### 4. User Search and Booking Workflow

1. Login and open `/search`.
2. Filter by location, price, and optional time window.
3. Search results and map update together.
4. Optionally enable browser location.
5. Sort by the fastest route using Google traffic-aware ETA when configured, or standard road distance otherwise.
6. Select time range and spot preference.
7. Create a booking.
8. Review booking state from `My Bookings`.

### 5. Favorites and Quick Rebook Workflow

1. Save a slot from the search page or booking history.
2. The backend stores slot IDs on the user record.
3. Saved slots are highlighted in search.
4. Use `Quick Rebook` from `My Bookings`.
5. The search page opens with prefilled booking data for review.

### 6. Validation Workflow

1. User creates a booking.
2. Booking starts as `status: booked` and `validationStatus: pending`.
3. Admin sees it in the validation desk.
4. Admin validates arrival.
5. User sees `validated` state in booking history.

### 7. Booking Expiry Workflow

1. A booking is created with an expiry deadline.
2. If it is not validated before `expiresAt`, the lifecycle job cancels it.
3. Cancellation reason becomes `expired`.
4. Availability is released automatically.
5. Realtime events update search and admin views.

### 8. Analytics Workflow

Admins and super admins can monitor:

- total revenue
- average daily revenue
- occupancy rate
- total bookings
- cancelled bookings
- validation rate
- peak hours
- daily revenue trend
- cancellation trend

## Real-Time Events

Realtime channels currently include:

- `parking:availability-changed`
- `booking:changed`
- `parking:inventory-changed`

Client screens using live subscriptions include:

- search
- my bookings
- admin console

## Business Rules

- only `active` slots are publicly searchable
- `maintenance` and `inactive` slots remain visible in admin inventory
- admins can manage only slots they own
- super admins can manage all slots
- users can cancel only their own active bookings
- bookings must have valid start and end times
- booking end time must be after start time
- a slot cannot be deleted while active bookings still exist
- accessible and VIP spot counts cannot exceed configured slot count
- bookings are assigned to actual physical spots, not only a numeric counter
- expired bookings automatically release capacity

## Testing and Verification

Recommended commands:

```bash
npm run lint
npm run test:server
npm run build
```

Suggested local test sequence:

1. Register `superadmin@parkpal.com`
2. Promote it to `super_admin` in MongoDB
3. Login as super admin
4. Create `admin@parkpal.com`
5. Login as admin, use current location in the slot form, and create a slot with an uploaded image
6. Register `user1@parkpal.com`
7. Login as user and create a booking
8. Save that slot to favorites
9. Validate the booking as admin
10. Reopen `My Bookings` and test quick rebook

## Known Notes

- without Google keys, the app still works and falls back to OpenStreetMap plus OSRM routing
- with only `VITE_GOOGLE_MAPS_API_KEY` configured, the map can render on Google Maps but ETA ranking still falls back to non-Google routing until `GOOGLE_MAPS_API_KEY` is set on the server
- if geolocation permission is already granted, the admin slot form auto-fills the current map pin and still lets you refresh it manually
- if device location is blocked even after browser permission is granted, admins can click the inventory map to place the slot pin manually
- uploaded images are stored on disk unless you point `UPLOADS_DIRECTORY` at a persistent location
- the map shows route previews and travel estimates, not full turn-by-turn navigation
- `server/uploads` is intentionally ignored from git

## Future Directions

Good next improvements from here:

- cloud image storage
- notifications and reminders
- dynamic pricing
- richer turn-by-turn navigation
- more backend test coverage
- frontend end-to-end coverage
