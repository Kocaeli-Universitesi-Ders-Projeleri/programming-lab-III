import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { logger } from './config/logger.js';
const server = app.listen(env.PORT, env.LISTEN_HOST, () => logger.info({ port: env.PORT }, 'API çalışıyor'));
void connectDatabase();
async function shutdown() {
  server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
