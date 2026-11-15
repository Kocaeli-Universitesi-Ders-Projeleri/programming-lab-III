import { Schema, model } from 'mongoose';
const userSchema = new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['ROLE_ADMIN', 'ROLE_STUDENT'], required: true },
  active: { type: Boolean, default: true },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
}, { timestamps: true });
export const User = model('User', userSchema);
export const StudentProfile = model('StudentProfile', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  studentNumber: { type: String, required: true, unique: true },
  department: { type: String },
  nationality: String,
  phone: String,
  academicYear: String,
  identityNumber: { type: String, select: false, index: { unique: true, partialFilterExpression: { identityNumber: { $type: 'string' } } } },
  birthDate: { type: String, select: false },
  address: { type: String, select: false },
  previousInternshipDays: { type: Number },
  healthStatus: { type: Number, min: 1, max: 6 },
  googleFormUrl: { type: String, default: null },
}, { timestamps: true }));
const sessionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});
export const Session = model('Session', sessionSchema);
export const AuditLog = model('AuditLog', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  event: { type: String, required: true },
  application: { type: Schema.Types.ObjectId, ref: 'InternshipApplication', index: true },
  details: Schema.Types.Mixed,
  ip: String,
}, { timestamps: true }));
