import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { router as apiRouter } from './routes/api.js';

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

const port = process.env.PORT || 5001;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
