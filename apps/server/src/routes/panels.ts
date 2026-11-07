import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { AuditLog, StudentProfile, User } from '../models/auth.js';
import { Application } from '../models/application.js';
export const panelRoutes = Router();
panelRoutes.use('/admin', authenticate, authorize('ROLE_ADMIN'));
panelRoutes.get('/admin/dashboard/stats', async (_req, res) => {
  const [students, lastStudents, recentEvents, applications, statusCounts, lastApplications] = await Promise.all([
    StudentProfile.countDocuments(),
    StudentProfile.find().select('studentNumber department nationality phone academicYear user').sort({ createdAt: -1 }).limit(5).populate('user', 'name email').lean(),
    AuditLog.find({ event: { $in: ['LOGIN_SUCCESS', 'LOGOUT'] } }).select('event createdAt user').sort({ createdAt: -1 }).limit(5).populate('user', 'name').lean(),
    Application.countDocuments(),
    Application.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Application.find().sort({ createdAt: -1 }).limit(5).select('number status createdAt').lean(),
  ]);
  res.json({ students, applications, applicationModuleReady: true, lastStudents, recentEvents, statusCounts, lastApplications });
});
panelRoutes.get('/admin/students', async (req, res) => {
  const parsed = z.object({ q: z.string().trim().max(100).default(''), page: z.coerce.number().int().min(1).max(100000).default(1), department: z.string().max(100).default('') }).safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ message: 'Arama veya sayfa bilgisi geçersiz.' }); return; }
  const { q, page, department } = parsed.data;
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const search = new RegExp(escape(q), 'i');
  const users = q ? await User.find({ role: 'ROLE_STUDENT', $or: [{ name: search }, { email: search }] }).select('_id').lean() : [];
  const filter = { ...(department ? { department } : {}), ...(q ? { $or: [{ studentNumber: search }, { user: { $in: users.map(u => u._id) } }] } : {}) };
  const [items, total, departments] = await Promise.all([
    StudentProfile.find(filter).select('studentNumber department nationality phone academicYear user').sort({ studentNumber: 1 }).skip((page - 1) * 10).limit(10).populate('user', 'name email').lean(),
    StudentProfile.countDocuments(filter), StudentProfile.distinct('department'),
  ]);
  res.json({ items, total, page, pageSize: 10, departments });
});
