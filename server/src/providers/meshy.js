import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

const API_BASE = process.env.MESHY_API_BASE || 'https://api.meshy.ai/v2';
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
    // Meshy text-to-3d endpoint (example structure, may need adjustments based on latest docs)
    const { data } = await axios.post(
      `${API_BASE}/text-to-3d`,
      { prompt, mode: 'auto' },
      { headers: headers() }
    );
    return data.task_id || data.id;
  },

  async submitImage(buffer, mimeType, prompt) {
    // Create a multipart form request
    const form = new FormData();
    form.append('image', buffer, { filename: 'input', contentType: mimeType || 'image/jpeg' });
    if (prompt) form.append('prompt', prompt);

    const { data } = await axios.post(`${API_BASE}/image-to-3d`, form, {
      headers: { Authorization: `Bearer ${KEY}`, ...form.getHeaders() }
    });
    return data.task_id || data.id;
  },

  async checkStatus(taskId) {
    const { data } = await axios.get(`${API_BASE}/tasks/${taskId}`, { headers: headers() });
    // Normalize
    return {
      status: data.status?.toUpperCase() || 'UNKNOWN',
      modelUrl: data.output?.model_url || data.model_url || null,
      error: data.error || null
    };
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
