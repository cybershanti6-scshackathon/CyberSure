# CYBERSURE deployment — Vercel frontend + public HTTPS FastAPI backend

## Architecture

```
Local development                     Production
─────────────────                     ──────────
React  http://localhost:5173   →      React  https://cybersure.vercel.app
              ↓                                ↓ HTTPS
FastAPI http://localhost:8000  →      FastAPI https://<public-backend-domain>
```

`localhost` in the browser means *the machine running the browser*, never the
developer's computer — so production must never point at `http://localhost:8000`.
The two sides are configured independently:

| | Development | Production |
|---|---|---|
| Frontend API URL | `VITE_API_BASE_URL=http://localhost:8000` in `.env` (gitignored) | `VITE_API_BASE_URL=https://<public-backend-domain>` in **Vercel → Production** |
| Backend CORS | defaults already trust any localhost port | `CYBERSURE_CORS_ORIGINS=https://cybersure.vercel.app` on the backend |

## 1. Where the FastAPI backend is deployed

Any host that runs Python/uvicorn and terminates HTTPS. The repo ships
[`render.yaml`](render.yaml) — a Render Blueprint that deploys **the existing
`backend/` service unchanged** (Render is only a suggestion; any similar PaaS
works with the same command and variables):

- `New → Blueprint → connect this repository`
- root directory: `backend`, build: `pip install -r requirements.txt`
- health check: `/api/v1/health`
- the service receives a public URL such as `https://cybersure-api.onrender.com`

## 2. Production start command

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

- `--host 0.0.0.0` — uvicorn binds `127.0.0.1` by default, which the platform's
  proxy cannot reach.
- `$PORT` — the platform injects it (Render/Railway/Fly all do); fall back to
  `8000` locally.
- **No `--reload` in production.**

Local development is unchanged: `cd backend && python -m uvicorn app.main:app
--reload --port 8000` (or `npm run dev:api`).

## 3. Public backend URL

`https://<public-backend-domain>` — the URL your host assigns, e.g.
`https://cybersure-api.onrender.com`. It must answer:

```bash
curl https://<public-backend-domain>/api/v1/health
# {"status":"ok","service":"CYBERSURE Conversion API",...}
```

That response comes from the real FastAPI app (`app/api/routes/health.py`).

## 4. Vercel environment variable

**Settings → Environment Variables → Environment: `Production`**

```
VITE_API_BASE_URL=https://<public-backend-domain>
```

Never `http://localhost:8000` in production. Vite inlines `VITE_*` values at
build time — existing environment variables win over the gitignored `.env`
file — so **after changing this variable you must redeploy** (Deployments →
Redeploy, or trigger a new commit deploy). The frontend reads it in exactly one
place: `src/lib/api.ts`.

## 5. Backend CORS variable

```
CYBERSURE_CORS_ORIGINS=https://cybersure.vercel.app
```

- Comma-separated list; set on the backend host (already set in
  `render.yaml`).
- Defaults in `backend/app/core/config.py` already include the Vercel origin
  plus `localhost`/`127.0.0.1` on ports 5173/5174/4173 (and a loopback regex
  covers any local port), so local development keeps working with or without
  the variable.
- Never `allow_origins=["*"]` — the middleware sends the concrete origin back
  (`access-control-allow-origin: https://cybersure.vercel.app`) and refuses
  lookalike origins (covered by `backend/tests/test_health_devices.py`).

## 6. Which Vercel environment needs the variable

**Production.** Add `Preview`/`Development` entries too if you deploy preview
branches — then also allow those URLs in `CYBERSURE_CORS_ORIGINS`.

## 7. Redeploy after changing `VITE_API_BASE_URL`

Required. The value is baked into the JS bundle during `vite build`
(`npm run build` → `tsc --noEmit && vite build`), so an env-var change has no
effect until the next build. `vercel.json` adds the SPA rewrite so deep links
like `/converter` load `index.html`.

## Acceptance checklist

```bash
# 1. Health from any browser origin (Vercel's origin must appear in the headers)
curl -si https://<public-backend-domain>/api/v1/health \
  -H "Origin: https://cybersure.vercel.app" | grep -i access-control-allow-origin

# 2. Preflight for the JSON conversion call
curl -si -X OPTIONS https://<public-backend-domain>/api/v1/conversions \
  -H "Origin: https://cybersure.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" | head -1     # → HTTP/1.1 200

# 3. A real conversion
curl -s https://<public-backend-domain>/api/v1/conversions \
  -H "Content-Type: application/json" -H "Origin: https://cybersure.vercel.app" \
  -d '{"source_platform":"cisco-iosxe","target_platform":"juniper-junos","configuration":"hostname Router1\n"}'
```

Then open `https://cybersure.vercel.app`, confirm the banner reads
*Conversion service connected*, and run Cisco IOS XE → Juniper Junos in the
Configuration Converter.

**Local development remains exactly as before:** frontend
`http://localhost:5173`, backend `http://localhost:8000`, no environment
variables required.
