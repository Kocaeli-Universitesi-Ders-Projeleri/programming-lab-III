import * as CFB from 'cfb';
export const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function docxFixture(rows: string[][], merged = false) {
  const archive = CFB.utils.cfb_new();
  CFB.utils.cfb_add(archive, '[Content_Types].xml', Buffer.from('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
  const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>${rows.map((row, index) => `<w:tr>${row.map((cell, column) => `<w:tc>${merged && index === 0 && column === 0 ? '<w:tcPr><w:gridSpan w:val="2"/></w:tcPr>' : ''}<w:p><w:r><w:t>${escape(cell)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl></w:body></w:document>`;
  CFB.utils.cfb_add(archive, 'word/document.xml', Buffer.from(xml));
  return Buffer.from(CFB.write(archive, { type: 'buffer', fileType: 'zip' }));
}
// Minimal synthetic Word97 OLE container with one uncompressed Unicode piece.
// No external document, personal data, macro, executable or converter is used.
export function docFixture(text: string) {
  const archive = CFB.utils.cfb_new(), word = Buffer.alloc(Math.max(1024, 512 + text.length * 2)), table = Buffer.alloc(512);
  word.writeUInt16LE(0xa5ec, 0); word.writeUInt16LE(0xc1, 2); word.writeUInt16LE(0x200, 10);
  word.writeUInt32LE(512, 0x18); word.writeUInt32LE(text.length, 0x4c); word.writeUInt32LE(0, 0x1a2); word.writeUInt32LE(21, 0x1a6);
  Buffer.from(text, 'utf16le').copy(word, 512);
  table[0] = 2; table.writeUInt32LE(16, 1); table.writeUInt32LE(0, 5); table.writeUInt32LE(text.length, 9); table.writeUInt32LE(512, 15);
  CFB.utils.cfb_add(archive, 'WordDocument', word); CFB.utils.cfb_add(archive, '1Table', table);
  return Buffer.from(CFB.write(archive, { type: 'buffer' }));
}
