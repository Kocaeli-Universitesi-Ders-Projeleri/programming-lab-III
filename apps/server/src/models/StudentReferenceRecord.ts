import { Schema, model } from 'mongoose';

// Append-only imports: an account/profile is never a reference record.
const referenceSchema = new Schema({
  studentNumber: { type: String, required: true, trim: true },
  fullName: { type: String, required: true },
  identityNumber: { type: String, required: true, select: false },
  nationality: { type: String, required: true },
  dateOfBirth: { type: String, required: true, select: false },
  residenceAddress: { type: String, required: true, select: false },
  department: { type: String, required: true },
  academicYear: { type: String, required: true },
  previousInternshipDays: { type: Number, required: true, min: 0 },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  healthCoverageStatus: { type: Number, required: true, min: 1, max: 6, select: false },
  importBatchId: { type: Schema.Types.ObjectId, ref: 'ImportBatch', required: true },
  sourceFileName: { type: String, required: true },
  sourceRowNumber: { type: Number, required: true, min: 2 },
  version: { type: Number, required: true, min: 1 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
referenceSchema.index({ studentNumber: 1, version: -1 }, { unique: true });
referenceSchema.index({ importBatchId: 1 });
export const StudentReferenceRecord = model('StudentReferenceRecord', referenceSchema);
