import type { Express } from 'express';
import express from 'express';
import { fileURLToPath } from 'node:url';
export function serveClient(app: Express, directory = fileURLToPath(new URL('../../../client/dist', import.meta.url))) {
  app.use(express.static(directory, { index: false, dotfiles: 'deny', setHeaders: (res, filename) => { res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(filename) ? 'public, max-age=31536000, immutable' : 'no-cache'); } }));
  app.get(/\.[^/]+$/, (_req, res) => { res.status(404).json({ message: 'Dosya bulunamadı.' }); });
  app.get(/.*/, (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile('index.html', { root: directory }); });
}
