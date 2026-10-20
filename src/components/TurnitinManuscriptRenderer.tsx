import React from 'react';
import { ScanReport } from '../types';
import { DynamicTurnitinManuscriptPage } from '../utils/dynamicManuscriptEngine';
import { AuthenticPdfManuscriptPage } from './AuthenticPdfManuscriptPage';

export interface TurnitinManuscriptRendererProps {
  report: ScanReport;
  mode: 'ai' | 'similarity';
  pageIndex: number; // 0-based index (representing manuscript pages 1..N)
  pageNumber: number; // Overall report page number
  totalPages: number;
}

/**
 * Universal Turnitin Manuscript Page Renderer.
 * Prioritizes direct authentic PDF pages (from LibreOffice conversion or direct PDF upload)
 * preserving 100% of the original document's tables, TOC, graphs, images, logos, stickers, and selectable text.
 * Falls back to dedicated sample manuscripts or dynamic engine when fileData is not present.
 */
export const TurnitinManuscriptPage: React.FC<TurnitinManuscriptRendererProps> = ({
  report,
  mode,
  pageIndex,
  pageNumber,
  totalPages,
}) => {
  // If authentic PDF data is available (from LibreOffice DOCX conversion or direct PDF upload),
  // render the exact original pages with tables, TOC, graphs, images, logos, stickers, and selectable text intact.
  // This takes precedence over any demo/report-style sample content.
  if (report.fileData) {
    return (
      <AuthenticPdfManuscriptPage
        report={report}
        mode={mode}
        pageIndex={pageIndex}
        pageNumber={pageNumber}
        totalPages={totalPages}
      />
    );
  }

  return (
    <DynamicTurnitinManuscriptPage
      report={report}
      mode={mode}
      pageIndex={pageIndex}
      pageNumber={pageNumber}
      totalPages={totalPages}
    />
  );
};
