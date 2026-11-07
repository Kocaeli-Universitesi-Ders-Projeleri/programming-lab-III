import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
export const validationConfigSchema = z.object({
  policy: z.enum(['VIZE', 'FINAL']).optional(),
  validateTcChecksum: z.boolean(),
  // Explicit permitted internship windows. No university calendar is inferred.
  academicPeriods: z.record(z.string().regex(/^\d{4}-\d{4} (Güz|Bahar|Yaz)$/), z.object({ start: z.iso.date(), end: z.iso.date() }).refine(v => v.start <= v.end, 'Dönem başlangıcı bitişten sonra olamaz.')),
});
export type ValidationOptions = z.infer<typeof validationConfigSchema>;
export async function loadValidationOptions(): Promise<ValidationOptions> {
  const path = fileURLToPath(new URL('../../../../config/validation.json', import.meta.url));
  return validationConfigSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}
