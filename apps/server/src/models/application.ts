import { Schema, model } from 'mongoose';
export const Application = model('InternshipApplication', new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  number: { type: String, required: true, unique: true },
  status: { type: String, enum: ['UPLOADED', 'UNDER_REVIEW', 'INVALID', 'APPROVED', 'COMPLETED'], default: 'UPLOADED', index: true },
  data: { type: Schema.Types.Mixed, required: true },
  calculatedDays: { type: Number, default: null },
  document: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
  version: { type: Number, default: 1 },
  documentVersion: { type: Number, default: 1 },
  manualChecks: { type: Schema.Types.Mixed, default: null },
  history: [{ status: String, actor: { type: Schema.Types.ObjectId, ref: 'User' }, note: String, at: Date }],
}, { timestamps: true }));
export const Document = model('Document', new Schema({
  application: { type: Schema.Types.ObjectId, ref: 'InternshipApplication', required: true, index: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  originalName: { type: String, required: true },
  storageKey: { type: String, required: true, select: false },
  mime: { type: String, required: true }, size: Number, sha256: String,
}, { timestamps: true }));
export const ValidationReport = model('ValidationReport', new Schema({
  application: { type: Schema.Types.ObjectId, ref: 'InternshipApplication', required: true, unique: true },
  engineComplete: { type: Boolean, default: false },
  engineVersion: String,
  automatedPassed: { type: Boolean, default: false },
  readyForApproval: { type: Boolean, default: false },
  latestSubmissionDate: String,
  results: [{ _id: false, ruleCode: String, category: String, field: String, valid: Boolean, severity: String, kind: String, message: String, suggestion: String }],
  pending: [String], suggestions: [String],
  summary: { passed: Number, errors: Number, warnings: Number, pending: Number },
  calculatedDays: { type: Number, default: null },
  issues: [String], warnings: [String],
}, { timestamps: true }));
