export interface PdfSection {
  title: string;
  lines: string[];
}

interface PdfLine {
  text: string;
  fontSize: number;
  gapAfter?: number;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 44;
const TOP_Y = 804;
const BOTTOM_Y = 52;

function asciiBytes(value: string) {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0x7f;
  }

  return bytes;
}

function encodeWinAnsi(value: string) {
  const normalized = value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/•/g, '-');
  const bytes: number[] = [];

  for (const char of normalized) {
    const code = char.charCodeAt(0);
    bytes.push(code <= 255 ? code : 63);
  }

  return bytes;
}

function pdfStringBytes(value: string) {
  const bytes: number[] = [40];

  for (const byte of encodeWinAnsi(value)) {
    if (byte === 40 || byte === 41 || byte === 92) {
      bytes.push(92);
    }

    bytes.push(byte);
  }

  bytes.push(41);
  return new Uint8Array(bytes);
}

function concatBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function wrapText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return [text];
  }

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function buildLines(title: string, sections: PdfSection[]) {
  const lines: PdfLine[] = [
    { text: 'Fazenda Cria', fontSize: 11, gapAfter: 16 },
    { text: title, fontSize: 18, gapAfter: 18 },
  ];

  for (const section of sections) {
    lines.push({ text: section.title, fontSize: 13, gapAfter: 10 });

    if (section.lines.length === 0) {
      lines.push({ text: 'Nenhum registro encontrado.', fontSize: 10, gapAfter: 8 });
    } else {
      for (const line of section.lines) {
        for (const wrappedLine of wrapText(line, 96)) {
          lines.push({ text: wrappedLine, fontSize: 10, gapAfter: 4 });
        }
      }
    }

    lines.push({ text: '', fontSize: 10, gapAfter: 10 });
  }

  return lines;
}

function paginateLines(lines: PdfLine[]) {
  const pages: PdfLine[][] = [];
  let currentPage: PdfLine[] = [];
  let y = TOP_Y;

  for (const line of lines) {
    const lineHeight = line.fontSize + (line.gapAfter ?? 5);

    if (y - lineHeight < BOTTOM_Y && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      y = TOP_Y;
    }

    currentPage.push(line);
    y -= lineHeight;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function buildContentStream(lines: PdfLine[], pageNumber: number, totalPages: number) {
  const chunks: Uint8Array[] = [];
  let y = TOP_Y;

  for (const line of lines) {
    if (line.text) {
      chunks.push(
        asciiBytes(`BT /F1 ${line.fontSize} Tf 1 0 0 1 ${MARGIN_X} ${y.toFixed(1)} Tm `),
        pdfStringBytes(line.text),
        asciiBytes(' Tj ET\n'),
      );
    }

    y -= line.fontSize + (line.gapAfter ?? 5);
  }

  chunks.push(
    asciiBytes(`BT /F1 9 Tf 1 0 0 1 ${MARGIN_X} 28 Tm `),
    pdfStringBytes(`Página ${pageNumber} de ${totalPages}`),
    asciiBytes(' Tj ET\n'),
  );

  return concatBytes(chunks);
}

export function createSimplePdfBlob(title: string, sections: PdfSection[]) {
  const pageLines = paginateLines(buildLines(title, sections));
  const objectChunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  function append(chunk: Uint8Array) {
    objectChunks.push(chunk);
    currentOffset += chunk.length;
  }

  function appendAscii(value: string) {
    append(asciiBytes(value));
  }

  function addObject(objectNumber: number, body: Uint8Array) {
    offsets[objectNumber] = currentOffset;
    appendAscii(`${objectNumber} 0 obj\n`);
    append(body);
    appendAscii('\nendobj\n');
  }

  appendAscii('%PDF-1.4\n');

  const pageObjectNumbers = pageLines.map((_, index) => 4 + index * 2);
  const contentObjectNumbers = pageLines.map((_, index) => 5 + index * 2);
  const totalObjects = 3 + pageLines.length * 2;

  addObject(1, asciiBytes('<< /Type /Catalog /Pages 2 0 R >>'));
  addObject(
    2,
    asciiBytes(
      `<< /Type /Pages /Count ${pageLines.length} /Kids ${pageObjectNumbers
        .map((objectNumber) => `${objectNumber} 0 R`)
        .join(' ')} >>`,
    ),
  );
  addObject(3, asciiBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));

  pageLines.forEach((lines, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = contentObjectNumbers[index];
    const contentStream = buildContentStream(lines, index + 1, pageLines.length);

    addObject(
      pageObjectNumber,
      asciiBytes(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      ),
    );
    addObject(
      contentObjectNumber,
      concatBytes([
        asciiBytes(`<< /Length ${contentStream.length} >>\nstream\n`),
        contentStream,
        asciiBytes('endstream'),
      ]),
    );
  });

  const xrefOffset = currentOffset;
  appendAscii(`xref\n0 ${totalObjects + 1}\n`);
  appendAscii('0000000000 65535 f \n');

  for (let objectNumber = 1; objectNumber <= totalObjects; objectNumber += 1) {
    appendAscii(`${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`);
  }

  appendAscii(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\n`);
  appendAscii(`startxref\n${xrefOffset}\n%%EOF`);

  return new Blob([concatBytes(objectChunks)], { type: 'application/pdf' });
}
