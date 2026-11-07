import { expect, it } from 'vitest';
import { ValidationEngine } from '../src/validators/ValidationEngine.js';
import { validationFixture, positiveManualChecks } from './fixtures/validation.js';
it('aynı ileri kural hatalarını FINAL engellerken VIZE yalnız bilgilendirir', () => {
  const context = validationFixture(); context.manualChecks = positiveManualChecks;
  context.application.engineerCount = 0; context.application.neighborhood = ''; context.application.declaredDays = 1;
  context.application.startDate = '2028-07-01'; context.application.endDate = '2028-07-31';
  const final = new ValidationEngine().validate({ ...context, policy: 'FINAL' });
  const vize = new ValidationEngine().validate({ ...context, policy: 'VIZE' });
  expect(final.readyForApproval).toBe(false); expect(vize.readyForApproval).toBe(true); expect(vize.policy).toBe('VIZE');
  expect(vize.results.find(result => result.ruleCode === 'ENGINEER_COUNT')).toMatchObject({ valid: false, severity: 'warning', blocking: false });
  expect(vize.calculatedDays).toBeNull(); expect(vize.summary.errors).toBe(0); expect(vize.warnings.length).toBeGreaterThan(0);
});
it('VIZE temel form ve kaydedilmiş manuel kontroller olmadan onaya uygun sayılmaz', () => {
  const context = validationFixture();
  expect(new ValidationEngine().validate({ ...context, policy: 'VIZE' }).readyForApproval).toBe(false);
  context.manualChecks = positiveManualChecks; context.application.companyName = '';
  expect(new ValidationEngine().validate({ ...context, policy: 'VIZE' }).readyForApproval).toBe(false);
});
