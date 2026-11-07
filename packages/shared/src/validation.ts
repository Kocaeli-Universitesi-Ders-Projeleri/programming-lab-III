export interface ManualChecks {
  employerSignature: boolean;
  employerStamp: boolean;
  studentApprovalEmpty: boolean;
  advisorApprovalEmpty: boolean;
}
export interface RuleResult {
  ruleCode: string;
  category: string;
  field: string;
  valid: boolean;
  severity: 'error' | 'warning' | 'info' | 'pending';
  kind: 'missing' | 'invalid' | 'mismatch' | 'pending' | 'passed' | 'notice';
  message: string;
  suggestion?: string;
}
export interface ApplicationValidationReport {
  engineVersion: string;
  engineComplete: boolean;
  automatedPassed: boolean;
  readyForApproval: boolean;
  calculatedDays: number | null;
  latestSubmissionDate: string | null;
  results: RuleResult[];
  issues: string[];
  warnings: string[];
  pending: string[];
  suggestions: string[];
  summary: { passed: number; errors: number; warnings: number; pending: number };
}
