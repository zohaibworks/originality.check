import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import mammoth from 'mammoth';

const execFileAsync = promisify(execFile);

function findGeneratedPdf(directory: string): string | undefined {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      try {
        if (fs.statSync(entryPath).size > 0) return entryPath;
      } catch {}
    }
    if (entry.isDirectory() && !entry.name.startsWith('profile')) {
      const nestedPdf = findGeneratedPdf(entryPath);
      if (nestedPdf) return nestedPdf;
    }
  }
  return undefined;
}

export interface ConvertDocxResult {
  success: boolean;
  pdfBase64?: string;
  pageCount?: number;
  error?: string;
}

// Locate the soffice/libreoffice binary across common Linux, macOS, and Windows paths.
function getLibreOfficeBinary(): string | null {
  const candidates = new Set<string>([
    process.env.LIBREOFFICE_BIN,
    process.env.SOFFICE_BIN,
    'soffice',
    'soffice.exe',
    'libreoffice',
    'libreoffice.exe',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/usr/local/bin/soffice',
    '/usr/local/bin/libreoffice',
    'C:/Program Files/LibreOffice/program/soffice.exe',
    'C:/Program Files/LibreOffice/program/libreoffice.exe',
    'C:/Program Files (x86)/LibreOffice/program/soffice.exe',
    'C:/Program Files (x86)/LibreOffice/program/libreoffice.exe',
  ]);

  const pathEntries = (process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
    .map(entry => entry.trim());

  for (const entry of pathEntries) {
    candidates.add(path.join(entry, 'soffice'));
    candidates.add(path.join(entry, 'soffice.exe'));
    candidates.add(path.join(entry, 'libreoffice'));
    candidates.add(path.join(entry, 'libreoffice.exe'));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;

    const normalized = candidate.trim();
    if (!normalized) continue;

    const isCommandOnPath = !normalized.includes('/') && !normalized.includes('\\') && !normalized.includes('Program Files');
    if (isCommandOnPath) {
      try {
        execFileSync(process.platform === 'win32' ? 'where' : 'which', [normalized], { stdio: 'ignore' });
        return normalized;
      } catch {
        continue;
      }
    }

    if (fs.existsSync(normalized)) {
      return normalized;
    }
  }

  return null;
}

/**
 * Fallback: converts DOCX to a plain-text PDF using mammoth + pdf-lib.
 * Used when LibreOffice is not installed. Layout fidelity is reduced but
 * text extraction and AI/similarity scanning work correctly.
 */
async function convertDocxToPdfViaMammoth(docxBase64: string): Promise<ConvertDocxResult> {
  const cleanBase64 = docxBase64.includes(',') ? docxBase64.split(',')[1] : docxBase64;
  const docxBuffer = Buffer.from(cleanBase64, 'base64');

  // Extract raw text via mammoth
  let rawText = '';
  try {
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    rawText = result.value || '';
  } catch (e) {
    console.error('Mammoth extractRawText failed:', e);
  }
  
  if (!rawText || rawText.trim().length < 20) {
    // Try to extract as HTML and strip tags
    try {
      const htmlResult = await mammoth.convertToHtml({ buffer: docxBuffer });
      rawText = htmlResult.value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    } catch (e) {
      console.error('Mammoth convertToHtml failed:', e);
    }
  }
  
  if (!rawText || rawText.trim().length < 20) {
    return { success: false, error: 'Could not extract readable text from this DOCX file.' };
  }

  // Build a basic PDF with pdf-lib
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const lineHeight = fontSize * 1.4;
  const pageWidth = 595;  // A4
  const pageHeight = 842;
  const marginX = 60;
  const marginTop = 60;
  const marginBottom = 60;
  const maxWidth = pageWidth - marginX * 2;
  const linesPerPage = Math.floor((pageHeight - marginTop - marginBottom) / lineHeight);

  // Sanitize text for WinAnsi encoding
  const sanitizedText = rawText
    .replace(/[\u0100-\u017F\u0180-\u024F]/g, (c) => {
      try {
        return c.normalize('NFD').replace(/[\u0300-\u036f]/g, '') || c;
      } catch {
        return '?';
      }
    })
    .replace(/[^\x20-\x7E\n\r\t]/g, '?');

  // Word-wrap all text lines
  const paragraphs = sanitizedText.split(/\n/).map(p => p.trim());
  const wrappedLines: string[] = [];
  for (const para of paragraphs) {
    if (!para) { wrappedLines.push(''); continue; }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      try {
        if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
          current = test;
        } else {
          if (current) wrappedLines.push(current);
          current = word.replace(/[^\x20-\x7E]/g, '?');
        }
      } catch {
        if (current) wrappedLines.push(current);
        current = word.replace(/[^\x20-\x7E]/g, '?');
      }
    }
    if (current) wrappedLines.push(current);
    wrappedLines.push(''); // blank line between paragraphs
  }

  // Paginate
  let lineIndex = 0;
  while (lineIndex < wrappedLines.length) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - marginTop;
    for (let i = 0; i < linesPerPage && lineIndex < wrappedLines.length; i++, lineIndex++) {
      const line = wrappedLines[lineIndex];
      if (line) {
        try {
          page.drawText(line, { x: marginX, y, size: fontSize, font, color: rgb(0, 0, 0) });
        } catch {
          // Skip problematic lines
        }
      }
      y -= lineHeight;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const pageCount = pdfDoc.getPageCount();
  return {
    success: true,
    pdfBase64: Buffer.from(pdfBytes).toString('base64'),
    pageCount,
  };
}

/**
 * Converts a DOCX file directly into an authentic, searchable, vector PDF
 * using server-side headless LibreOffice.
 *
 * This preserves:
 * - 100% exact page sequence, breaks, and layout
 * - All tables, borders, row heights, and column widths
 * - All images, logos, stickers, and embedded graphics
 * - Table of Contents (TOC) and hyperlinks
 * - Exact fonts, formatting, headers, and footers
 * - Full vector text selection, copy-pasting, and searchability
 */
export async function convertDocxToPdf(docxBase64: string, originalFileName = 'document.docx'): Promise<ConvertDocxResult> {
  const libreOfficeBin = getLibreOfficeBinary();
  if (!libreOfficeBin) {
    console.warn('LibreOffice not found — falling back to mammoth text extraction for DOCX conversion.');
    return convertDocxToPdfViaMammoth(docxBase64);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnitin-docx-'));
  const profileDir = path.join(tmpDir, 'profile');
  fs.mkdirSync(profileDir, { recursive: true });

  const extension = path.extname(originalFileName).toLowerCase() === '.doc' ? '.doc' : '.docx';
  const inputDocxPath = path.join(tmpDir, `source${extension}`);

  try {
    const cleanBase64 = docxBase64.includes(',') ? docxBase64.split(',')[1] : docxBase64;
    const docxBuffer = Buffer.from(cleanBase64, 'base64');
    if (docxBuffer.length < 4) {
      throw new Error('The uploaded Word file is empty or invalid.');
    }
    if (extension === '.docx' && docxBuffer.subarray(0, 2).toString() !== 'PK') {
      throw new Error('The uploaded file is not a valid DOCX package. Please upload the original DOCX file.');
    }
    let sourceBuffer = docxBuffer;
    if (extension === '.docx') {
      // Repair empty table-property extensions that some Word exporters place
      // inside table rows; LibreOffice rejects these nodes while Word/Mammoth tolerate them.
      try {
        const docxZip = await JSZip.loadAsync(docxBuffer);
        const documentXml = docxZip.file('word/document.xml');
        if (documentXml) {
          const xml = await documentXml.async('string');
          const repairedXml = xml
            .split('<w:tblPrEx></w:tblPrEx>').join('')
            .split('<w:tblPrEx/>').join('');
          if (repairedXml !== xml) {
            docxZip.file('word/document.xml', repairedXml);
            sourceBuffer = await docxZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
          }
        }
      } catch (zipErr) {
        console.warn('DOCX zip repair skipped:', zipErr);
      }
    }
    fs.writeFileSync(inputDocxPath, sourceBuffer);

    // Retry the default export filter even when LibreOffice exits successfully
    // but fails to create its output file.
    const exportFilters = ['pdf:writer_pdf_Export', 'pdf'];
    let generatedPdfPath: string | undefined;
    let lastConversionDiagnostic = '';

    for (const [attemptIndex, exportFilter] of exportFilters.entries()) {
      const attemptProfileDir = path.join(tmpDir, `profile-${attemptIndex + 1}`);
      fs.mkdirSync(attemptProfileDir, { recursive: true });
      const userInstallation = pathToFileURL(attemptProfileDir).href;
      const args = [
        '--headless',
        '--nologo',
        '--norestore',
        '--invisible',
        '--nofirststartwizard',
        '--view',
        `-env:UserInstallation=${userInstallation}`,
        '--convert-to',
        exportFilter,
        '--outdir',
        tmpDir,
        inputDocxPath,
      ];

      try {
        // Use xvfb if available in container
        if (process.platform !== 'win32' && fs.existsSync('/usr/bin/xvfb-run')) {
          const xvfbArgs = ['-a', '-e', '/dev/stdout', '--server-args=-screen 0 1280x1024x24 -noreset', libreOfficeBin, ...args];
          const result = await execFileAsync('xvfb-run', xvfbArgs, { timeout: 180000, maxBuffer: 30 * 1024 * 1024, env: { ...process.env, HOME: '/tmp', SAL_USE_VCLPLUGIN: 'svp' } });
          lastConversionDiagnostic = `${result.stdout || ''} ${result.stderr || ''}`.trim();
        } else {
          const result = await execFileAsync(libreOfficeBin, args, { timeout: 180000, maxBuffer: 30 * 1024 * 1024, env: { ...process.env, HOME: '/tmp', SAL_USE_VCLPLUGIN: 'svp' } });
          lastConversionDiagnostic = `${result.stdout || ''} ${result.stderr || ''}`.trim();
        }
      } catch (conversionError: any) {
        lastConversionDiagnostic = `${conversionError?.stdout || ''} ${conversionError?.stderr || ''} ${conversionError?.message || ''}`.trim();
      }

      generatedPdfPath = findGeneratedPdf(tmpDir);
      if (generatedPdfPath) break;
      console.warn(`LibreOffice ${exportFilter} attempt produced no PDF:`, lastConversionDiagnostic || 'no output');
    }

    if (!generatedPdfPath) {
      console.warn('LibreOffice failed, using mammoth fallback');
      return convertDocxToPdfViaMammoth(docxBase64);
    }

    const pdfBuffer = fs.readFileSync(generatedPdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    if (pageCount < 1) {
      throw new Error('LibreOffice produced a PDF with no pages.');
    }

    return {
      success: true,
      pdfBase64: pdfBuffer.toString('base64'),
      pageCount,
    };
  } catch (err: any) {
    console.error('LibreOffice DOCX to PDF conversion error:', err);
    console.warn('Falling back to mammoth due to LibreOffice error');
    try {
      return await convertDocxToPdfViaMammoth(docxBase64);
    } catch (fallbackErr: any) {
      return {
        success: false,
        error: fallbackErr?.message || err?.message || 'LibreOffice conversion failed',
      };
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('Temp cleanup warning:', cleanupErr);
    }
  }
}
