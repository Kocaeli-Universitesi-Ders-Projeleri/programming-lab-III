import pino from 'pino';
export const httpLogOptions = { wrapSerializers: false, serializers: { req: (req: { id?: unknown; method?: string }) => ({ id: req.id, method: req.method }), res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }) } };
export const logger = pino({ redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-csrf-token"]', 'res.headers["set-cookie"]', 'password', 'MONGODB_URI'] });
