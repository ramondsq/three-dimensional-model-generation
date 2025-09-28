import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const API_BASE_TEXT = process.env.MESHY_API_BASE_TEXT || process.env.MESHY_API_BASE || 'https://api.meshy.ai/openapi/v2';
const API_BASE_IMAGE = process.env.MESHY_API_BASE_IMAGE || 'https://api.meshy.ai/openapi/v1';
const KEY = process.env.MESHY_API_KEY;

if (!KEY) {
  console.warn('Warning: MESHY_API_KEY not set. Please configure server/.env');
}

const headers = () => ({
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json'
});

export const meshyProvider = {
  async submitText(prompt) {
    // Meshy text-to-3d: mode must be one of ['preview','refine']
    const mode = (process.env.MESHY_MODE || 'preview').toLowerCase();
    const payload = { prompt, mode };
    // Optional tuning via env
    if (process.env.MESHY_ART_STYLE) payload.art_style = process.env.MESHY_ART_STYLE;
    if (process.env.MESHY_AI_MODEL) payload.ai_model = process.env.MESHY_AI_MODEL;
    if (process.env.MESHY_TOPOLOGY) payload.topology = process.env.MESHY_TOPOLOGY;
    if (process.env.MESHY_TARGET_POLYCOUNT) payload.target_polycount = Number(process.env.MESHY_TARGET_POLYCOUNT);
    if (process.env.MESHY_SHOULD_REMESH) payload.should_remesh = /^true$/i.test(process.env.MESHY_SHOULD_REMESH);

  const { data } = await axios.post(`${API_BASE_TEXT}/text-to-3d`, payload, { headers: headers() });
    // Official docs: { result: "<taskId>" }
    const taskId = data?.result || data?.id || data?.task_id || data?.taskId;
    if (!taskId) {
      console.error('[meshy.submitText] Unexpected response format:', safePreview(data));
      throw new Error('Meshy: Failed to create task (unexpected response). Check server logs.');
    }
    return taskId;
  },

  async submitImage(buffer, mimeType, prompt) {
    // Build JSON payload with image_url (data URI)
    const b64 = Buffer.from(buffer).toString('base64');
    const dataUri = `data:${mimeType || 'image/jpeg'};base64,${b64}`;
    const payload = { image_url: dataUri };
    if (process.env.MESHY_AI_MODEL) payload.ai_model = process.env.MESHY_AI_MODEL;
    if (process.env.MESHY_TOPOLOGY) payload.topology = process.env.MESHY_TOPOLOGY;
    if (process.env.MESHY_TARGET_POLYCOUNT) payload.target_polycount = Number(process.env.MESHY_TARGET_POLYCOUNT);
    if (process.env.MESHY_SYMMETRY_MODE) payload.symmetry_mode = process.env.MESHY_SYMMETRY_MODE; // off|auto|on
    if (process.env.MESHY_SHOULD_REMESH) payload.should_remesh = /^true$/i.test(process.env.MESHY_SHOULD_REMESH);
    if (process.env.MESHY_SHOULD_TEXTURE) payload.should_texture = /^true$/i.test(process.env.MESHY_SHOULD_TEXTURE);
    if (process.env.MESHY_ENABLE_PBR) payload.enable_pbr = /^true$/i.test(process.env.MESHY_ENABLE_PBR);
    if (process.env.MESHY_IS_A_T_POSE) payload.is_a_t_pose = /^true$/i.test(process.env.MESHY_IS_A_T_POSE);
    if (process.env.MESHY_MODERATION) payload.moderation = /^true$/i.test(process.env.MESHY_MODERATION);
    // Use prompt as texture_prompt if present and allowed
    if (prompt && /^true$/i.test(process.env.MESHY_USE_TEXTURE_PROMPT ?? 'true')) payload.texture_prompt = prompt;

    // Try OpenAPI v1, then legacy v2 as fallback
    const endpoints = [
      `${API_BASE_IMAGE}/image-to-3d`,
      'https://api.meshy.ai/v2/image-to-3d'
    ];

    let lastErr;
    for (const url of endpoints) {
      try {
        const { data } = await axios.post(url, payload, { headers: headers() });
        const taskId = data?.result || data?.id || data?.task_id || data?.taskId;
        if (!taskId) {
          console.error('[meshy.submitImage] Unexpected response format:', safePreview(data));
          throw new Error('Meshy: Failed to create task (unexpected response). Check server logs.');
        }
        return taskId;
      } catch (err) {
        lastErr = err;
        if (err?.response?.status !== 404) break; // only fall through on 404
      }
    }
    throw lastErr || new Error('Meshy: image-to-3d submission failed');
  },

  async checkStatus(taskId) {
    if (!taskId) {
      throw new Error('Meshy: checkStatus called without a taskId');
    }
    // According to docs, use /openapi/v2/text-to-3d/:id; image path mirrored if needed
    const tryPaths = [
      `${API_BASE_TEXT}/text-to-3d/${taskId}`,
      `${API_BASE_IMAGE}/image-to-3d/${taskId}`
    ];
    let lastErr;
    for (const url of tryPaths) {
      try {
        const { data } = await axios.get(url, { headers: headers() });
        const status = (data.status || data.state || '').toString().toUpperCase() || 'UNKNOWN';
        // Prefer GLB URL from model_urls
        const modelUrl = data.model_urls?.glb || data.output?.model_url || data.model_url || null;
        const error = data.task_error?.message || data.error || data.message || null;
        const progress = typeof data.progress === 'number' ? data.progress : Number(data.progress ?? 0);
        const precedingTasks = typeof data.preceding_tasks === 'number' ? data.preceding_tasks : Number(data.preceding_tasks ?? 0);
        const thumbnailUrl = data.thumbnail_url || null;
        return { status, modelUrl, error, progress, precedingTasks, thumbnailUrl };
      } catch (err) {
        lastErr = err;
        const is404 = err?.response?.status === 404;
        // If image-by-id is not supported in this API version, try list-and-search
        const isImageIdUrl = url.includes('/image-to-3d/');
        if (is404 && isImageIdUrl) {
          try {
            const found = await findImageTaskFromList(taskId);
            if (found) {
              const status = (found.status || found.state || '').toString().toUpperCase() || 'UNKNOWN';
              const modelUrl = found.model_urls?.glb || found.output?.model_url || found.model_url || null;
              const error = found.task_error?.message || found.error || found.message || null;
              const progress = typeof found.progress === 'number' ? found.progress : Number(found.progress ?? 0);
              const precedingTasks = typeof found.preceding_tasks === 'number' ? found.preceding_tasks : Number(found.preceding_tasks ?? 0);
              const thumbnailUrl = found.thumbnail_url || null;
              return { status, modelUrl, error, progress, precedingTasks, thumbnailUrl };
            }
          } catch (e) {
            // Preserve original error if list fallback also fails
            lastErr = e;
          }
        }
        if (!is404) break; // Only continue loop on 404
      }
    }
    // If we reach here, all attempts failed
    throw lastErr || new Error('Meshy: Failed to fetch task status');
  },

  async downloadModel(url, jobId) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const modelsDir = path.join(__dirname, '../../storage/models');
    await fs.ensureDir(modelsDir);

    const ext = url.toLowerCase().includes('.gltf') ? 'gltf' : 'glb';
    const fileName = `${jobId}.${ext}`;
    const filePath = path.join(modelsDir, fileName);

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    await fs.writeFile(filePath, Buffer.from(response.data));
    return { filePath, fileName };
  }
};

// Simple provider-level rate limiter (token bucket)
const rps = Number(process.env.RATE_LIMIT_RPS || 2);
let tokens = rps;
setInterval(() => { tokens = rps; }, 1000);
async function takeToken() {
  while (tokens <= 0) {
    await new Promise(r => setTimeout(r, 50));
  }
  tokens--;
}

// Wrap submission methods to respect limiter
const origSubmitText = meshyProvider.submitText;
meshyProvider.submitText = async (...args) => { await takeToken(); return origSubmitText.apply(meshyProvider, args); };
const origSubmitImage = meshyProvider.submitImage;
meshyProvider.submitImage = async (...args) => { await takeToken(); return origSubmitImage.apply(meshyProvider, args); };

function safePreview(obj) {
  try {
    const json = JSON.stringify(obj);
    return json.length > 500 ? json.slice(0, 500) + '…' : json;
  } catch {
    return String(obj);
  }
}

// Fallback: list-and-search image-to-3d tasks when GET by id is unavailable
async function findImageTaskFromList(taskId) {
  // Try first up to 3 pages of newest tasks
  const maxPages = 3;
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ page_num: String(page), page_size: '50', sort_by: '-created_at' });
    const url = `${API_BASE_IMAGE}/image-to-3d?${params.toString()}`;
    const { data } = await axios.get(url, { headers: headers() });
    if (Array.isArray(data)) {
      const match = data.find(item => item?.id === taskId);
      if (match) return match;
      if (data.length < 50) break; // no more pages
    } else {
      // Unexpected shape; stop to avoid spamming
      break;
    }
  }
  return null;
}
