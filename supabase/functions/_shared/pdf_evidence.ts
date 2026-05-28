// Shared pdf-lib helpers: brand colors, A4 constants, and a minimal multi-page
// text Writer (wrapping + page breaks). Used by consent and firma PDF builders.
import { PDFDocument, PDFFont, PDFPage, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

export const TEAL = rgb(0.09, 0.70, 0.64);
export const DARK = rgb(0.12, 0.16, 0.23);
export const GREY = rgb(0.37, 0.49, 0.58);
export const A4: [number, number] = [595.28, 841.89];
export const MARGIN = 56;

export function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

export class Writer {
  private page: PDFPage;
  private y: number;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.page = doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }
  private ensure(space: number) {
    if (this.y - space < MARGIN) {
      this.page = this.doc.addPage(A4);
      this.y = A4[1] - MARGIN;
    }
  }
  gap(h: number) { this.y -= h; }
  title(text: string) {
    this.ensure(28);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 16, font: this.bold, color: DARK });
    this.y -= 10;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 1.5, color: TEAL });
    this.y -= 14;
  }
  heading(text: string) {
    this.ensure(20);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 12, font: this.bold, color: TEAL });
    this.y -= 16;
  }
  line(text: string, f = this.font) {
    this.ensure(14);
    this.page.drawText(clip(text, 110), { x: MARGIN, y: this.y, size: 10, font: f, color: DARK });
    this.y -= 14;
  }
  mono(text: string) {
    this.ensure(12);
    this.page.drawText(clip(text, 96), { x: MARGIN, y: this.y, size: 8, font: this.font, color: GREY });
    this.y -= 12;
  }
  wrapped(text: string, color = DARK) {
    const max = A4[0] - 2 * MARGIN;
    const words = String(text).split(/\s+/);
    let curr = '';
    for (const word of words) {
      const test = curr ? curr + ' ' + word : word;
      if (this.font.widthOfTextAtSize(test, 9) > max) {
        this.ensure(12);
        this.page.drawText(curr, { x: MARGIN, y: this.y, size: 9, font: this.font, color });
        this.y -= 12;
        curr = word;
      } else {
        curr = test;
      }
    }
    if (curr) {
      this.ensure(12);
      this.page.drawText(curr, { x: MARGIN, y: this.y, size: 9, font: this.font, color });
      this.y -= 12;
    }
  }
}
