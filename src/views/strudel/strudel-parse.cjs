/**
 * Pure parsing and segment-mapping logic for Strudel editor code.
 * Used by app.js and by test/strudel-parse.test.js so behavior can be tested without the app.
 * No dependencies.
 */

function isSetupOnlyLine(trimmed) {
  const t = typeof trimmed === 'string' ? trimmed.trim() : '';
  if (!t) return true;
  return /^(samples\s*\(|setcps\s*\(|setDefault\s*\(|let\s+|const\s+|var\s+)/i.test(t);
}

/**
 * Parse editor code into pattern lines and other (setup) lines.
 * @param {string} code
 * @returns {{ dollarLines: Array<{ code: string, lineNumber: number, hasVisualization: boolean }>, otherLines: string[] }}
 */
function parseCodeForPlay(code) {
  const lines = code.split('\n');
  const dollarLines = [];
  const otherLines = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//')) {
      otherLines.push(line);
      i++;
      continue;
    }
    const isPatternLine = trimmedLine && !isSetupOnlyLine(trimmedLine);
    if (isPatternLine) {
      const startLine = i;
      let patternCode = trimmedLine.replace(/\.play\(\);?$/, '');
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (next && !next.startsWith('//') && isSetupOnlyLine(next)) break;
        if (next.startsWith('//')) {
          i++;
          continue;
        }
        const withNext = patternCode + (patternCode ? '\n' : '') + lines[i];
        patternCode = withNext;
        i++;
        if (next) {
          const open = (withNext.match(/[(\[{]/g) || []).length;
          const close = (withNext.match(/[)\]\}]/g) || []).length;
          const balanced = open <= close;
          const peekNext = i < lines.length ? lines[i].trim() : '';
          const continuesWithDot = /^\s*\./.test(peekNext);
          const continuesWithComma = /^\s*,/.test(peekNext);
          // Don't break when we're inside stack( ... ) with more args (line ends with comma), e.g. after .scope(),
          const lineEndsWithComma = /,\s*$/.test(withNext.trimEnd());
          if (balanced && !continuesWithDot && !continuesWithComma && !lineEndsWithComma) break;
        }
      }
      if (patternCode) {
        const vizRegex = /\._?(pianoroll|punchcard|spiral|scope|spectrum|pitchwheel)\s*\(/;
        dollarLines.push({
          code: patternCode,
          lineNumber: startLine,
          hasVisualization: vizRegex.test(patternCode),
        });
      }
      continue;
    }
    otherLines.push(line);
    i++;
  }
  return { dollarLines, otherLines };
}

/**
 * Parse editor content into pattern blocks with segment mapping.
 * @param {string} code
 * @returns {{ code: string, segments: Array<{ patternFrom: number, patternTo: number, docFrom: number, docTo: number }> }[]}
 */
function getDollarBlocksWithSegments(code) {
  const lines = code.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//')) {
      i++;
      continue;
    }
    const isPatternLine = trimmedLine && !isSetupOnlyLine(trimmedLine);
    if (!isPatternLine) {
      i++;
      continue;
    }
    let patternCode = trimmedLine.replace(/\.play\(\);?$/, '');
    const lineStarts = [];
    for (let k = 0; k <= i; k++) lineStarts.push(lines.slice(0, k).join('\n').length);
    const codeStartOnFirstLine = lines[i].length - lines[i].trimStart().length;
    let docStart = lineStarts[i] + codeStartOnFirstLine;
    const segments = [
      {
        patternFrom: 0,
        patternTo: patternCode.length,
        docFrom: docStart,
        docTo: docStart + patternCode.length,
      },
    ];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      const nextLine = lines[i];
      if (!next) {
        // Include blank lines inside stack( ... ) so segment mapping matches document and evaluated code
        const openCount = (patternCode.match(/[(\[{]/g) || []).length;
        const closeCount = (patternCode.match(/[)\]\}]/g) || []).length;
        const lineEndsWithComma = /,\s*$/.test(patternCode.trimEnd());
        if (patternCode && (lineEndsWithComma || openCount > closeCount)) {
          const chunk = (patternCode ? '\n' : '') + nextLine;
          const partStartInDoc = lines.slice(0, i).join('\n').length;
          const patternFrom = patternCode.length;
          patternCode += chunk;
          segments.push({
            patternFrom,
            patternTo: patternCode.length,
            docFrom: partStartInDoc,
            docTo: partStartInDoc + chunk.length,
          });
        }
        i++;
        continue;
      }
      if (next.startsWith('//')) {
        i++;
        continue;
      }
      if (next && isSetupOnlyLine(next)) break;
      const dotContinuation = /^\s*\./.test(nextLine);
      const nonLetterStart = patternCode && !/^\s*[a-zA-Z_$]/.test(next);
      const withNext = patternCode + (patternCode ? '\n' : '') + nextLine;
      const open = (withNext.match(/[(\[{]/g) || []).length;
      const close = (withNext.match(/[)\]\}]/g) || []).length;
      const unbalanced = open > close;
      const peekNext = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const continuesWithDot = /^\s*\./.test(lines[i + 1] || '');
      const bracketContinuation = unbalanced || (open === close && continuesWithDot);
      const isContinuation = dotContinuation || nonLetterStart || bracketContinuation;
      if (!isContinuation) break;
      const partStartInDoc = lines.slice(0, i).join('\n').length;
      const patternFrom = patternCode.length;
      const chunk = (patternCode ? '\n' : '') + nextLine;
      patternCode += chunk;
      const patternTo = patternCode.length;
      // partStartInDoc points to the newline before this line; chunk starts with \n, so docFrom = partStartInDoc
      const docFrom = partStartInDoc;
      const docTo = docFrom + chunk.length;
      segments.push({ patternFrom, patternTo, docFrom, docTo });
      i++;
    }
    if (patternCode) blocks.push({ code: patternCode, segments });
  }
  return blocks;
}

/**
 * Map a range [from, to] in patternCode to document range using segments.
 * @param {Array<{ patternFrom: number, patternTo: number, docFrom: number, docTo: number }>} segments
 * @param {number} from
 * @param {number} to
 * @returns {[number, number]} [docFrom, docTo]
 */
function mapPatternRangeToDoc(segments, from, to) {
  let docFrom = from;
  let docTo = to;
  for (const seg of segments) {
    if (from >= seg.patternFrom && from < seg.patternTo)
      docFrom = seg.docFrom + (from - seg.patternFrom);
    if (to > seg.patternFrom && to <= seg.patternTo)
      docTo = seg.docTo - (seg.patternTo - to);
  }
  return [docFrom, docTo];
}

module.exports = {
  isSetupOnlyLine,
  parseCodeForPlay,
  getDollarBlocksWithSegments,
  mapPatternRangeToDoc,
};
