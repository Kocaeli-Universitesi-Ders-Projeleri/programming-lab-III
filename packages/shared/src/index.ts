export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  database: 'connected' | 'disconnected' | 'connecting';
  timestamp: string;
  version: string;
}
export * from './internship.js';
export * from './application.js';
export * from './validation.js';
