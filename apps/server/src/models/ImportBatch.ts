import { Schema, model } from 'mongoose';
const row = new Schema({ line: Number, data: Schema.Types.Mixed, issues: [String], referenceVersion: Number }, { _id: false });
export const ImportBatch = model('ImportBatch', new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  filename: String,
  // No default: legacy account-import batches must not become reference imports.
  purpose: { type: String, enum: ['REFERENCE'] },
  rows: { type: [row], required: true, select: false },
  status: { type: String, enum: ['PREVIEW', 'COMMITTED'], default: 'PREVIEW' },
  result: Schema.Types.Mixed,
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true }));
