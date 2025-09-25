import 'dotenv/config';

const name = (process.env.PROVIDER || 'meshy').toLowerCase();

let provider;
if (name === 'mock') {
  const mod = await import('./mock.js');
  provider = mod.mockProvider;
  console.log('[provider] Using MOCK provider');
} else {
  const mod = await import('./meshy.js');
  provider = mod.meshyProvider;
  console.log('[provider] Using MESHY provider');
}

export { provider };
