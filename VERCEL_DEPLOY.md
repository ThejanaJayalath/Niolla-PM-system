# Deploying Niolla PM to Vercel

You can host both the **frontend** and **backend (Express API)** on Vercel in one project.

## Prerequisites

- **MongoDB**: Use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier). The app cannot use a local MongoDB on Vercel.
- **Node**: Project uses Node 18+.

## Steps

### 1. Push your code to GitHub/GitLab/Bitbucket

Ensure the repo includes the root `vercel.json`, the `api/` folder, and both `frontend/` and `backend/` folders.

### 2. Import the project in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. **Add New** → **Project** and import your repository.
3. Leave **Root Directory** as the repo root (do not set it to `frontend`).

### 3. Set environment variables (required for sign-in)

**If these are missing, login will show "Request failed" or 502/503.**

In the Vercel project: **Settings** → **Environment Variables**. Add:

| Name           | Value                    | Notes                          |
|----------------|--------------------------|--------------------------------|
| `MONGODB_URI`  | `mongodb+srv://...`      | From MongoDB Atlas (e.g. Connect → Drivers). **Required.** |
| `JWT_SECRET`   | A long random string     | Use a strong secret for production. **Required.** |

Optional (for seeding an owner later, or for backend-only env):

- `ADMIN_EMAIL` – owner email  
- `ADMIN_PASSWORD` – owner password  
- `ADMIN_NAME` – owner display name  

Apply these to **Production**, and optionally to **Preview** if you use branch deploys.

### 4. Deploy

Click **Deploy**. Vercel will:

1. Run `installCommand`: install dependencies in `backend` and `frontend`.
2. Run `buildCommand`: build backend (`backend/dist`) then frontend (`frontend/dist`).
3. Serve the frontend from `frontend/dist` and run the Express app as a serverless function for `/api/*`.

### 5. Create the first owner (after first deploy)

The backend runs as serverless, so you cannot run `npm run seed` on Vercel directly. Either:

- **Option A**: Run the seed script once from your machine (with the same `MONGODB_URI` and optional `ADMIN_*` env vars set locally), then deploy.  
  From the repo root:  
  `cd backend && npx dotenv -e ../.env -- npx ts-node scripts/seedAdmin.ts`  
  (or set env in the shell and run `npx ts-node scripts/seedAdmin.ts`.)

- **Option B**: Create the owner user directly in MongoDB Atlas (e.g. Compass or shell): insert a document in the `users` collection with `email`, `passwordHash` (bcrypt hash of the password), `name`, `role: 'owner'`, and `createdAt`/`updatedAt`.

After that, open your Vercel URL, go to the login page, and sign in with the owner account.

## How it works

- **Frontend**: Built from `frontend/` (Vite/React), served from `frontend/dist`. All non-API routes are rewritten to `index.html` (SPA).
- **Backend**: The file `api/index.js` exports the Express app. Every request to `/api/*` is handled by this serverless function. The app connects to MongoDB on the first request (lazy connect).

## Optional: Frontend only on Vercel, backend elsewhere

If you prefer to host the backend on Railway, Render, Fly.io, etc.:

1. Deploy the backend to that platform and note its URL (e.g. `https://your-api.railway.app`).
2. In Vercel, set **Root Directory** to `frontend` and use the Vite preset (or custom build/output).
3. Add env var `VITE_API_URL=https://your-api.railway.app` in Vercel.
4. In the frontend, make the API client use `import.meta.env.VITE_API_URL` when set, otherwise `/api/v1` (see `frontend/src/api/client.ts`).

You would then remove or not use the root `vercel.json` and `api/` folder for that setup.
