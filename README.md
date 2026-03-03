# Cell Tale Diagnostics

A full-stack React + Firebase web application for a home-collection diagnostics lab. Patients can register, book health test appointments, and view digital reports. Admins manage all bookings and upload PDF reports with structured test values.

---

## Prerequisites

- Node.js 20+
- A Firebase project on the **Blaze (pay-as-you-go)** plan — required for Firebase Storage

---

## Firebase Console Setup

### 1. Authentication
- Go to **Authentication → Sign-in method**
- Enable **Email/Password** provider
- Enable **Google** provider (add your app domain to authorized domains)

### 2. Firestore Database
- Go to **Firestore Database → Create database**
- Start in **production mode**
- Select region: `asia-south1` (or your preferred region)
- After creation, go to **Rules** tab and paste the contents of `firestore.rules`

### 3. Storage
- Go to **Storage → Get started**
- Accept defaults
- Go to the **Rules** tab and paste the contents of `storage.rules`

### 4. Composite Indexes
Go to **Firestore → Indexes → Composite** and create these indexes:

| Collection | Field 1 | Field 2 | Query Scope |
|---|---|---|---|
| `appointments` | `patientId` ASC | `createdAt` DESC | Collection |
| `appointments` | `status` ASC | `createdAt` DESC | Collection |
| `appointments` | `date` ASC | `status` ASC | Collection |
| `reports` | `patientId` ASC | `uploadedAt` DESC | Collection |

---

## Clone & Install

```bash
git clone <your-repo-url>
cd cell_tale
npm install
```

---

## Environment Variables

Copy your Firebase SDK config from **Firebase Console → Project Settings → Your apps → Web app → SDK setup and configuration**:

```bash
# .env.local
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

`.env.local` is already in `.gitignore` — never commit this file.

---

## Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Promote First Admin

1. Register a new account via the UI
2. Go to **Firebase Console → Authentication** and copy the UID of that user
3. Go to **Firestore → users → {uid}** and edit the `role` field from `"patient"` to `"admin"`
4. Log out and log back in — you'll be redirected to `/admin`

---

## Build & Deploy

```bash
npm run build
```

To deploy to Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # set public dir to "dist", SPA mode (rewrite all to index.html)
firebase deploy
```

---

## Project Structure

```
src/
  types/          # All TypeScript interfaces + constants (PACKAGES, TIME_SLOTS, STATUS_COLORS)
  lib/            # Firebase init, Firestore helpers, Storage helpers
  contexts/       # AuthContext (auth state, sign-in methods, isAdmin)
  hooks/          # useAppointments, useReports
  components/
    ui/           # Button, Input, Badge, Card, LoadingSpinner, Modal
    layout/       # Navbar, Footer, BrandLogo, ProtectedRoute, AdminRoute, DashboardLayout
  pages/
    public/       # LandingPage, LoginPage, RegisterPage
    patient/      # DashboardPage, BookAppointmentPage, AppointmentsPage, ReportsPage, ProfilePage
    admin/        # AdminDashboardPage, AdminAppointmentsPage, AdminUploadReportPage, AdminPatientsPage
  App.tsx         # Route definitions
  main.tsx        # React entry point
```
