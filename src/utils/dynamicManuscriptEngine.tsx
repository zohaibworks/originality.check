import React, { useMemo } from 'react';
import { ScanReport, MatchedSource } from '../types';
import {
  TurnitinPageHeader,
  TurnitinPageFooter,
  getBadgeColor,
} from '../components/TurnitinOfficialPages';
import {
  isTableOfContentsHeading,
  isTableOfContentsEntry,
  isTableOfContentsText,
  isTableHeadingOrCaption,
  isTableRowOrData,
  isTableText,
  isFigureOrGraphText,
  isMainHeadingText,
  isGlossaryOrTermTableText,
  isQuoteText,
  isBibliographyHeading,
  isCitationLine,
  isBibliographyOrReferenceText,
  isExcludedFromHighlighting,
  clampSimilarityScore,
  countWords,
  selectIndicesForWordShare,
  splitIntoSentences,
} from './documentParser';
import { getInstitutionName } from './institutionName';

export interface FormattedSegment {
  text: string;
  isPlagiarized?: boolean;
  sourceIndex?: number;
  isBlueUnderlined?: boolean;
  isAi?: boolean;
}

export interface FormattedParagraph {
  segments: FormattedSegment[];
  badges: number[];
  isAiParagraph?: boolean;
  isHeading?: boolean;
}

export interface ManuscriptPageData {
  pageIndex: number; // 0-based
  paragraphs: FormattedParagraph[];
  wordCount: number;
}

/**
 * Generates realistic, domain-tailored matched sources for any uploaded document.
 * Strictly clamps total plagiarism similarity within 1% to 12% (never exceeding 12%).
 */
// High-frequency authentic Turnitin university student paper sources (50% ratio: UK, USA, and Pakistan HEC)
const UNIVERSITY_STUDENT_PAPER_SOURCES = [
  // USA Universities & Colleges
  { name: 'Submitted to Florida Southern College', url: 'https://flsouthern.edu', type: 'student_paper' as const },
  { name: 'Submitted to American College of Education', url: 'https://ace.edu', type: 'student_paper' as const },
  { name: 'Submitted to Harvard University', url: 'https://harvard.edu', type: 'student_paper' as const },
  { name: 'Submitted to Stanford University', url: 'https://stanford.edu', type: 'student_paper' as const },
  { name: 'Submitted to University of California, Berkeley', url: 'https://berkeley.edu', type: 'student_paper' as const },
  { name: 'Submitted to Massachusetts Institute of Technology', url: 'https://mit.edu', type: 'student_paper' as const },
  { name: 'Submitted to Columbia University', url: 'https://columbia.edu', type: 'student_paper' as const },
  { name: 'Submitted to University of Texas at Austin', url: 'https://utexas.edu', type: 'student_paper' as const },
  { name: 'Submitted to Johns Hopkins University', url: 'https://jhu.edu', type: 'student_paper' as const },
  { name: 'Submitted to New York University', url: 'https://nyu.edu', type: 'student_paper' as const },
  { name: 'Submitted to Purdue University', url: 'https://purdue.edu', type: 'student_paper' as const },
  { name: 'Submitted to Pennsylvania State University', url: 'https://psu.edu', type: 'student_paper' as const },
  { name: 'Submitted to Georgia Institute of Technology', url: 'https://gatech.edu', type: 'student_paper' as const },
  { name: 'Submitted to University of Florida', url: 'https://ufl.edu', type: 'student_paper' as const },

  // UK Universities
  { name: 'Submitted to University of Oxford', url: 'https://ox.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to University of Cambridge', url: 'https://cam.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to Imperial College London', url: 'https://imperial.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to University College London', url: 'https://ucl.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to University of Edinburgh', url: 'https://ed.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to University of Manchester', url: 'https://manchester.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to King\'s College London', url: 'https://kcl.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to London School of Economics', url: 'https://lse.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to University of Warwick', url: 'https://warwick.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to University of Leeds', url: 'https://leeds.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to University of Birmingham', url: 'https://bham.ac.uk', type: 'student_paper' as const },
  { name: 'Submitted to University of Glasgow', url: 'https://gla.ac.uk', type: 'student_paper' as const },

  // Pakistan HEC Recognized Universities
  { name: 'Submitted to Higher Education Commission Pakistan', url: 'https://hec.gov.pk', type: 'student_paper' as const },
  { name: 'Submitted to National University of Sciences & Technology', url: 'https://nust.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to Quaid-i-Azam University', url: 'https://qau.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to Lahore University of Management Sciences', url: 'https://lums.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to COMSATS University Islamabad', url: 'https://comsats.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to University of the Punjab', url: 'https://pu.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to University of Engineering and Technology, Lahore', url: 'https://uet.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to Aga Khan University', url: 'https://aku.edu', type: 'student_paper' as const },
  { name: 'Submitted to Institute of Business Administration, Karachi', url: 'https://iba.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to University of Karachi', url: 'https://uok.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to FAST-NUCES', url: 'https://nu.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to Ghulam Ishaq Khan Institute', url: 'https://giki.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to Government College University, Lahore', url: 'https://gcu.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to Bahauddin Zakariya University', url: 'https://bzu.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to University of Agriculture, Faisalabad', url: 'https://uaf.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to University of Peshawar', url: 'https://uop.edu.pk', type: 'student_paper' as const },
  { name: 'Submitted to International Islamic University, Islamabad', url: 'https://iiu.edu.pk', type: 'student_paper' as const },
];

// Authentic Internet Sources (50% ratio with domain hostnames like .com, .in, .edu, .org, etc.)
const DOMAIN_INTERNET_SOURCES = [
  { name: 'cdn.varsitytutors.com', url: 'https://cdn.varsitytutors.com', type: 'internet' as const },
  { name: 'sciencedirect.com', url: 'https://sciencedirect.com', type: 'internet' as const },
  { name: 'researchgate.net', url: 'https://researchgate.net', type: 'internet' as const },
  { name: 'academia.edu', url: 'https://academia.edu', type: 'internet' as const },
  { name: 'coursehero.com', url: 'https://coursehero.com', type: 'internet' as const },
  { name: 'studocu.com', url: 'https://studocu.com', type: 'internet' as const },
  { name: 'scribd.com', url: 'https://scribd.com', type: 'internet' as const },
  { name: 'slideshare.net', url: 'https://slideshare.net', type: 'internet' as const },
  { name: 'springeropen.com', url: 'https://springeropen.com', type: 'internet' as const },
  { name: 'tandfonline.com', url: 'https://tandfonline.com', type: 'internet' as const },
  { name: 'shodhganga.inflibnet.ac.in', url: 'https://shodhganga.inflibnet.ac.in', type: 'internet' as const },
  { name: 'core.ac.uk', url: 'https://core.ac.uk', type: 'internet' as const },
  { name: 'mdpi.com', url: 'https://mdpi.com', type: 'internet' as const },
  { name: 'wiley.com', url: 'https://onlinelibrary.wiley.com', type: 'internet' as const },
  { name: 'nature.com', url: 'https://nature.com', type: 'internet' as const },
  { name: 'frontiersin.org', url: 'https://frontiersin.org', type: 'internet' as const },
  { name: 'hindawi.com', url: 'https://hindawi.com', type: 'internet' as const },
  { name: 'biorxiv.org', url: 'https://biorxiv.org', type: 'internet' as const },
  { name: 'medrxiv.org', url: 'https://medrxiv.org', type: 'internet' as const },
  { name: 'arxiv.org', url: 'https://arxiv.org', type: 'internet' as const },
  { name: 'ssrn.com', url: 'https://ssrn.com', type: 'internet' as const },
  { name: 'geeksforgeeks.org', url: 'https://geeksforgeeks.org', type: 'internet' as const },
  { name: 'tutorialspoint.com', url: 'https://tutorialspoint.com', type: 'internet' as const },
  { name: 'investopedia.com', url: 'https://investopedia.com', type: 'internet' as const },
  { name: 'britannica.com', url: 'https://britannica.com', type: 'internet' as const },
  { name: 'khanacademy.org', url: 'https://khanacademy.org', type: 'internet' as const },
  { name: 'chegg.com', url: 'https://chegg.com', type: 'internet' as const },
  { name: 'quizlet.com', url: 'https://quizlet.com', type: 'internet' as const },
  { name: 'nptel.ac.in', url: 'https://nptel.ac.in', type: 'internet' as const },
  { name: 'ijsr.net', url: 'https://ijsr.net', type: 'internet' as const },
  { name: 'iosrjournals.org', url: 'https://iosrjournals.org', type: 'internet' as const },
  { name: 'ijitee.org', url: 'https://ijitee.org', type: 'internet' as const },
];

/**
 * Deterministically shuffles an array based on an integer seed.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = Math.abs(seed) || 1;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateSourcesForDocument(
  fileName: string,
  title: string,
  plagiarismScore: number
): MatchedSource[] {
  const clampedPlag = clampSimilarityScore(plagiarismScore);
  if (clampedPlag <= 0) {
    return [];
  }

  // Derive an active seed from the title / fileName and current timestamp
  const inputStr = `${fileName}_${title}_${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < inputStr.length; i++) {
    hash = (hash << 5) - hash + inputStr.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash) + Math.floor(Math.random() * 10000);

  // Shuffle both university sources and internet domain sources
  const shuffledUnis = seededShuffle(UNIVERSITY_STUDENT_PAPER_SOURCES, seed);
  const shuffledInternet = seededShuffle(DOMAIN_INTERNET_SOURCES, seed + 101);

  // Determine total number of primary sources (typically 2 to 6 based on plagiarism percentage)
  const count = Math.min(10, Math.max(2, Math.min(6, Math.ceil(clampedPlag / 2.2))));

  // Allocate 50% university student paper sources and 50% internet sources
  const uniCount = Math.ceil(count / 2);
  const netCount = count - uniCount;

  // Interleave sources so they alternate or start appropriately (e.g. Uni, Internet, Uni, Internet...)
  const interleavedSources: Array<{ name: string; url: string; type: 'internet' | 'publication' | 'student_paper' }> = [];
  let uIdx = 0;
  let nIdx = 0;

  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      if (uIdx < uniCount && uIdx < shuffledUnis.length) {
        interleavedSources.push(shuffledUnis[uIdx++]);
      } else if (nIdx < shuffledInternet.length) {
        interleavedSources.push(shuffledInternet[nIdx++]);
      }
    } else {
      if (nIdx < netCount && nIdx < shuffledInternet.length) {
        interleavedSources.push(shuffledInternet[nIdx++]);
      } else if (uIdx < shuffledUnis.length) {
        interleavedSources.push(shuffledUnis[uIdx++]);
      }
    }
  }

  // Distribute the similarity percentages across the sources
  // Weights for decreasing distribution (e.g. 50%, 25%, 15%, 10%...)
  const baseWeights = [0.45, 0.25, 0.15, 0.08, 0.05, 0.02];
  const weights = baseWeights.slice(0, interleavedSources.length);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  let remaining = clampedPlag;
  return interleavedSources.map((s, idx) => {
    let sim: number;
    if (idx === interleavedSources.length - 1) {
      sim = Math.max(1, remaining);
    } else {
      const normalizedWeight = weights[idx] / weightSum;
      sim = Math.max(1, Math.round(clampedPlag * normalizedWeight));
      if (sim > remaining - (interleavedSources.length - idx - 1)) {
        sim = Math.max(1, remaining - (interleavedSources.length - idx - 1));
      }
      remaining -= sim;
    }

    return {
      id: `src-${idx + 1}`,
      name: s.name,
      url: s.url,
      similarity: sim,
      type: s.type,
    };
  });
}

/**
 * Paginates text cleanly into academic manuscript pages for an inserted document.
 * Strictly obeys:
 * - Plagiarism Similarity 1%–12% clamp.
 * - Exclude Quotes: Table of Contents & Quotes are excluded from plagiarism highlighting.
 * - Exclude Bibliography: References & Bibliography sections are excluded from plagiarism highlighting.
 */
export function paginateDocumentForTurnitin(
  report: ScanReport,
  mode: 'similarity' | 'ai'
): ManuscriptPageData[] {
  const isSimilarity = mode === 'similarity';
  const rawText = (report.text || '').trim();
  const title = report.title || report.fileName || 'Academic Manuscript';
  const excludeQuotes = report.excludeQuotes !== false;
  const excludeBibliography = report.excludeBibliography !== false;

  // Determine number of manuscript pages matching the uploaded document's actual page count.
  const targetManuscriptPages = Math.max(1, report.pageCount || 1);

  // Split into raw paragraphs
  let rawParagraphs = rawText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 10);

  // If we have text but fewer paragraphs than pages, subdivide paragraphs by sentences so each page has real text
  if (rawParagraphs.length > 0 && rawParagraphs.length < targetManuscriptPages) {
    const subdivided: string[] = [];
    for (const p of rawParagraphs) {
      const sentences = p.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [p];
      if (sentences.length > 2 && subdivided.length + rawParagraphs.length <= targetManuscriptPages * 2) {
        const mid = Math.ceil(sentences.length / 2);
        subdivided.push(sentences.slice(0, mid).join('').trim());
        subdivided.push(sentences.slice(mid).join('').trim());
      } else {
        subdivided.push(p);
      }
    }
    rawParagraphs = subdivided;
  }

  // Never synthesize manuscript content when the uploaded document has no readable text.
  if (rawParagraphs.length === 0) {
    return [{
      pageIndex: 0,
      paragraphs: [{
        segments: [{ text: 'No readable document text is available for this page.' }],
        badges: [],
      }],
      wordCount: 0,
    }];
  }

  // Target paragraphs per page (usually 2-3 per page)
  const paragraphsPerPage = Math.max(2, Math.ceil(rawParagraphs.length / targetManuscriptPages));

  const plagScore = Math.max(1, clampSimilarityScore(report.plagiarismScore));
  const aiScore = Number.isFinite(report.aiScore)
    ? Math.min(100, Math.max(0, report.aiScore))
    : 0;

  // Track sentence index for consistent highlight assignment
  const sentenceList: {
    text: string;
    paraIdx: number;
    isToc: boolean;
    isQuote: boolean;
    isBib: boolean;
    isTable: boolean;
    isFigure: boolean;
    isHeading: boolean;
  }[] = [];
  let inBibSection = false;
  let inTocSection = false;
  let inTableBlock = false;
  let inFigureBlock = false;

  const splitParagraphs = rawParagraphs.map((paraText, pIdx) => {
    const trimmedPara = paraText.trim();
    // Check if paragraph is bibliography, TOC, Table, Figure, or Heading
    if (isBibliographyHeading(trimmedPara) || isBibliographyOrReferenceText(trimmedPara)) {
      inBibSection = true;
    }
    if (isTableOfContentsHeading(trimmedPara) || isTableOfContentsText(trimmedPara)) {
      inTocSection = true;
    } else if (
      inTocSection &&
      /^[0-9]+\.\s+[A-Za-z]/.test(trimmedPara) &&
      !trimmedPara.includes('....') &&
      !/\d+$/.test(trimmedPara)
    ) {
      // TOC section ended, body text started
      inTocSection = false;
    }

    if (isTableHeadingOrCaption(trimmedPara) || isTableText(trimmedPara)) {
      inTableBlock = true;
    } else if (
      inTableBlock &&
      (isMainHeadingText(trimmedPara) || /^\d+(\.\d+)*\.?\s+[A-Z]/.test(trimmedPara))
    ) {
      inTableBlock = false;
    }

    if (isFigureOrGraphText(trimmedPara)) {
      inFigureBlock = true;
    } else if (
      inFigureBlock &&
      (isMainHeadingText(trimmedPara) ||
        isTableHeadingOrCaption(trimmedPara) ||
        (trimmedPara.length >= 90 && /[.!?]/.test(trimmedPara)))
    ) {
      inFigureBlock = false;
    }

    const isHeading =
      isMainHeadingText(trimmedPara) ||
      /^[0-9]\.\s|^Abstract:|^Conclusion:|^References:|^References$|^Bibliography|^Figure\s[0-9]/i.test(
        paraText
      );
    const sentences = splitIntoSentences(paraText);
    const cleanedSentences = (sentences.length > 0 ? sentences : [paraText])
      .map(s => s.trim())
      .filter(s => s.length > 5);

    cleanedSentences.forEach(s => {
      const isBib =
        inBibSection ||
        isBibliographyHeading(s) ||
        isCitationLine(s) ||
        isBibliographyOrReferenceText(s) ||
        isBibliographyOrReferenceText(paraText);
      const isToc =
        inTocSection ||
        isTableOfContentsHeading(s) ||
        isTableOfContentsEntry(s) ||
        isTableOfContentsText(s) ||
        isTableOfContentsText(paraText);
      const isTable =
        inTableBlock ||
        isTableHeadingOrCaption(s) ||
        isTableRowOrData(s) ||
        isTableText(s) ||
        isTableText(paraText);
      const isFigure =
        inFigureBlock || isFigureOrGraphText(s) || isFigureOrGraphText(paraText);
      const isSentenceHeading =
        isHeading ||
        isMainHeadingText(s) ||
        isGlossaryOrTermTableText(s) ||
        isGlossaryOrTermTableText(paraText);
      const isQuote = isQuoteText(s);
      sentenceList.push({
        text: s,
        paraIdx: pIdx,
        isToc,
        isQuote,
        isBib,
        isTable: isTable || isGlossaryOrTermTableText(s) || isGlossaryOrTermTableText(paraText),
        isFigure,
        isHeading: isSentenceHeading,
      });
    });

    return {
      rawText: paraText,
      isHeading,
      sentences: cleanedSentences,
    };
  });

  const totalSentences = sentenceList.length;

  // Identify eligible candidate sentences for highlighting (AI and Similarity):
  // NEVER highlight TOC, Tables, Images, Graphs/Figures, References, or main headings.
  const eligibleIndices: number[] = [];
  for (let i = 0; i < totalSentences; i++) {
    const item = sentenceList[i];
    if (
      item.isToc ||
      item.isTable ||
      item.isBib ||
      item.isFigure ||
      item.isHeading ||
      isExcludedFromHighlighting(item.text)
    ) {
      continue;
    }
    if (excludeQuotes && item.isQuote) continue;
    eligibleIndices.push(i);
  }

  const aiHighlightedSentences = new Set<number>();
  if (!isSimilarity && aiScore > 20 && eligibleIndices.length > 0) {
    const wordCounts = eligibleIndices.map(index => countWords(sentenceList[index].text));
    selectIndicesForWordShare(wordCounts, aiScore).forEach(localIndex => {
      aiHighlightedSentences.add(eligibleIndices[localIndex]);
    });
  }

  const getPercentTarget = (score: number, total: number): number => {
    if (!Number.isFinite(score) || score <= 0 || total <= 0) return 0;
    return Math.max(1, Math.min(total, Math.ceil(total * (score / 100))));
  };

  const getExactCoveragePositions = (totalCandidates: number, targetCount: number): number[] => {
    if (!Number.isFinite(targetCount) || targetCount <= 0 || totalCandidates <= 0) return [];
    const safeTarget = Math.min(totalCandidates, Math.max(1, Math.round(targetCount)));
    const positions = new Set<number>();

    for (let i = 0; i < safeTarget; i++) {
      const pos = Math.min(
        totalCandidates - 1,
        Math.max(0, Math.round(((i + 0.5) * totalCandidates) / safeTarget))
      );
      positions.add(pos);
    }

    return Array.from(positions).sort((a, b) => a - b);
  };

  // Decide which complete sentences are highlighted for the clamped 1-12% similarity score.
  const plagTargetCount = plagScore > 0 && eligibleIndices.length > 0
    ? getPercentTarget(plagScore, eligibleIndices.length)
    : 0;

  const plagSentenceIndices = new Map<number, { sourceIndex: number; isBlue: boolean }>();

  if (plagTargetCount > 0 && eligibleIndices.length > 0) {
    const positions = getExactCoveragePositions(eligibleIndices.length, plagTargetCount);
    for (let i = 0; i < positions.length; i++) {
      const targetIdx = eligibleIndices[positions[i]];
      const srcIdx = (i % 4) + 1;
      const isBlue = srcIdx === 2;
      plagSentenceIndices.set(targetIdx, { sourceIndex: srcIdx, isBlue });
    }
  }

  // Build formatted paragraphs with segments
  let currentSentenceIndex = 0;
  const formattedParagraphs: FormattedParagraph[] = splitParagraphs.map(sp => {
    const segments: FormattedSegment[] = [];
    const badgesSet = new Set<number>();
    let paragraphSearchOffset = 0;

    sp.sentences.forEach(sText => {
      const sIdx = currentSentenceIndex++;
      const item = sentenceList[sIdx];
      const isExcluded =
        item?.isToc ||
        item?.isTable ||
        item?.isBib ||
        item?.isFigure ||
        item?.isHeading ||
        sp.isHeading ||
        isExcludedFromHighlighting(sText) ||
        isExcludedFromHighlighting(sp.rawText);

      const plagInfo = !isExcluded ? plagSentenceIndices.get(sIdx) : undefined;
      const sentenceStart = sp.rawText.indexOf(sText, paragraphSearchOffset);
      if (sentenceStart !== -1) paragraphSearchOffset = sentenceStart + sText.length;

      if (isSimilarity && plagInfo) {
        badgesSet.add(plagInfo.sourceIndex);
        segments.push({
          text: `${sText} `,
          isPlagiarized: true,
          sourceIndex: plagInfo.sourceIndex,
        });
      } else if (!isSimilarity && !isExcluded && aiScore > 20 && aiHighlightedSentences.has(sIdx)) {
        segments.push({
          text: `${sText} `,
          isAi: true,
        });
      } else {
        segments.push({
          text: sText + ' ',
        });
      }
    });

    return {
      segments,
      badges: Array.from(badgesSet).sort((a, b) => a - b),
      isHeading: sp.isHeading,
    };
  });

  // Distribute paragraphs into manuscript pages evenly
  const pages: ManuscriptPageData[] = [];
  const totalParas = formattedParagraphs.length;
  const parasPerBasePage = Math.floor(totalParas / targetManuscriptPages);
  const remainder = totalParas % targetManuscriptPages;

  let currentParaIdx = 0;
  for (let mIdx = 0; mIdx < targetManuscriptPages; mIdx++) {
    const count = parasPerBasePage + (mIdx < remainder ? 1 : 0);
    let pageParas = formattedParagraphs.slice(currentParaIdx, currentParaIdx + Math.max(1, count));
    currentParaIdx += Math.max(1, count);

    // Ensure every single manuscript page has at least one paragraph rendered
    if (pageParas.length === 0 && totalParas > 0) {
      const fallbackIdx = mIdx % totalParas;
      pageParas = [formattedParagraphs[fallbackIdx]];
    }

    const words = pageParas.reduce(
      (sum, p) => sum + p.segments.reduce((s2, seg) => s2 + seg.text.split(/\s+/).length, 0),
      0
    );

    pages.push({
      pageIndex: mIdx,
      paragraphs: pageParas,
      wordCount: words,
    });
  }

  return pages;
}

/**
 * High-fidelity Dynamic Manuscript Page for ANY inserted document.
 * Follows the EXACT Turnitin pattern, typography, colors, left gutter badges, and highlight styling.
 */
export const DynamicTurnitinManuscriptPage: React.FC<{
  report: ScanReport;
  mode: 'similarity' | 'ai';
  pageIndex: number;
  pageNumber: number;
  totalPages: number;
}> = ({ report, mode, pageIndex, pageNumber, totalPages }) => {
  const isSimilarity = mode === 'similarity';
  const submissionId = report.submissionId || 'trn:oid:::2:445438161';
  const sectionTitle = isSimilarity ? 'Submission' : 'AI Writing Submission';

  // Compute pages dynamically from inserted file content
  const pagesData = useMemo(() => {
    return paginateDocumentForTurnitin(report, mode);
  }, [report, mode]);

  const currentPage = pagesData[pageIndex] || pagesData[0] || {
    pageIndex: 0,
    paragraphs: [],
    wordCount: 0,
  };

  const renderBadge = (num: number, keyId?: string | number) => {
    const color = getBadgeColor(num);
    return (
      <span
        key={keyId}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold font-mono ${color.bg} ${color.text} shadow-xs shrink-0`}
      >
        {num}
      </span>
    );
  };

  // Rich HTML paragraph layout with 4-color highlighters and AI highlighters
  return (
    <div className="flex flex-col justify-between h-full min-h-[960px] font-sans p-6 sm:p-10 text-slate-900 bg-white relative select-text">
      <TurnitinPageHeader
        pageNumber={pageNumber}
        totalPages={totalPages}
        sectionTitle={sectionTitle}
        submissionId={submissionId}
        mode={mode}
      />

      <div className="flex-1 my-auto text-[12.5px] leading-relaxed relative pt-4 pb-4">
        {/* On First Manuscript Page: Prominent Paper Title and Author block */}
        {pageIndex === 0 && (
          <div className="text-center space-y-1 mb-6 pb-3 border-b border-slate-200">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
              {report.title}
            </h1>
            <div className="text-xs text-slate-600 font-medium">
              <span>{report.author || 'Author'}</span>
              {report.institution && <span> • {getInstitutionName(report.institution)}</span>}
            </div>
          </div>
        )}

        {/* Paragraphs with left gutter badges and authentic Turnitin highlights */}
        <div className="space-y-4 text-justify">
          {currentPage.paragraphs.map((para, pIdx) => {
            const hasBadges = isSimilarity && para.badges.length > 0;

            return (
              <div
                key={`p-${pageIndex}-${pIdx}`}
                className="flex items-start gap-3 relative group"
              >
                {/* Left Gutter: Numbered Badges matching Turnitin official format */}
                <div className="w-8 shrink-0 flex flex-col items-end gap-1 pt-0.5 select-none">
                  {hasBadges &&
                    para.badges.map((bNum, bIdx) =>
                      renderBadge(bNum, `gutter-b-${pageIndex}-${pIdx}-${bIdx}`)
                    )}
                  {!isSimilarity && report.aiScore > 20 && para.segments.some(s => s.isAi) && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-[#0284c7] text-white">
                      AI
                    </span>
                  )}
                </div>

                {/* Paragraph Content */}
                <div
                  className={`flex-1 text-slate-800 ${
                    para.isHeading
                      ? 'font-bold text-slate-900 text-sm mt-2 mb-1 border-b border-slate-100 pb-1'
                      : 'text-[12px] sm:text-[12.5px] leading-[1.75]'
                  }`}
                >
                  {para.segments.map((seg, sIdx) => {
                    if (isSimilarity && seg.isPlagiarized) {
                      const srcNum = seg.sourceIndex || 1;

                      // 4-color highlighter: 1 (Pink/Red), 2 (Blue), 3 (Emerald/Green), 4 (Purple)
                      // Badges appear on the LEFT side of the highlighted text
                      if (srcNum === 1) {
                        return (
                          <span
                            key={`seg-${sIdx}`}
                            style={{ backgroundColor: '#fca5a5', color: '#991b1b' }}
                            className="rounded-xs px-1 inline font-normal"
                          >
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[7.5px] font-bold font-mono bg-[#dc2626] text-white mr-1 align-baseline">
                              {srcNum}
                            </span>
                            {seg.text}
                          </span>
                        );
                      } else if (srcNum === 2) {
                        return (
                          <span
                            key={`seg-${sIdx}`}
                            style={{ backgroundColor: '#93c5fd', color: '#1e3a8a' }}
                            className="rounded-xs px-1 inline font-normal"
                          >
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[7.5px] font-bold font-mono bg-[#2563eb] text-white mr-1 align-baseline">
                              {srcNum}
                            </span>
                            {seg.text}
                          </span>
                        );
                      } else if (srcNum === 3) {
                        return (
                          <span
                            key={`seg-${sIdx}`}
                            style={{ backgroundColor: '#86efac', color: '#064e3b' }}
                            className="rounded-xs px-1 inline font-normal"
                          >
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[7.5px] font-bold font-mono bg-[#059669] text-white mr-1 align-baseline">
                              {srcNum}
                            </span>
                            {seg.text}
                          </span>
                        );
                      } else {
                        return (
                          <span
                            key={`seg-${sIdx}`}
                            style={{ backgroundColor: '#d8b4fe', color: '#4c1d95' }}
                            className="rounded-xs px-1 inline font-normal"
                          >
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[7.5px] font-bold font-mono bg-[#7c3aed] text-white mr-1 align-baseline">
                              {srcNum}
                            </span>
                            {seg.text}
                          </span>
                        );
                      }
                    }

                    if (!isSimilarity && seg.isAi && report.aiScore >= 21) {
                      return (
                        <span
                          key={`seg-${sIdx}`}
                          style={{
                            backgroundColor: '#93c5fd', // prominent light blue highlight for AI detection
                            color: '#1e3a8a',           // dark blue text
                          }}
                          className="rounded-xs px-1 py-0.5 inline font-normal"
                        >
                          {seg.text}
                        </span>
                      );
                    }

                    return <span key={`seg-${sIdx}`}>{seg.text}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TurnitinPageFooter
        pageNumber={pageNumber}
        totalPages={totalPages}
        sectionTitle={sectionTitle}
        submissionId={submissionId}
        mode={mode}
      />
    </div>
  );
};
