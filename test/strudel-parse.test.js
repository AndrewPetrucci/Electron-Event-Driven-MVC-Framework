/**
 * Unit tests for Strudel parsing and segment mapping.
 * Run: node test/strudel-parse.test.js
 * No Electron or browser required.
 */

const {
  isSetupOnlyLine,
  parseCodeForPlay,
  getDollarBlocksWithSegments,
  mapPatternRangeToDoc,
  normalizeCodeForParsing,
} = require('../packages/overlay-view-strudel/strudel-parse.cjs');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(message || `Expected ${e}, got ${a}`);
  }
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓', name);
  } catch (err) {
    failed++;
    console.error('  ✗', name);
    console.error('   ', err.message);
  }
}

console.log('\nStrudel parse tests\n');

// --- isSetupOnlyLine ---
test('isSetupOnlyLine: empty is setup', () => {
  assert(isSetupOnlyLine(''));
  assert(isSetupOnlyLine('   '));
});

test('isSetupOnlyLine: samples/setcps/let are setup', () => {
  assert(isSetupOnlyLine('samples("x")'));
  assert(isSetupOnlyLine('setcps(0.5)'));
  assert(isSetupOnlyLine('let x = 1'));
  assert(isSetupOnlyLine('const chords = chord("C")'));
});

test('isSetupOnlyLine: stack/sound are not setup', () => {
  assert(!isSetupOnlyLine('stack('));
  assert(!isSetupOnlyLine('s("bd")'));
  assert(!isSetupOnlyLine('  stack('));
});

// --- parseCodeForPlay ---
test('parseCodeForPlay: setup-only lines go to otherLines', () => {
  const code = 'samples("x")\nsetcps(0.5)\nlet chords = chord("C")';
  const { dollarLines, otherLines } = parseCodeForPlay(code);
  assertEqual(dollarLines.length, 0);
  assertEqual(otherLines.length, 3);
});

test('parseCodeForPlay: single-line pattern', () => {
  const code = 's("bd*4")';
  const { dollarLines, otherLines } = parseCodeForPlay(code);
  assertEqual(dollarLines.length, 1);
  assertEqual(dollarLines[0].code, 's("bd*4")');
  assertEqual(dollarLines[0].lineNumber, 0);
  assertEqual(otherLines.length, 0);
});

test('parseCodeForPlay: multi-line stack with continuation', () => {
  const code = [
    'samples("x")',
    'stack(',
    '  s("bd")',
    '  ,',
    '  s("sd")',
    ')',
    '.late("[0 1]*2")',
  ].join('\n');
  const { dollarLines, otherLines } = parseCodeForPlay(code);
  assertEqual(otherLines.length, 1);
  assertEqual(dollarLines.length, 1);
  assert(dollarLines[0].code.includes('stack('));
  assert(dollarLines[0].code.includes('.late'));
  assert(dollarLines[0].code.includes('s("sd")'));
});

test('parseCodeForPlay: comment lines inside pattern are skipped (not break)', () => {
  const code = [
    'stack(',
    '  s("bd")',
    '  , // CHORDS',
    '  s("hh")',
    ')',
  ].join('\n');
  const { dollarLines } = parseCodeForPlay(code);
  assertEqual(dollarLines.length, 1);
  assert(dollarLines[0].code.includes('s("hh")'));
});

test('parseCodeForPlay: stack with .scope() and blank line stays one block', () => {
  const code = [
    'stack(',
    '  s("breaks125").fit().slice([0,.25,.5,.75], "0 1 1 <2 3>").gain(.2).scope(),',
    '',
    '  s("swpad:0").scrub("{0.1!2 .25@3 0.7!2 <0.8:1.5>}%8").slow(8).gain(.1).scope()',
    ')',
  ].join('\n');
  const { dollarLines } = parseCodeForPlay(code);
  assertEqual(dollarLines.length, 1);
  assert(dollarLines[0].code.includes('s("breaks125")'));
  assert(dollarLines[0].code.includes('s("swpad:0")'));
  assert(dollarLines[0].hasVisualization, 'should detect scope() as visualization');
});

// --- getDollarBlocksWithSegments ---
test('getDollarBlocksWithSegments: one block, segments cover full pattern', () => {
  const code = '  stack(\n  s("bd")\n)';
  const blocks = getDollarBlocksWithSegments(code);
  assertEqual(blocks.length, 1);
  assert(blocks[0].code.includes('stack('));
  assert(blocks[0].code.includes('s("bd")'));
  assert(blocks[0].segments.length >= 1);
  const first = blocks[0].segments[0];
  assertEqual(first.patternFrom, 0);
  assert(first.patternTo > 0);
  assert(first.docFrom >= 0);
  assert(first.docTo > first.docFrom);
});

test('getDollarBlocksWithSegments: comment-only lines skipped, block continues', () => {
  const code = [
    'stack(',
    '  s("bd")',
    '  , // CHORDS',
    '  s("hh")',
    ')',
  ].join('\n');
  const blocks = getDollarBlocksWithSegments(code);
  assertEqual(blocks.length, 1);
  assert(blocks[0].code.includes('s("hh")'));
});

test('getDollarBlocksWithSegments: blank line inside stack with scope() included', () => {
  const code = [
    'stack(',
    '  s("breaks125").gain(.2).scope(),',
    '',
    '  s("swpad:0").gain(.1).scope()',
    ')',
  ].join('\n');
  const blocks = getDollarBlocksWithSegments(code);
  assertEqual(blocks.length, 1);
  assert(blocks[0].code.includes('s("breaks125")'));
  assert(blocks[0].code.includes('s("swpad:0")'));
  assert(blocks[0].code.includes('\n\n'), 'block should include the blank line');
});

// --- mapPatternRangeToDoc ---
test('mapPatternRangeToDoc: single segment', () => {
  const segments = [
    { patternFrom: 0, patternTo: 10, docFrom: 2, docTo: 12 },
  ];
  const [docFrom, docTo] = mapPatternRangeToDoc(segments, 0, 5);
  assertEqual(docFrom, 2);
  assertEqual(docTo, 7);
});

test('mapPatternRangeToDoc: two segments', () => {
  const segments = [
    { patternFrom: 0, patternTo: 7, docFrom: 2, docTo: 9 },
    { patternFrom: 7, patternTo: 15, docFrom: 9, docTo: 17 },
  ];
  const [docFrom, docTo] = mapPatternRangeToDoc(segments, 8, 12);
  assertEqual(docFrom, 10);
  assertEqual(docTo, 14);
});

// --- DOC_POSITION_CORRECTION (documented behavior) ---
test('mapPatternRangeToDoc: doc positions are segment-relative', () => {
  const code = '  stack(\n  s("bd")';
  const blocks = getDollarBlocksWithSegments(code);
  assert(blocks.length >= 1);
  const segs = blocks[0].segments;
  const [dFrom, dTo] = mapPatternRangeToDoc(segs, 0, 6);
  assert(dFrom >= 0);
  assert(dTo <= code.length);
  assert(dTo > dFrom);
});

// --- Full mapping chain (for highlighting iteration) ---
test('mapping chain: pattern range in block maps to correct doc slice', () => {
  const doc = '  s("bd*4")';
  const blocks = getDollarBlocksWithSegments(doc);
  assertEqual(blocks.length, 1);
  const block = blocks[0];
  assertEqual(block.code, 's("bd*4")');
  // In block.code "s(\"bd*4\")", positions 3,5 are "bd" inside the string
  const patternFrom = 3;
  const patternTo = 5;
  const [docFrom, docTo] = mapPatternRangeToDoc(block.segments, patternFrom, patternTo);
  const slice = doc.slice(docFrom, docTo);
  assertEqual(slice, 'bd', 'doc slice at mapped range should be "bd"');
});

// --- normalizeCodeForParsing (for pallet CodeMirror highlighting) ---
test('normalizeCodeForParsing: adds semicolon after samples()', () => {
  const code = "samples('x')\nsetcps(0.5)";
  const out = normalizeCodeForParsing(code);
  assert(out.includes("samples('x');"), 'should add semicolon after samples()');
  assert(out.includes('setcps(0.5);'), 'should add semicolon after setcps()');
});

test('normalizeCodeForParsing: no semicolon before continuation line starting with .', () => {
  const code = 'stack(\n  s("bd")\n)';
  const out = normalizeCodeForParsing(code);
  assert(!out.includes('s("bd");'), 'should not add semicolon before closing paren');
});

test('normalizeCodeForParsing: no semicolon inside stack()', () => {
  const code = [
    "samples('github:eddyflux/crate')",
    'setcps(.75)',
    'stack( // DRUMS',
    '    s("bd").struct("<[x*<1 2> [~@3 x]] x>"),',
    '    s("~ [rim, sd:<2 3>]").room("<0 .2>"),',
    '  ).bank(\'crate\')',
  ].join('\n');
  const out = normalizeCodeForParsing(code);
  assert(out.includes("samples('github:eddyflux/crate');"), 'samples line should get semicolon');
  assert(out.includes('setcps(.75);'), 'setcps line should get semicolon');
  assert(!out.includes('DRUMS\');'), 'comment line should not get semicolon');
  assert(!out.includes('x>"),;'), 'comma continuation should not get semicolon');
});

// --- Pallet CodeMirror highlighting: normalized code parses without syntax errors ---
test('pallet highlighting: example with samples/setcps/stack parses without error nodes when normalized', () => {
  const { parser } = require('@lezer/javascript');
  const palletExampleCode = `samples('github:eddyflux/crate')
setcps(.75)
stack( // DRUMS
    s("bd").struct("<[x*<1 2> [~@3 x]] x>"),
    s("~ [rim, sd:<2 3>]").room("<0 .2>"),
    n("[0 <1 3>]*<2!3 4>").s("hh"),
    s("rd:<1!3 2>*2").gain(.5)
  ).bank('crate')`;
  const normalized = normalizeCodeForParsing(palletExampleCode);
  const tree = parser.parse(normalized);
  const errors = [];
  tree.iterate({
    enter: (node) => {
      if (node.type.isError) {
        errors.push({
          from: node.from,
          to: node.to,
          name: node.type.name,
        });
      }
    },
  });
  assertEqual(errors.length, 0, 'normalized pallet example should parse with no error nodes (got: ' + JSON.stringify(errors) + ')');
});

test('pallet highlighting: normalized code covers full document', () => {
  const { parser } = require('@lezer/javascript');
  const code = "samples('x')\nsetcps(0.5)\ns('bd')";
  const normalized = normalizeCodeForParsing(code);
  const tree = parser.parse(normalized);
  const top = tree.topNode;
  assert(top.from === 0 && top.to === normalized.length, 'syntax tree should span full document');
});

console.log('\n' + (failed === 0 ? 'All ' + passed + ' tests passed.' : passed + ' passed, ' + failed + ' failed.'));
process.exit(failed > 0 ? 1 : 0);
