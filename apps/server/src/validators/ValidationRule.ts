import type { ApplicationInput, ManualChecks, RuleResult } from '@kou/shared';
import type { ValidationOptions } from '../config/validation.js';
export interface ValidationStudent {
  name?: string | null;
  studentNumber?: string | null;
  identityNumber?: string | null;
  nationality?: string | null;
  department?: string | null;
  birthDate?: string | null;
}
export interface ValidationContext {
  policy?: 'VIZE' | 'FINAL';
  application: ApplicationInput;
  student: ValidationStudent;
  manualChecks?: Partial<ManualChecks> | null;
  options: ValidationOptions;
  today: string;
}
export function asText(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
export function normalized(value: unknown) { return asText(value).normalize('NFKC').replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR'); }
export function nationality(value: unknown) { const v = normalized(value); return ['TR', 'TC', 'T.C.', 'TÜRKİYE', 'TÜRK', 'TURKEY'].includes(v) ? 'TR' : v; }
export abstract class ValidationRule {
  abstract validate(context: ValidationContext): RuleResult[];
  protected result(ruleCode: string, category: string, field: string, valid: boolean, message: string, suggestion?: string, kind: RuleResult['kind'] = 'invalid', severity: RuleResult['severity'] = 'error'): RuleResult {
    return { ruleCode, category, field, valid, message, suggestion: valid ? undefined : suggestion, kind: valid ? 'passed' : kind, severity: valid ? 'info' : severity };
  }
  protected notice(ruleCode: string, category: string, message: string): RuleResult { return { ruleCode, category, field: '', valid: true, severity: 'warning', kind: 'notice', message }; }
}
