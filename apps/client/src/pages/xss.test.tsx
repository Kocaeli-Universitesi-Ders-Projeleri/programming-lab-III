import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ValidationReportView } from './ValidationReportView';
afterEach(cleanup);
it('rapor alanındaki HTML/XSS metnini metin olarak gösterir', () => {
  const payload = '<img src=x onerror="window.xss=true">';
  const { container } = render(<ValidationReportView report={{ calculatedDays: 0, issues: [payload], results: [{ ruleCode:'XSS', category:'Test', field:'name', valid:false, severity:'error', kind:'invalid', message:payload, suggestion: '<script>alert(1)</script>' }], warnings:[] }}/>);
  expect(screen.getByText(payload, { exact:false })).toBeDefined(); expect(container.querySelector('img')).toBeNull(); expect(container.querySelector('script')).toBeNull();
});
