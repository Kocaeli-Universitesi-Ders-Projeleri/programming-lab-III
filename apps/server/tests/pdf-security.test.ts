import { expect, it } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { checkDocument } from '../src/services/documentSafety.js';
it('PDF içindeki doğrudan iç içe Launch eylemini reddeder', async () => {
  const pdf = await PDFDocument.create(); const page = pdf.addPage();
  const action = pdf.context.obj({ Type: PDFName.of('Action'), S: PDFName.of('Launch'), F: 'synthetic-no-execution.txt' });
  const annotation = pdf.context.obj({ Type: PDFName.of('Annot'), Subtype: PDFName.of('Link'), Rect: [0,0,10,10], A: action });
  page.node.set(PDFName.of('Annots'), pdf.context.obj([annotation]));
  await expect(checkDocument(Buffer.from(await pdf.save()), 'audit.pdf', 'application/pdf')).rejects.toThrow();
});
