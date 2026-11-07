import { countInternshipDays, dateValue, type ApplicationValidationReport } from '@kou/shared';
import { ValidationRule, asText, type ValidationContext } from './ValidationRule.js';
import { AcademicYearValidationRule, AddressValidationRule, ContactValidationRule, DateValidationRule, EmployerValidationRule, EngineerValidationRule, IdentityValidationRule, InternshipDaysValidationRule, ManualSignatureRule, SchemaValidationRule, StudentMatchingRule } from './rules.js';
export const ENGINE_VERSION = '1.0.0';
export class ValidationEngine {
  readonly #rules: readonly ValidationRule[];
  constructor(rules: readonly ValidationRule[] = [new SchemaValidationRule(), new StudentMatchingRule(), new IdentityValidationRule(), new ContactValidationRule(), new AddressValidationRule(), new DateValidationRule(), new AcademicYearValidationRule(), new InternshipDaysValidationRule(), new EngineerValidationRule(), new EmployerValidationRule(), new ManualSignatureRule()]) { this.#rules = rules; }
  validate(context: ValidationContext): ApplicationValidationReport {
    // Polymorphism: each concrete rule is invoked through the same abstract contract.
    const results = this.#rules.flatMap(rule => rule.validate(context));
    const issues = results.filter(r => !r.valid && r.severity === 'error').map(r => r.message);
    const warnings = results.filter(r => r.severity === 'warning').map(r => r.message);
    warnings.push('Form bilgileri öğrenci tarafından girildi. Belgeyle eşleşme, imza ve kaşe otomatik tanınmaz; komisyon orijinal belgeyle karşılaştırmalıdır.');
    const pending = results.filter(r => r.severity === 'pending').map(r => r.message);
    const automatic = results.filter(r => !r.ruleCode.startsWith('MANUAL_'));
    const automatedPassed = automatic.length > 0 && !automatic.some(r => !r.valid && r.severity === 'error');
    const checks = context.manualChecks;
    const manualPassed = checks?.employerSignature === true && checks?.employerStamp === true && checks?.studentApprovalEmpty === true && checks?.advisorApprovalEmpty === true;
    const start = dateValue(asText(context.application.startDate));
    const count = countInternshipDays(asText(context.application.startDate), asText(context.application.endDate), Array.isArray(context.application.workingDays) ? context.application.workingDays : []);
    return { engineVersion: ENGINE_VERSION, engineComplete: true, automatedPassed, readyForApproval: automatedPassed && manualPassed && !issues.length && !pending.length, calculatedDays: count.days, latestSubmissionDate: Number.isFinite(start) ? new Date(start - 30 * 86400000).toISOString().slice(0,10) : null, results, issues, warnings, pending, suggestions: [...new Set(results.filter(r => !r.valid && r.suggestion).map(r => r.suggestion!))], summary: { passed: results.filter(r => r.valid && r.severity !== 'warning').length, errors: issues.length, warnings: warnings.length, pending: pending.length } };
  }
}
