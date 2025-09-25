import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 12);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.join(__dirname, '../storage');
const dbPath = path.join(storageDir, 'db.json');

let state = { jobs: {}, order: [], inflight: {} };

export function ensureStorage() {
  fs.ensureDirSync(storageDir);
  if (!fs.existsSync(dbPath)) fs.writeJSONSync(dbPath, state, { spaces: 2 });
  try {
    state = fs.readJSONSync(dbPath);
  } catch {
    state = { jobs: {}, order: [], inflight: {} };
  }
}

export function saveDB() {
  fs.writeJSONSync(dbPath, state, { spaces: 2 });
}

function createJobBase({ type, prompt, cacheKey }) {
  const id = nanoid();
  const job = { id, type, prompt: prompt || '', cacheKey, status: 'pending', createdAt: Date.now() };
  state.jobs[id] = job;
  state.order.unshift(id);
  saveDB();
  return job;
}

export function updateJob(id, patch) {
  if (!state.jobs[id]) return;
  state.jobs[id] = { ...state.jobs[id], ...patch, updatedAt: Date.now() };
  saveDB();
}

export function getJob(id) {
  return state.jobs[id] || null;
}

export function recentJobs(n = 20) {
  return state.order.slice(0, n).map(id => state.jobs[id]).filter(Boolean);
}

export function findCachedJob({ type, key }) {
  const match = Object.values(state.jobs).find(j => j.type === type && j.cacheKey === key && j.status === 'done' && j.fileUrl);
  return match || null;
}

export function coalesceRequest(key) {
  // Return existing job id if in-flight
  return state.inflight[key] || null;
}

export function releaseCoalesced(key, jobId) {
  if (state.inflight[key] && state.inflight[key] !== jobId) return;
  delete state.inflight[key];
  saveDB();
}

// Record in-flight when createJob is called by route
export function createJobCoalesced(opts) {
  const job = createJobBase(opts);
  state.inflight[opts.cacheKey] = job.id;
  saveDB();
  return job;
}

// Backwards compatibility: routes import createJob from here and we export a wrapper
export { createJobCoalesced as createJob };
