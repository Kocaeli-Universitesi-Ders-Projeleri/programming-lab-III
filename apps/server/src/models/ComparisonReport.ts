import { Schema, model } from 'mongoose';
const schema = new Schema({
  application: { type: Schema.Types.ObjectId, ref: 'InternshipApplication', required: true, index: true },
  sourceFingerprint: { type: String, required: true }, sourceVersions: { type: Schema.Types.Mixed, required: true },
  engineVersion: { type: String, required: true }, rows: { type: [Schema.Types.Mixed], required: true },
  fullyMatched: { type: Boolean, required: true }, requiresManualReview: { type: Boolean, required: true },
  summary: { type: Schema.Types.Mixed, required: true },
  manualReview: { type: new Schema({ reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true }, reason: { type: String, required: true, maxlength: 1000 }, reviewedAt: { type: Date, required: true } }, { _id: false }), default: null },
}, { timestamps: true });
schema.index({ application: 1, sourceFingerprint: 1 }, { unique: true });
export const ComparisonReport = model('ComparisonReport', schema);
