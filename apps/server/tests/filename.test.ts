import { expect, it } from 'vitest';
import { safeFilename } from '../src/services/filename.js';

it('preserves Turkish multipart names and removes paths and deceptive controls', () => {
  const name = 'Türkçe-İğüşöç.png';
  expect(safeFilename(Buffer.from(name, 'utf8').toString('latin1'))).toBe(name);
  expect(safeFilename(name)).toBe(name);
  expect(safeFilename('../../C:\\private\\ek16\u202e.pdf')).toBe('ek16.pdf');
  expect(safeFilename('café.pdf')).toBe('café.pdf');
});
