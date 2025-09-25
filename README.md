# Three-Dimensional Model Generation Web App

An end-to-end web app that generates single 3D assets from text or image, with an integrated evaluation system and API call optimization. This project includes:

- A React (Vite) frontend for prompt/image input, model preview, and feedback
- An Express backend that calls a 3D generation provider (Meshy) with caching, deduplication, and rate limiting
- An automated evaluation pipeline using glTF Validator and basic asset heuristics

This README includes the product brief and design decisions (items 1–5), plus setup and usage.

## 🎯 Target users, pain points, and user stories

Target users:

1) 3D artists and indie game developers
- Pain points: creating base meshes quickly; re-topology and UV hassles; iterating on ideas from text/image references.
- Story: “As a solo dev, I want to generate a base 3D asset from a prompt or a single concept image to block out levels fast, then refine in my DCC tool.”

2) Product/marketing designers
- Pain points: getting quick 3D product mockups for concept demos; limited 3D skills/time.
- Story: “As a marketing designer, I need a good-enough 3D model from a product photo to create interactive demos, without waiting days.”

3) Researchers/AI prototypers
- Pain points: need a simple playground to compare models/providers and collect structured feedback.
- Story: “As an AI engineer, I want a standardized pipeline to generate assets and auto-score quality for rapid iteration.”

## ✅ Features (with priorities) and current scope

Must-have (P0):
- Text-to-3D and Image-to-3D submission
- Job lifecycle UI with status polling
- 3D preview (GLB/GLTF) in-browser
- Basic auto-evaluation (glTF Validator + file/asset heuristics)
- Feedback collection (thumbs up/down + notes)
- API call optimization: caching, deduplication, coalescing, and rate limiting

Nice-to-have (P1):
- Prompt cache suggestions (reuse previous similar requests)
- Recent results gallery
- Download model files

Future (P2):
- Multi-view rendering + CLIP similarity scoring
- Advanced topology/UV checks and watertightness estimation
- Semantic search across prior assets

Implemented in this version:
- All P0 items and part of P1 (prompt cache suggestions, recent items, downloads)

## 🔌 Provider comparison and choice

Compared providers:

- Meshy: Text-to-3D and Image-to-3D APIs, good quality/speed balance, REST endpoints, standard outputs (GLB/GLTF), straightforward auth and pricing.
- Kaedim: Strong 2D→3D, but historically more oriented toward human-assisted pipelines and enterprise plans.
- 3DFY: Text-to-3D API; quality varies by category; access sometimes gated.
- Luma AI: Great quality and tooling; API access/features for 3D assets evolving; some features primarily web-first.

Choice: Meshy
- Rationale: Mature REST API for both text and image, predictable job polling, outputs compatible with web viewers, and clear onboarding.

Note: The API adapter is modular; you can swap providers by editing `server/src/providers/meshy.js` (or adding another provider module) without changing the UI.

## 📏 Evaluation metrics and system design

Key metrics (automated):
- Validator health: number of errors/warnings/infos from glTF-Validator
- Asset presence checks: textures/materials presence, image count, materials count
- File stats: file size (bytes), format (glb/gltf)

Key metrics (human-in-the-loop):
- User rating: thumbs up/down, optional notes

System design:
- On model completion, the backend downloads the asset and runs glTF-Validator to produce a report.
- The report is normalized into a compact scorecard stored with the job.
- The frontend displays metrics alongside the viewer and collects user ratings.
- Data is stored in a simple JSON DB (`storage/db.json`) for easy inspection. Swap to SQLite/Postgres later if needed.

Future extensions:
- Multi-angle render + CLIP similarity against prompt or reference image
- Mesh statistics (triangle/vertex counts) extracted via a GLTF parser

## ♻️ Reducing provider calls (frequency optimization)

Implemented strategies:
1) Exact-cache reuse: normalize prompt; for image inputs compute SHA-256 of content. If a previous successful job exists, return it instead of calling the provider.
2) Request coalescing: if an identical request is in-flight, attach to the same job id.
3) Rate limiting: per-process limiter to avoid hammering the provider.

Additional strategies (ideas):
- Semantic cache: use text/image embeddings and similarity thresholds to reuse “close enough” results.
- User prompt guidance: show cache suggestions as you type to encourage reuse.
- Tiered generation: quick-draft first, high-quality on-demand only if needed.

Chosen for this version: exact-cache + coalescing + rate limit (low risk, immediate savings with clear UX).

## 🏗️ Architecture

- Frontend: React (Vite), model preview via `<model-viewer>` (GLB/GLTF). Pages: Home (form), Job view (status, preview, metrics, feedback), Recent.
- Backend: Express server with provider adapter (Meshy). Endpoints for generation, polling, metrics, feedback, cache lookup. Stores files in `storage/models` and metadata in `storage/db.json`.

## 🚀 Getting started

Prerequisites:
- Node.js 18+
- A Meshy API key

Setup:
1) Create environment file
   - Copy `server/.env.example` to `server/.env` and set `MESHY_API_KEY`.
2) Install dependencies
3) Run backend and frontend in dev

If you don’t have a paid Meshy plan and see 402 Payment Required, set `PROVIDER=mock` in `server/.env` to continue frontend/backend development with a local mock provider (generates a minimal glTF for preview and evaluation).

Commands (run from the repo root):

```powershell
# 1) Install root + server + web deps
npm install
cd server; npm install; cd ..
cd web; npm install; cd ..

# 2) Start backend and frontend in separate terminals
npm --prefix server run dev
npm --prefix web run dev
```

Then open the frontend URL printed by Vite (usually http://localhost:5173). The backend defaults to http://localhost:5001.

## 🔧 Configuration

- Backend env (`server/.env`):
  - `PORT=5001`
  - `MESHY_API_BASE=https://api.meshy.ai/v2`
  - `MESHY_API_KEY=your_api_key_here`
  - `PUBLIC_BASE_URL=http://localhost:5001` (for absolute file URLs in responses)
  - `RATE_LIMIT_RPS=2` (simple token bucket per process)
  - `PROVIDER=meshy` (set to `mock` to develop without calling external APIs)

## 📡 API overview (backend)

- POST `/api/generate/text` { prompt: string }
  - Returns: { jobId, cached: boolean }
- POST `/api/generate/image` multipart/form-data fields: image (file), prompt (string, optional)
  - Returns: { jobId, cached: boolean }
- GET `/api/jobs/:id`
  - Returns job status/result/metrics when available.
- GET `/api/metrics/:id`
- POST `/api/feedback` { jobId, rating: 1|-1, notes?: string }
- GET `/api/cache/lookup?prompt=...`
- GET `/api/recent`

## 📦 Outputs

- Files saved under `storage/models/{jobId}.{glb|gltf}` (+ textures if glTF with external images)
- Job records in `storage/db.json`

## 🧪 Quality checks

- Build: Vite compiles frontend; Express starts without errors.
- Lint/Typecheck: Not included to keep the MVP lean. Add ESLint/TS later as needed.
- Unit tests: Not included in MVP; endpoints are small and can be integration-tested later.

## 📋 Requirements coverage

- (1) Users, pain points, stories; features and priorities; scope: Done (see above)
- (2) Provider choice and comparison: Done (Meshy vs others, rationale)
- (3) Metrics and evaluation system description: Done; implemented validator-based pipeline
- (4) Evaluation system design: Done; automated + human-in-the-loop; storage and UI wired
- (5) API call reduction: Done; cache, coalescing, rate limit; ideas listed
  
---

If you want me to switch providers or add semantic cache/CLIP scoring, say the word and I’ll extend the backend module and UI.
