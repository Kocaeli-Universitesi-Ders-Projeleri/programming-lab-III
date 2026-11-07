import type { ClientSession } from 'mongoose';
import { todayInTurkey, type ApplicationInput, type ManualChecks } from '@kou/shared';
import { User, StudentProfile } from '../models/auth.js';
import { loadValidationOptions } from '../config/validation.js';
import { ValidationEngine } from '../validators/ValidationEngine.js';
export async function buildApplicationReport(data: ApplicationInput, studentId: string, manualChecks?: Partial<ManualChecks> | null, session?: ClientSession) {
  // MongoDB transaction operations must not run in parallel on one session.
  const user = await User.findById(studentId).select('name').session(session ?? null).lean();
  const profile = await StudentProfile.findOne({ user: studentId }).select('+identityNumber +birthDate').session(session ?? null).lean();
  const options = await loadValidationOptions();
  return new ValidationEngine().validate({ policy: options.policy ?? 'VIZE', application: data, student: { name: user?.name, studentNumber: profile?.studentNumber, identityNumber: profile?.identityNumber, nationality: profile?.nationality, department: profile?.department, birthDate: profile?.birthDate }, options, manualChecks, today: todayInTurkey() });
}
