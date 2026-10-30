import { Buffer } from 'node:buffer';

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapPdfText(text: string): string[] {
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 80) {
    let splitAt = remaining.lastIndexOf(' ', 80);
    if (splitAt < 1) splitAt = 80;
    lines.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) lines.push(remaining);
  return lines;
}

function buildPdf(objects: Buffer[]): Buffer {
  const parts: Buffer[] = [Buffer.from('%PDF-1.7\n', 'ascii')];
  const offsets = [0];
  let length = parts[0].length;

  objects.forEach((object, index) => {
    offsets.push(length);
    const header = Buffer.from(`${index + 1} 0 obj\n`, 'ascii');
    const footer = Buffer.from('\nendobj\n', 'ascii');
    parts.push(header, object, footer);
    length += header.length + object.length + footer.length;
  });

  const xrefOffset = length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map(offset => `${offset.toString().padStart(10, '0')} 00000 n \n`),
  ].join('');
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xref + trailer, 'ascii'));
  return Buffer.concat(parts);
}

export function createTextPdf(pageTexts: string[]): Buffer {
  const objects: Buffer[] = [];
  const firstPageId = 3;
  const fontId = firstPageId + pageTexts.length * 2;
  const pageIds = pageTexts.map((_, index) => firstPageId + index * 2);

  objects.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'));
  objects.push(
    Buffer.from(
      `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`,
      'ascii'
    )
  );

  pageTexts.forEach((text, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const textContent = wrapPdfText(text)
      .map(line => `(${escapePdfText(line)}) Tj 0 -14 Td`)
      .join(' ');
    const content = Buffer.from(`BT /F1 12 Tf 36 750 Td ${textContent} ET`, 'ascii');
    objects.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
        'ascii'
      )
    );
    objects.push(
      Buffer.concat([
        Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'ascii'),
        content,
        Buffer.from('\nendstream', 'ascii'),
      ])
    );
  });

  objects.push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'ascii'));
  return buildPdf(objects);
}

export function createImageOnlyPdf(): Buffer {
  const image = Buffer.from([255, 255, 255]);
  const content = Buffer.from('q 100 0 0 100 0 0 cm /Im0 Do Q', 'ascii');
  return buildPdf([
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'ascii'),
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
      'ascii'
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'ascii'),
      content,
      Buffer.from('\nendstream', 'ascii'),
    ]),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${image.length} >>\nstream\n`,
        'ascii'
      ),
      image,
      Buffer.from('\nendstream', 'ascii'),
    ]),
  ]);
}
