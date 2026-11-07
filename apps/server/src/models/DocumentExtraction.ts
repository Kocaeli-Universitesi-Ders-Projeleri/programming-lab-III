import { Schema, model } from 'mongoose';
const field = new Schema({ fieldName: String, rawValue: String, normalizedValue: { type: String, default: null }, sourceLocation: { type: Schema.Types.Mixed, default: null }, extractionStatus: { type: String, enum: ['EXTRACTED', 'MISSING', 'AMBIGUOUS', 'INVALID'] } }, { _id: false });
export const DocumentExtraction = model('DocumentExtraction', new Schema({
  documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, unique: true },
  documentVersion: { type: Number, required: true }, documentHash: { type: String, required: true },
  extractorName: { type: String, required: true }, extractorVersion: { type: String, required: true },
  templateVersion: { type: String, required: true }, templateVerified: { type: Boolean, required: true },
  status: { type: String, enum: ['EXTRACTED', 'PARTIAL', 'EXTRACTION_UNAVAILABLE', 'FAILED'], required: true },
  rawText: { type: String, maxlength: 500000, select: false },
  extractedFields: [field], fieldSources: { type: [Schema.Types.Mixed], select: false }, extractionErrors: [String],
}, { timestamps: true }));
