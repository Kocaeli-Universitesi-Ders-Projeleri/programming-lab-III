import { Schema, model } from 'mongoose';
const schema = new Schema({
  application: { type: Schema.Types.ObjectId, ref: 'InternshipApplication', required: true, index: true },
  fromVersion: { type: Number, required: true }, toVersion: { type: Number, required: true },
  operation: { type: String, enum: ['UPDATE', 'SOFT_DELETE'], required: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true }, reason: { type: String, required: true, maxlength: 1000 },
  before: { type: Schema.Types.Mixed, required: true, select: false }, after: { type: Schema.Types.Mixed, required: true, select: false },
}, { timestamps: true });
schema.index({ application: 1, fromVersion: 1 }, { unique: true });
export const ApplicationRevision = model('ApplicationRevision', schema);
