import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { router as apiRouter } from './routes/api.js';
import { getJob } from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Serve static models
const modelsDir = path.join(__dirname, '../storage/models');
app.use('/files', express.static(modelsDir));

app.use('/api', apiRouter);

// Lightweight preview page for models
app.get('/view/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job || !job.fileUrl) {
    res.status(404).send('Not found');
    return;
  }
  const title = job.prompt ? `Preview — ${job.prompt}` : '3D Preview';
  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <style>
        body{margin:0;font-family:system-ui, sans-serif;background:#111;color:#eee}
        header{padding:10px 14px;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center}
        main{height:calc(100vh - 50px)}
        .mv{width:100%;height:100%;background:#111}
        a{color:#76a9fa}
      </style>
      <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
    </head>
    <body>
      <header>
        <div>${title}</div>
        <nav>
          <a href="${job.fileUrl}" download>Download</a>
        </nav>
      </header>
      <main>
        <model-viewer src="${job.fileUrl}" camera-controls auto-rotate class="mv"></model-viewer>
      </main>
    </body>
  </html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

const port = process.env.PORT || 5001;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
