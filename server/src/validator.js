import fs from 'fs-extra';
import { validateBytes } from 'gltf-validator';

export async function evaluateModel(filePath) {
  const bytes = await fs.readFile(filePath);
  const result = await validateBytes(new Uint8Array(bytes), {
    externalResourceFunction: (uri) => Promise.resolve(null),
    uri: filePath
  });

  const errors = result.issues?.numErrors || 0;
  const warnings = result.issues?.numWarnings || 0;
  const infos = result.issues?.numInfos || 0;
  const hasMaterials = (result.info?.materials || 0) > 0;
  const hasImages = (result.info?.images || 0) > 0;
  const score = Math.max(0, 100 - errors * 30 - warnings * 5);

  return {
    validator: { errors, warnings, infos },
    content: {
      materials: result.info?.materials || 0,
      meshes: result.info?.meshes || 0,
      images: result.info?.images || 0,
      animations: result.info?.animations || 0
    },
    file: { sizeBytes: bytes.length, format: filePath.endsWith('.gltf') ? 'gltf' : 'glb' },
    simpleScore: score,
    checks: {
      hasMaterials,
      hasImages
    }
  };
}
