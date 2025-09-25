import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export const mockProvider = {
  async submitText(prompt) {
    // Return a fake task id
    return `mock-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  },
  async submitImage(buffer, mimeType, prompt) {
    return `mock-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  },
  async checkStatus(taskId) {
    // Pretend the task takes ~3-6 seconds
    await delay(1000 + Math.random()*1500);
    if (Math.random() < 0.05) return { status: 'FAILED', error: 'Mock random failure' };
    return { status: 'SUCCEEDED', modelUrl: 'mock://model' };
  },
  async downloadModel(url, jobId) {
    // Generate a tiny GLB (pre-baked) or write a trivial glTF
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const modelsDir = path.join(__dirname, '../../storage/models');
    await fs.ensureDir(modelsDir);

    const fileName = `${jobId}.gltf`;
    const filePath = path.join(modelsDir, fileName);
    const gltf = {
      asset: { version: '2.0', generator: 'mock-provider' },
      scenes: [{ nodes: [0] }],
      scene: 0,
      nodes: [{ mesh: 0, name: 'MockMesh' }],
      meshes: [{ name: 'MockMesh', primitives: [{ attributes: {}, indices: 0 }] }],
      accessors: [],
      bufferViews: [],
      buffers: []
    };
    await fs.writeJSON(filePath, gltf, { spaces: 2 });
    return { filePath, fileName };
  }
};
