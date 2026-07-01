# Deployment Guide

## Architecture Overview

This project has two separate parts:

| Part | Technology | Can run on Vercel? |
|---|---|---|
| Frontend | React + Vite (static build) | ✅ Yes |
| Backend | Go binary (spawns `go run` child processes) | ❌ No |

Vercel only runs Node.js/Python serverless functions — it **cannot** run a long-lived Go binary
or spawn child processes via `exec`. The backend must run on a server that supports Go.

---

## Deploying the Go Backend

### Option A: Railway (recommended — free tier available)

1. Create an account at [railway.app](https://railway.app)
2. From the Railway dashboard, click **New Project → Deploy from GitHub repo**
3. Select this repository
4. Railway will auto-detect Go. Set the **root directory** to `backend/`
5. Add these environment variables in the Railway service settings:
   - `PORT=8080` (Railway injects `$PORT`; the server must read it)
6. Click **Deploy**. Railway gives you a public URL like `https://go-exam-backend-production.up.railway.app`
7. Copy that URL — you'll need it for the frontend env var below

> **Alternative hosts:** [Fly.io](https://fly.io) (`fly launch` in `backend/`),
> [Render](https://render.com) (free tier Web Service, Go buildpack),
> or a $5 [DigitalOcean](https://digitalocean.com) droplet running the binary directly.

---

## Deploying the Frontend to Vercel

### Step 1 — Set the API URL

Create a `.env.production` file (or set it in the Vercel dashboard):

```
VITE_API_BASE_URL=https://your-go-backend.railway.app
```

With `VITE_API_BASE_URL` set, the Vite dev proxy is disabled and the frontend calls
the real backend URL directly from the browser.

### Step 2 — Deploy to Vercel

```bash
# Install Vercel CLI (once)
npm i -g vercel

# From the project root
vercel
```

Or connect via the [Vercel dashboard](https://vercel.com/new):
1. Import your GitHub repository
2. Framework Preset: **Other** (the `vercel.json` handles it)
3. Add environment variable: `VITE_API_BASE_URL` = your Railway backend URL
4. Click **Deploy**

### Step 3 — Custom domain

In the Vercel dashboard → your project → **Settings → Domains**, add:

```
favour-bim.vercel.app
```

or any custom domain you own.

---

## How `VITE_API_BASE_URL` Works

The Vite config (`vite.config.ts`) reads this variable:

```typescript
proxy: process.env.VITE_API_BASE_URL ? {} : {
  '/api': { target: 'http://localhost:8080', changeOrigin: true }
}
```

- **Development** (`VITE_API_BASE_URL` not set): all `/api/*` requests are proxied to `localhost:8080`
- **Production** (`VITE_API_BASE_URL=https://...`): proxy is empty; the frontend must call the backend URL directly

> **Note:** With the proxy disabled, the frontend's `fetch('/api/...')` calls won't automatically
> reach the backend. You'll need to prefix API calls with the backend URL, or configure a Vercel
> rewrite rule. The simplest approach: set a `VITE_API_BASE_URL` env var and update fetch calls
> to use `import.meta.env.VITE_API_BASE_URL + '/api/...'`, or use Vercel rewrites in `vercel.json`
> to proxy `/api/*` to your Railway backend.

### Vercel rewrite approach (easiest for production)

Add this to `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null,
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://your-go-backend.railway.app/api/:path*" }
  ]
}
```

This lets the frontend keep using `/api/...` paths unchanged — Vercel transparently forwards
them to the Go backend.

---

## Quick Reference

```
Frontend URL:  https://favour-bim.vercel.app
Backend URL:   https://your-go-backend.railway.app
```
