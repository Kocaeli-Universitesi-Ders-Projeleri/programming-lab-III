import { createHash } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import { Application, Document } from '../models/application.js';
import { StudentProfile } from '../models/auth.js';
import { DocumentExtraction } from '../models/DocumentExtraction.js';
import { StudentReferenceRecord } from '../models/StudentReferenceRecord.js';
import { ComparisonReport } from '../models/ComparisonReport.js';
import { DocumentComparisonService } from './DocumentComparisonService.js';
import { HttpError } from '../utils/httpError.js';
import type { ComparisonResponse, DocumentExtractionResult } from '@kou/shared';
const ENGINE_VERSION = '1.0.0';
function ordered(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered((value as Record<string, unknown>)[key])]));
  return value;
}
export const sourceHash = (value: unknown) => createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex');
export async function loadComparisonSources(id: string, session?: ClientSession) {
  const application = await Application.findOne({ _id: id, deletedAt: null }).session(session ?? null).lean();
  if (!application) throw new HttpError(404, 'Başvuru bulunamadı.');
  // Keep transaction reads sequential. Reference selection is account-anchored, never form-anchored.
  const profile = await StudentProfile.findOne({ user: application.student }).select('studentNumber').session(session ?? null).lean();
  const document = await Document.findById(application.document).session(session ?? null).lean();
  const extraction = await DocumentExtraction.findOne({ documentId: application.document }).session(session ?? null).lean();
  const candidates = profile ? await StudentReferenceRecord.find({ studentNumber: profile.studentNumber }).select('+identityNumber +dateOfBirth +residenceAddress +healthCoverageStatus').sort({ version: -1 }).limit(2).session(session ?? null).lean() : [];
  const referenceAmbiguous = candidates.length > 1 && candidates[0]!.version === candidates[1]!.version;
  const reference = referenceAmbiguous ? null : candidates[0] ?? null;
  const extractionAligned = Boolean(extraction && document && extraction.documentHash === document.sha256 && extraction.documentVersion === application.documentVersion);
  const sourceVersions = { formVersion: application.formVersion ?? 1, formHash: sourceHash(application.data),
    documentId: String(application.document), documentVersion: application.documentVersion, documentHash: document?.sha256 ?? null,
    extractionId: extraction ? String(extraction._id) : null, extractionHash: sourceHash(extraction ? { fields: extraction.extractedFields, status: extraction.status, template: extraction.templateVersion, templateVerified: extraction.templateVerified, extractorName: extraction.extractorName, extractorVersion: extraction.extractorVersion, documentHash: extraction.documentHash, documentVersion: extraction.documentVersion, updatedAt: extraction.updatedAt } : null),
    referenceId: reference ? String(reference._id) : null, referenceVersion: reference?.version ?? null, referenceHash: sourceHash(reference ? { ...reference, _id: String(reference._id), importBatchId: String(reference.importBatchId), createdBy: String(reference.createdBy) } : null),
    anchorStudentNumber: profile?.studentNumber ?? null, referenceAmbiguous, extractionAligned };
  const sourceFingerprint = sourceHash({ engine: ENGINE_VERSION, ...sourceVersions });
  return { application, sourceVersions, sourceFingerprint, input: { manual: application.data as Record<string, unknown>, extraction: extractionAligned ? extraction as unknown as DocumentExtractionResult : null, reference: reference as Record<string, unknown> | null, referenceAmbiguous } };
}
export async function generateComparison(id: string, session: ClientSession) {
  const sources = await loadComparisonSources(id, session), result = new DocumentComparisonService().compare(sources.input);
  await ComparisonReport.updateOne({ application: id, sourceFingerprint: sources.sourceFingerprint }, { $setOnInsert: { ...result, application: id, sourceFingerprint: sources.sourceFingerprint, sourceVersions: sources.sourceVersions, engineVersion: ENGINE_VERSION } }, { upsert: true, session, runValidators: true });
  return sources;
}
export async function readComparison(id: string, session?: ClientSession): Promise<ComparisonResponse> {
  const sources = await loadComparisonSources(id, session);
  const current = await ComparisonReport.findOne({ application: id, sourceFingerprint: sources.sourceFingerprint }).session(session ?? null).lean();
  const report = current ?? await ComparisonReport.findOne({ application: id }).sort({ createdAt: -1, _id: -1 }).session(session ?? null).lean();
  return { state: current ? 'CURRENT' : report ? 'STALE' : 'NOT_GENERATED', sourceFingerprint: sources.sourceFingerprint, sourceVersions: sources.sourceVersions,
    approvalEligible: Boolean(current && (current.fullyMatched || current.manualReview?.reason)), report: report as unknown as ComparisonResponse['report'] };
}
export async function requireCurrentComparison(id: string, session: ClientSession) {
  const report = await readComparison(id, session);
  if (!report.approvalEligible) throw new HttpError(409, report.state === 'CURRENT' ? 'Karşılaştırma belirsizlikleri için gerekçeli komisyon incelemesi kaydedilmeli.' : 'Karşılaştırma raporu yok veya güncel değil. Yeniden karşılaştırın ve komisyon incelemesini tamamlayın.');
}
