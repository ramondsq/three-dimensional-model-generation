import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { ensureStorage, saveDB, createJob, getJob, updateJob, recentJobs, findCachedJob, coalesceRequest, releaseCoalesced } from '../store.js';
import { normalizePrompt, hashBuffer } from '../utils.js';
import { provider } from '../providers/index.js';
import { evaluateModel } from '../validator.js';

export const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

ensureStorage();

// Basic per-IP rate limiter (shared with provider-level limiter)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_RPS || 2) * 60,
});

router.use(limiter);

router.get('/recent', (req, res) => {
  res.json({ items: recentJobs(20) });
});

router.get('/cache/lookup', (req, res) => {
  const prompt = req.query.prompt || '';
  const key = normalizePrompt(prompt);
  const job = findCachedJob({ type: 'text', key });
  res.json({ match: job ? { jobId: job.id, url: job.fileUrl, prompt: job.prompt } : null });
});

router.post('/generate/text', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });
  const key = normalizePrompt(prompt);

  // Exact-cache hit
  const cached = findCachedJob({ type: 'text', key });
  if (cached) return res.json({ jobId: cached.id, cached: true });

  // Coalesce in-flight
  const inflight = coalesceRequest(key);
  if (inflight) return res.json({ jobId: inflight, cached: false, coalesced: true });

  const job = createJob({ type: 'text', prompt, cacheKey: key });
  res.json({ jobId: job.id, cached: false });

  try {
    const taskId = await provider.submitText(prompt);
    await pollUntilComplete(taskId, job.id);
  } catch (err) {
    console.error(err);
    const msg = err?.response?.data?.message || err.message || 'generation failed';
    updateJob(job.id, { status: 'error', error: msg });
  } finally {
    releaseCoalesced(key, job.id);
  }
});

router.post('/generate/image', upload.single('image'), async (req, res) => {
  const prompt = req.body?.prompt || '';
  const buffer = req.file?.buffer;
  const mimeType = req.file?.mimetype;
  if (!buffer) return res.status(400).json({ error: 'image file required' });

  const imgHash = await hashBuffer(buffer);
  const key = `img:${imgHash}|${normalizePrompt(prompt)}`;

  const cached = findCachedJob({ type: 'image', key });
  if (cached) return res.json({ jobId: cached.id, cached: true });

  const inflight = coalesceRequest(key);
  if (inflight) return res.json({ jobId: inflight, cached: false, coalesced: true });

  const job = createJob({ type: 'image', prompt, cacheKey: key });
  res.json({ jobId: job.id, cached: false });

  try {
    const taskId = await provider.submitImage(buffer, mimeType, prompt);
    await pollUntilComplete(taskId, job.id);
  } catch (err) {
    console.error(err);
    const msg = err?.response?.data?.message || err.message || 'generation failed';
    updateJob(job.id, { status: 'error', error: msg });
  } finally {
    releaseCoalesced(key, job.id);
  }
});

router.get('/jobs/:id', async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job);
});

router.get('/metrics/:id', async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job.metrics || {});
});

router.post('/feedback', (req, res) => {
  const { jobId, rating, notes } = req.body || {};
  const job = getJob(jobId);
  if (!job) return res.status(404).json({ error: 'not found' });
  job.feedback = { rating: rating === 1 ? 1 : -1, notes: (notes || '').slice(0, 1000), at: Date.now() };
  saveDB();
  res.json({ ok: true });
});

async function pollUntilComplete(taskId, jobId) {
  // Basic polling with backoff
  const start = Date.now();
  const deadline = start + 15 * 60 * 1000; // 15 min
  let interval = 2000;
  while (Date.now() < deadline) {
    const status = await provider.checkStatus(taskId);
    if (status.status === 'SUCCEEDED' && status.modelUrl) {
      const fileInfo = await provider.downloadModel(status.modelUrl, jobId);
      const publicUrl = `${process.env.PUBLIC_BASE_URL || 'http://localhost:5001'}/files/${fileInfo.fileName}`;
      updateJob(jobId, { status: 'done', filePath: fileInfo.filePath, fileUrl: publicUrl, provider: process.env.PROVIDER || 'meshy' });
      // Evaluate
      try {
        const metrics = await evaluateModel(fileInfo.filePath);
        updateJob(jobId, { metrics });
      } catch (e) {
        console.warn('eval failed:', e.message);
      }
      return;
    }
    if (status.status === 'FAILED') {
      updateJob(jobId, { status: 'error', error: status.error || 'provider failed' });
      return;
    }
    await new Promise(r => setTimeout(r, interval));
    interval = Math.min(8000, Math.round(interval * 1.3));
  }
  updateJob(jobId, { status: 'error', error: 'timeout' });
}
