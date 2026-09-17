# BhuDrishti V53 — Public Deployment

Recommended split deployment:

- Frontend: Vercel (Vite/React)
- Backend: Render Web Service (Express)

## 1. Put the project on GitHub

Upload the contents of this folder to a GitHub repository. Do **not** commit `backend/.env` or any passwords/app passwords.

## 2. Deploy the backend on Render

Create a **Web Service** from the repository.

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Set the Render environment variables:

```text
FRONTEND_URL=https://YOUR-FRONTEND.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sender@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=BhuDrishti <your-sender@gmail.com>
AUTH_USERS_JSON=[]
```

SMTP variables are optional unless you want login-success emails. After deployment, test `https://YOUR-API.onrender.com/api/health`.

## 3. Deploy the frontend on Vercel

Create a Vercel project from the same repository and set **Root Directory** to `frontend`.

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Add this Vercel environment variable:

```text
VITE_API_URL=https://YOUR-API.onrender.com
```

`frontend/vercel.json` already includes the SPA rewrite for direct routes.

## 4. Test

After both services are live, test Overview, Land Map & GIS, parcel search/click, Analytics, Legal Research, AI Evidence, Policy Sandbox, Future City and Login/Create Account.

## 5. Prototype note

The simple login stores users in a JSON file on the backend. That is acceptable for a hackathon prototype, but not a production identity system. For a public demo, consider pre-created demo accounts or a managed auth/database service later.
