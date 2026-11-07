import { countInternshipDays, dateValue, type ApplicationValidationReport } from '@kou/shared';
import { ValidationRule, asText, type ValidationContext } from './ValidationRule.js';
import { AcademicYearValidationRule, AddressValidationRule, ContactValidationRule, DateValidationRule, EmployerValidationRule, EngineerValidationRule, IdentityValidationRule, InternshipDaysValidationRule, ManualSignatureRule, SchemaValidationRule, StudentMatchingRule } from './rules.js';
export const ENGINE_VERSION = '1.1.0';
export class ValidationEngine {
  readonly #rules: readonly ValidationRule[];
  constructor(rules: readonly ValidationRule[] = [new SchemaValidationRule(), new StudentMatchingRule(), new IdentityValidationRule(), new ContactValidationRule(), new AddressValidationRule(), new DateValidationRule(), new AcademicYearValidationRule(), new InternshipDaysValidationRule(), new EngineerValidationRule(), new EmployerValidationRule(), new ManualSignatureRule()]) { this.#rules = rules; }
  validate(context: ValidationContext): ApplicationValidationReport {
    // Polymorphism: each concrete rule is invoked through the same abstract contract.
    const policy = context.policy ?? 'FINAL';
    const results = this.#rules.flatMap(rule => rule.validate(context)).map(result => {
      const blocking = policy === 'FINAL' || result.ruleCode === 'SCHEMA' || result.ruleCode.startsWith('SCHEMA_') || result.ruleCode.startsWith('MANUAL_');
      return !blocking && !result.valid && result.severity === 'error' ? { ...result, blocking, severity: 'warning' as const, message: 'VIZE bilgilendirme: ' + result.message } : { ...result, blocking };
    });
    const issues = results.filter(r => !r.valid && r.severity === 'error').map(r => r.message);
    const warnings = results.filter(r => r.severity === 'warning').map(r => r.message);
    warnings.push('Form beyanı, belge çıkarımı ve referans karşılaştırması ayrı raporda gösterilir. İmza ve kaşe otomatik tanınmaz; komisyon orijinal belgeyi incelemelidir.');
    const pending = results.filter(r => r.severity === 'pending').map(r => r.message);
    const automatic = results.filter(r => !r.ruleCode.startsWith('MANUAL_'));
    const automatedPassed = automatic.length > 0 && !automatic.some(r => !r.valid && r.severity === 'error');
    const checks = context.manualChecks;
    const manualPassed = checks?.employerSignature === true && checks?.employerStamp === true && checks?.studentApprovalEmpty === true && checks?.advisorApprovalEmpty === true;
    const start = dateValue(asText(context.application.startDate));
    const count = countInternshipDays(asText(context.application.startDate), asText(context.application.endDate), Array.isArray(context.application.workingDays) ? context.application.workingDays : []);
    return { policy, engineVersion: ENGINE_VERSION, engineComplete: true, automatedPassed, readyForApproval: automatedPassed && manualPassed && !issues.length && !pending.length, calculatedDays: count.days, latestSubmissionDate: Number.isFinite(start) ? new Date(start - 30 * 86400000).toISOString().slice(0,10) : null, results, issues, warnings, pending, suggestions: [...new Set(results.filter(r => !r.valid && r.suggestion).map(r => r.suggestion!))], summary: { passed: results.filter(r => r.valid && r.severity !== 'warning').length, errors: issues.length, warnings: warnings.length, pending: pending.length } };
  }
}
