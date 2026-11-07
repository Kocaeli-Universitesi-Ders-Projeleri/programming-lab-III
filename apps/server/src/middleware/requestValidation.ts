import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
const empty = z.object({}).strict();
const list = z.object({ status: z.enum(['UPLOADED','UNDER_REVIEW','INVALID','APPROVED','COMPLETED']).optional(), page: z.string().regex(/^[1-9]\d{0,5}$/).optional() }).strict();
const students = z.object({ q: z.string().max(100).optional(), department: z.string().max(100).optional(), page: z.string().regex(/^[1-9]\d{0,5}$/).optional() }).strict();
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
export function validateQuery(req: Request, res: Response, next: NextFunction) {
  const schema = /^\/admin\/applications\/[a-f\d]{24}\/audit$/i.test(req.path) ? list.pick({ page: true }) : req.path === '/admin/students' ? students : req.path === '/admin/student-references' ? students.omit({ department: true }) : ['/students/me/applications', '/admin/applications', '/admin/applications/completed'].includes(req.path) ? list : empty;
  if (!schema.safeParse(req.query).success) { res.status(400).json({ message: 'Sorgu alanları veya değerleri geçersiz.' }); return; }
  next();
}
