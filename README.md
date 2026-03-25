# ParkPal

ParkPal is a full-stack parking management and booking platform built for three roles:

- `user`: search, save, book, cancel, and rebook parking slots
- `admin`: manage owned inventory, upload slot images, validate arrivals, and monitor daily operations
- `super_admin`: manage admins, view cross-admin inventory, and monitor analytics across managed slots

The project now goes well beyond a basic CRUD demo. It includes cookie-based auth with refresh tokens, role-aware routing, real-time updates, map intelligence, booking lifecycle automation, analytics, favorites, quick rebook, and local image upload for parking slots.

## Quick Start

From the project root:

```powershell
npm --prefix client install
npm --prefix server install
npm run dev
```

The server needs a `server/.env` file with at least:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
```

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

Demo credentials:

- Super admin: `superadmin@parkpal.test` / `SuperAdmin@123`
- Mall admins: use any seeded mall admin email / `Mall@123`
- Demo users: use any seeded `@parkpal.test` email / `User@123`

## Current Feature Set

### User Features

- Register and login with secure HTTP-only cookie sessions
- Search parking slots by location, price, and optional live time range
- View parking inventory on a Leaflet map with OpenStreetMap tiles
- Use browser location to see nearby slots and sort by nearest parking
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
- Mark slots as `active`, `maintenance`, or `inactive`
- Configure spot mix:
  - accessible spots
  - VIP spots
  - standard spots
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

## Recommended Local Credentials

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
| Maps | Leaflet, React Leaflet, OpenStreetMap |
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
- regression tests for auth, booking conflicts, and admin permissions

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
- distance labels
- highlighted selected slot
- simple route preview line between user and selected slot

No Google Maps or Mapbox API key is required. The map uses OpenStreetMap tiles.

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

Uploaded files are stored locally on the server under `server/uploads/parking` and served via `/uploads/...`.

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
|   |   |   `-- realtimeService.js
|   |   |-- utils/
|   |   |   |-- constants.js
|   |   |   `-- formatDate.js
|   |   |-- App.jsx
|   |   `-- main.jsx
|   `-- package.json
|-- server/
|   |-- config/
|   |   `-- db.js
|   |-- controllers/
|   |   |-- adminController.js
|   |   |-- authController.js
|   |   |-- bookingController.js
|   |   `-- parkingController.js
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
|   |   `-- parkingRoutes.js
|   |-- tests/
|   |   |-- helpers/
|   |   `-- platformHardening.test.js
|   |-- utils/
|   |   |-- authSession.js
|   |   |-- bookingLifecycle.js
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
- `App.jsx` handles route registration
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
- `SearchPage.jsx`: filters, booking form, map, favorites, location tools
- `MyBookingsPage.jsx`: history, cancellation, saved slots, quick rebook
- `AdminPage.jsx`: inventory, uploads, validation desk, analytics, admin management

## Backend Architecture

### App Bootstrap

- `server.js` loads env vars, connects MongoDB, starts Express and Socket.IO, and runs lifecycle maintenance on an interval
- `app.js` builds the Express app, enables CORS, parses JSON, serves uploads, and mounts routes

### Middleware

- `authMiddleware.js`: reads cookie-based access tokens and attaches `req.user`
- `adminMiddleware.js`: enforces `admin` and `super_admin` access
- `errorMiddleware.js`: centralized async and error handling
- `rateLimitMiddleware.js`: API, auth, booking mutation, and admin mutation throttling

### Business Logic

- `authController.js`: register, login, logout, refresh, current user
- `bookingController.js`: booking creation, cancellation, and user booking history
- `parkingController.js`: inventory CRUD, favorites, public search, managed slots
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
```

Client:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_SERVER_URL=http://localhost:5000
```

Notes:

- `CLIENT_ORIGIN` can be a comma-separated list
- uploads are served from the backend automatically
- if `VITE_SOCKET_SERVER_URL` is not set, the client derives it from `VITE_API_BASE_URL`

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
- Uploads: `http://localhost:5000/uploads/...`

## API Overview

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
5. Sort by nearest parking.
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
5. Login as admin and create a slot with coordinates and an uploaded image
6. Register `user1@parkpal.com`
7. Login as user and create a booking
8. Save that slot to favorites
9. Validate the booking as admin
10. Reopen `My Bookings` and test quick rebook

## Known Notes

- the map uses OpenStreetMap, so no external maps API key is required
- route guidance on the map is currently a visual straight-line preview, not turn-by-turn navigation
- uploaded images are stored locally on disk, not in Cloudinary or S3
- Vite may show a bundle-size warning during build, but the client still builds successfully
- `server/uploads` is intentionally ignored from git

## Future Directions

Good next improvements from here:

- cloud image storage
- notifications and reminders
- dynamic pricing
- richer route guidance
- more backend test coverage
- chunk splitting on the client build
