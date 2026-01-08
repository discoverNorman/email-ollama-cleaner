import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';

import { config } from './config.js';
import { initDb, getSetting } from './db/index.js';
import { api } from './routes/api.js';
import { queueManager } from './services/queue-worker.js';

const app = new Hono();

app.use('*', cors());

app.route('/api', api);

app.use('/assets/*', serveStatic({ root: './dist' }));
app.get('*', serveStatic({ root: './dist', path: 'index.html' }));

initDb();

// Start queue workers if enabled
const queueEnabled = getSetting('queue_enabled') === 'true';
if (queueEnabled) {
  queueManager.start();
}

console.log(`Server running on http://localhost:${config.app.port}`);

serve({
  fetch: app.fetch,
  port: config.app.port,
});

export default app;
