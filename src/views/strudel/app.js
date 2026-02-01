/**
 * Strudel Window App
 * 
 * This is the main application logic for the Strudel window.
 */

import * as strudelParse from './strudel-parse.cjs';

/**
 * Open documents data structure.
 * Each document: { id, filePath?, name, content, lastSavedContent, unsaved }
 */
function createDocument(id, filePath, name, content = '') {
    return {
        id,
        filePath: filePath ?? null,
        name: name || 'Untitled',
        content: content,
        lastSavedContent: content,
        unsaved: false,
    };
}

/** Documentation for Strudel functions (name -> { summary, link? }). Links use hash (#name) so iframe scrolls to section. */
const STRUDEL_DOCS = {
    /* Samples: https://strudel.cc/learn/samples/ */
    s: { summary: 'Sample: play a sample by name, e.g. s("bd"). Multiple names: s("bd sd").', link: 'https://strudel.cc/learn/samples/' },
    fit: { summary: 'Makes the sample fit its event duration. Good for rhythmical loops like drum breaks.', link: 'https://strudel.cc/learn/samples/#fit' },
    slice: { summary: 'Slice: chops samples into slices, triggered with a pattern. Use list of 0–1 for slice points.', link: 'https://strudel.cc/learn/samples/#slice' },
    speed: { summary: 'Playback speed of sample (and pitch). e.g. .speed(1.5).', link: 'https://strudel.cc/learn/samples/#speed' },
    begin: { summary: 'Skip the beginning of each sample (0–1).', link: 'https://strudel.cc/learn/samples/#begin' },
    end: { summary: 'Cut off the end of each sample (0–1).', link: 'https://strudel.cc/learn/samples/#end' },
    chop: { summary: 'Cut each sample into n parts (granular synthesis).', link: 'https://strudel.cc/learn/samples/#chop' },
    clip: { summary: 'Multiply duration and cut samples that exceed it.', link: 'https://strudel.cc/learn/samples/#clip' },
    loopAt: { summary: 'Fit the sample to n cycles by changing speed.', link: 'https://strudel.cc/learn/samples/#loopat' },
    scrub: { summary: 'Scrub audio like a tape loop; position in file (0–1) and optional playback speed.', link: 'https://strudel.cc/learn/samples/#scrub' },
    /* Notes: https://strudel.cc/learn/notes/ */
    note: { summary: 'Pitch: note names (a3 c#4) or MIDI numbers (57 61 64).', link: 'https://strudel.cc/learn/notes/' },
    n: { summary: 'Note: .n(0) or .note("c4"). Change pitch of a sample.', link: 'https://strudel.cc/learn/mini-notation/' },
    freq: { summary: 'Pitch as frequency in Hz, e.g. freq("220 275 330 440").', link: 'https://strudel.cc/learn/notes/#freq' },
    /* Audio effects: https://strudel.cc/learn/effects/ */
    gain: { summary: 'Volume: multiply amplitude, e.g. .gain(.5).', link: 'https://strudel.cc/learn/effects/#gain' },
    lpf: { summary: 'Low-pass filter: .lpf(2000).lpfq(4).', link: 'https://strudel.cc/learn/effects/#lpf' },
    hpf: { summary: 'High-pass filter.', link: 'https://strudel.cc/learn/effects/#hpf' },
    bpf: { summary: 'Band-pass filter.', link: 'https://strudel.cc/learn/effects/#bpf' },
    vowel: { summary: 'Vowel filter: .vowel("a e i o u").', link: 'https://strudel.cc/learn/effects/#vowel' },
    pan: { summary: 'Stereo panning: .pan(sine) or .pan(.5).', link: 'https://strudel.cc/learn/effects/#pan' },
    jux: { summary: 'Juxtapose: apply a function to the pattern and combine with original, e.g. .jux(rev).', link: 'https://strudel.cc/learn/effects/#jux' },
    delay: { summary: 'Delay effect: .delay(.2).delaytime(.5).', link: 'https://strudel.cc/learn/effects/#delay' },
    room: { summary: 'Reverb level and size. .room(.8).roomsize(4).', link: 'https://strudel.cc/learn/effects/#room' },
    reverb: { summary: 'Reverb effect (see room).', link: 'https://strudel.cc/learn/effects/#room' },
    /* Time modifiers: https://strudel.cc/learn/time-modifiers/ */
    slow: { summary: 'Slow down a pattern over the given number of cycles. Like "/" in mini notation.', link: 'https://strudel.cc/learn/time-modifiers/#slow' },
    fast: { summary: 'Speed up a pattern by the given factor. Used by "*" in mini notation.', link: 'https://strudel.cc/learn/time-modifiers/#fast' },
    early: { summary: 'Nudge a pattern to start earlier in time. Like Tidal\'s <~ operator.', link: 'https://strudel.cc/learn/time-modifiers/#early' },
    late: { summary: 'Nudge a pattern to start later in time. Like Tidal\'s ~> operator.', link: 'https://strudel.cc/learn/time-modifiers/#late' },
    legato: { summary: 'Multiplies duration; cuts samples that exceed it. Synonym: clip.', link: 'https://strudel.cc/learn/time-modifiers/#clip' },
    euclid: { summary: 'Euclidean rhythm: pulses over steps, e.g. .euclid(3,8).', link: 'https://strudel.cc/learn/time-modifiers/#euclid' },
    euclidRot: { summary: 'Like euclid with rotation offset, e.g. .euclidRot(3,16,14).', link: 'https://strudel.cc/learn/time-modifiers/#euclidrot' },
    euclidLegato: { summary: 'Euclidean rhythm with each pulse held until the next.', link: 'https://strudel.cc/learn/time-modifiers/#euclidlegato' },
    rev: { summary: 'Reverse all cycles in a pattern.', link: 'https://strudel.cc/learn/time-modifiers/#rev' },
    palindrome: { summary: 'Applies rev every other cycle (forwards then backwards).', link: 'https://strudel.cc/learn/time-modifiers/#palindrome' },
    iter: { summary: 'Increments the starting subdivision each cycle, e.g. .iter(4).', link: 'https://strudel.cc/learn/time-modifiers/#iter' },
    iterBack: { summary: 'Like iter but plays subdivisions in reverse order.', link: 'https://strudel.cc/learn/time-modifiers/#iterback' },
    ply: { summary: 'Repeats each event the given number of times.', link: 'https://strudel.cc/learn/time-modifiers/#ply' },
    segment: { summary: 'Samples the pattern at n events per cycle. Synonym: seg.', link: 'https://strudel.cc/learn/time-modifiers/#segment' },
    seg: { summary: 'Samples the pattern at n events per cycle. Synonym: segment.', link: 'https://strudel.cc/learn/time-modifiers/#segment' },
    compress: { summary: 'Compress each cycle into a timespan, leaving a gap.', link: 'https://strudel.cc/learn/time-modifiers/#compress' },
    zoom: { summary: 'Plays a portion of a pattern by begin/end timespan.', link: 'https://strudel.cc/learn/time-modifiers/#zoom' },
    linger: { summary: 'Selects a fraction of the pattern and repeats to fill the cycle.', link: 'https://strudel.cc/learn/time-modifiers/#linger' },
    fastGap: { summary: 'Like fast but leaves a gap (pattern compressed into part of cycle).', link: 'https://strudel.cc/learn/time-modifiers/#fastgap' },
    inside: { summary: 'Carries out an operation inside a cycle.', link: 'https://strudel.cc/learn/time-modifiers/#inside' },
    outside: { summary: 'Carries out an operation outside a cycle.', link: 'https://strudel.cc/learn/time-modifiers/#outside' },
    cpm: { summary: 'Plays the pattern at the given cycles per minute (tempo).', link: 'https://strudel.cc/learn/time-modifiers/#cpm' },
    ribbon: { summary: 'Loops a portion of the pattern. Synonym: rib.', link: 'https://strudel.cc/learn/time-modifiers/#ribbon' },
    rib: { summary: 'Loops a portion of the pattern. Synonym: ribbon.', link: 'https://strudel.cc/learn/time-modifiers/#ribbon' },
    swingBy: { summary: 'Swing: delays events in second half of each slice by amount x.', link: 'https://strudel.cc/learn/time-modifiers/#swingby' },
    swing: { summary: 'Shorthand for swingBy with 1/3, e.g. .swing(4).', link: 'https://strudel.cc/learn/time-modifiers/#swing' },
    /* Creating patterns: https://strudel.cc/learn/factories */
    cat: { summary: 'Concatenate: each item takes one cycle. Like "<x y>" in mini notation.', link: 'https://strudel.cc/learn/factories/#cat' },
    slowcat: { summary: 'Synonym for cat.', link: 'https://strudel.cc/learn/factories/#cat' },
    seq: { summary: 'Sequence: items crammed into one cycle. Like "x y" in mini notation.', link: 'https://strudel.cc/learn/factories/#seq' },
    sequence: { summary: 'Synonym for seq.', link: 'https://strudel.cc/learn/factories/#seq' },
    fastcat: { summary: 'Synonym for seq.', link: 'https://strudel.cc/learn/factories/#seq' },
    stack: { summary: 'Play items at the same time. Like "x,y" in mini notation.', link: 'https://strudel.cc/learn/factories/#stack' },
    stepcat: { summary: 'Concatenate proportional to steps per cycle. Like "x@3 y@2".', link: 'https://strudel.cc/learn/factories/#stepcat' },
    timeCat: { summary: 'Synonym for stepcat.', link: 'https://strudel.cc/learn/factories/#stepcat' },
    arrange: { summary: 'Arrange multiple patterns over cycles with [cycles, pattern] pairs.', link: 'https://strudel.cc/learn/factories/#arrange' },
    polymeter: { summary: 'Align steps of patterns (polymeter). Synonym: pm.', link: 'https://strudel.cc/learn/factories/#polymeter' },
    pm: { summary: 'Synonym for polymeter.', link: 'https://strudel.cc/learn/factories/#polymeter' },
    polymeterSteps: { summary: 'Polymeter with step count. Like "{x y z}%2".', link: 'https://strudel.cc/learn/factories/#polymetersteps' },
    silence: { summary: 'Does nothing. Like "~" in mini notation.', link: 'https://strudel.cc/learn/factories/#silence' },
    run: { summary: 'Discrete pattern of numbers 0 to n-1.', link: 'https://strudel.cc/learn/factories/#run' },
    binary: { summary: 'Creates a binary pattern from a number.', link: 'https://strudel.cc/learn/factories/#binary' },
    binaryN: { summary: 'Binary pattern from a number, padded to n bits.', link: 'https://strudel.cc/learn/factories/#binaryn' },
    /* Conditional modifiers: https://strudel.cc/learn/conditional-modifiers/ */
    lastOf: { summary: 'Apply a function every n cycles, starting from the last cycle.', link: 'https://strudel.cc/learn/conditional-modifiers/#lastof' },
    firstOf: { summary: 'Apply a function every n cycles, starting from the first cycle.', link: 'https://strudel.cc/learn/conditional-modifiers/#firstof' },
    when: { summary: 'Apply a function when the given pattern is true.', link: 'https://strudel.cc/learn/conditional-modifiers/#when' },
    chunk: { summary: 'Divide into parts, apply function to each part per cycle. Synonym: slowChunk.', link: 'https://strudel.cc/learn/conditional-modifiers/#chunk' },
    chunkBack: { summary: 'Like chunk but cycles through parts in reverse.', link: 'https://strudel.cc/learn/conditional-modifiers/#chunkback' },
    fastChunk: { summary: 'Like chunk but source cycles aren\'t repeated for each set.', link: 'https://strudel.cc/learn/conditional-modifiers/#fastchunk' },
    arp: { summary: 'Select indices in stacked notes, e.g. .arp("0 [0,2] 1").', link: 'https://strudel.cc/learn/conditional-modifiers/#arp' },
    arpWith: { summary: 'Select indices in stacked notes (function form).', link: 'https://strudel.cc/learn/conditional-modifiers/#arpwith' },
    struct: { summary: 'Apply a structure pattern to another, e.g. .struct("x ~ x ~").', link: 'https://strudel.cc/learn/conditional-modifiers/#struct' },
    mask: { summary: 'Returns silence when mask is 0 or "~".', link: 'https://strudel.cc/learn/conditional-modifiers/#mask' },
    reset: { summary: 'Resets the pattern to the start of the cycle for each reset onset.', link: 'https://strudel.cc/learn/conditional-modifiers/#reset' },
    restart: { summary: 'Restarts the pattern from cycle 0 for each restart onset.', link: 'https://strudel.cc/learn/conditional-modifiers/#restart' },
    hush: { summary: 'Silences a pattern.', link: 'https://strudel.cc/learn/conditional-modifiers/#hush' },
    invert: { summary: 'Swaps 1s and 0s in a binary pattern. Synonym: inv.', link: 'https://strudel.cc/learn/conditional-modifiers/#invert' },
    inv: { summary: 'Synonym for invert.', link: 'https://strudel.cc/learn/conditional-modifiers/#invert' },
    pick: { summary: 'Pick patterns from a list or lookup by index/name.', link: 'https://strudel.cc/learn/conditional-modifiers/#pick' },
    pickmod: { summary: 'Like pick but index wraps around the list.', link: 'https://strudel.cc/learn/conditional-modifiers/#pickmod' },
    pickF: { summary: 'Pick which function to apply from an array.', link: 'https://strudel.cc/learn/conditional-modifiers/#pickf' },
    pickmodF: { summary: 'Like pickF but index wraps around.', link: 'https://strudel.cc/learn/conditional-modifiers/#pickmodf' },
    pickRestart: { summary: 'Like pick but chosen pattern restarts when index is triggered.', link: 'https://strudel.cc/learn/conditional-modifiers/#pickrestart' },
    pickmodRestart: { summary: 'Like pickRestart but index wraps.', link: 'https://strudel.cc/learn/conditional-modifiers/#pickmodrestart' },
    pickReset: { summary: 'Like pick but chosen pattern resets when index is triggered.', link: 'https://strudel.cc/learn/conditional-modifiers/#pickreset' },
    pickmodReset: { summary: 'Like pickReset but index wraps.', link: 'https://strudel.cc/learn/conditional-modifiers/#pickmodreset' },
    inhabit: { summary: 'Like pick but cycles squeezed into the target pattern. Synonym: pickSqueeze.', link: 'https://strudel.cc/learn/conditional-modifiers/#inhabit' },
    inhabitmod: { summary: 'Like inhabit but index wraps.', link: 'https://strudel.cc/learn/conditional-modifiers/#inhabitmod' },
    squeeze: { summary: 'Pick from list via index; selected pattern compressed to event duration.', link: 'https://strudel.cc/learn/conditional-modifiers/#squeeze' },
    /* Accumulation: https://strudel.cc/learn/accumulation/ */
    superimpose: { summary: 'Superimpose the result of the given function(s) on top of the original pattern.', link: 'https://strudel.cc/learn/accumulation/#superimpose' },
    layer: { summary: 'Layer the result of the given function(s) without the original. Synonym: apply.', link: 'https://strudel.cc/learn/accumulation/#layer' },
    apply: { summary: 'Synonym for layer (accumulation).', link: 'https://strudel.cc/learn/accumulation/#layer' },
    off: { summary: 'Superimpose the function result delayed by the given time.', link: 'https://strudel.cc/learn/accumulation/#off' },
    echo: { summary: 'Superimpose and offset multiple times, decreasing velocity each time.', link: 'https://strudel.cc/learn/accumulation/#echo' },
    echoWith: { summary: 'Like echo but apply a function each iteration. Synonym: stutWith.', link: 'https://strudel.cc/learn/accumulation/#echowith' },
    stutWith: { summary: 'Synonym for echoWith.', link: 'https://strudel.cc/learn/accumulation/#echowith' },
    stut: { summary: 'Deprecated. Like echo but last 2 params flipped.', link: 'https://strudel.cc/learn/accumulation/#stut' },
    /* Pattern basics: https://strudel.cc/learn/pattern-basics/ */
    /* Visual feedback: https://strudel.cc/learn/visual-feedback/ */
    punchcard: { summary: 'Piano roll-style visual; includes transformations after. Use _punchcard() for inline.', link: 'https://strudel.cc/learn/visual-feedback/#punchcard' },
    pianoroll: { summary: 'Piano roll render of the pattern (no subsequent transforms). Use _pianoroll() for inline.', link: 'https://strudel.cc/learn/visual-feedback/#pianoroll' },
    spiral: { summary: 'Displays a spiral visual. Use _spiral() for inline. Options: stretch, size, thickness, etc.', link: 'https://strudel.cc/learn/visual-feedback/#spiral' },
    scope: { summary: 'Oscilloscope for the time domain of the audio. Use _scope() for inline. Synonym: tscope.', link: 'https://strudel.cc/learn/visual-feedback/#scope' },
    tscope: { summary: 'Synonym for scope.', link: 'https://strudel.cc/learn/visual-feedback/#scope' },
    pitchwheel: { summary: 'Pitch circle to visualize frequencies within one octave. Use _pitchwheel() for inline.', link: 'https://strudel.cc/learn/visual-feedback/#pitchwheel' },
    spectrum: { summary: 'Spectrum analyzer for the incoming audio. Use _spectrum() for inline.', link: 'https://strudel.cc/learn/visual-feedback/#spectrum' },
    markcss: { summary: 'Override CSS of highlighted events, e.g. .markcss(\'text-decoration:underline\').', link: 'https://strudel.cc/learn/visual-feedback/#markcss' },
    color: { summary: 'Color for mini notation highlighting and visuals, e.g. .color("cyan magenta").', link: 'https://strudel.cc/learn/visual-feedback/' },
};

/**
 * Get the identifier (word) at a given position in the CodeMirror document.
 * @param {import('@codemirror/view').EditorView} view
 * @param {number} pos - character offset
 * @returns {{ from: number, to: number, name: string } | null}
 */
function getWordAtPos(view, pos) {
    const doc = view.state.doc.toString();
    const len = doc.length;
    if (pos < 0 || pos >= len) return null;
    const isWordChar = (c) => /[a-zA-Z0-9_$]/.test(c);
    if (!isWordChar(doc[pos])) return null;
    let from = pos;
    while (from > 0 && isWordChar(doc[from - 1])) from--;
    let to = pos;
    while (to < len && isWordChar(doc[to])) to++;
    const name = doc.slice(from, to);
    return name ? { from, to, name } : null;
}

class StrudelApp {
    constructor() {
        this.strudelInstance = null;
        this.currentStackedPattern = null;
        this.currentPatterns = [];
        this._patternVisualizations = new Map(); // pattern index -> { canvas, container, lineNumber }
        /** @type {Array<{ id: string, filePath: string|null, name: string, content: string, lastSavedContent: string, unsaved: boolean }>} */
        this.openDocuments = [];
        /** @type {string|null} */
        this.activeDocumentId = null;
        /** @type {Map<string, import('@codemirror/state').EditorState>} Per-tab CodeMirror state (incl. undo history). */
        this._docEditorStates = new Map();
        this._untitledCounter = 0;
        this.initStrudel();
        this.initSaveLoadButtons();
    }

    /**
     * Initialize Strudel using the minimal-repl approach with transpiler
     */
    async initStrudel() {
        try {
            // Try to use the more advanced approach with transpiler (like minimal-repl example)
            // This properly handles string-to-pattern conversion
            const strudelCore = await import('@strudel/core');
            const strudelTranspiler = await import('@strudel/transpiler');
            const strudelWebaudio = await import('@strudel/webaudio');

            const { repl, evalScope, setTime } = strudelCore;
            // Ensure getTime() has a value before @strudel/draw runs (repl overwrites with scheduler.now() on evaluate)
            if (typeof setTime === 'function') setTime(() => 0);
            const { transpiler } = strudelTranspiler;
            this.strudelTranspiler = transpiler;
            const { getAudioContext, webaudioOutput, initAudioOnFirstClick, registerSynthSounds } = strudelWebaudio;

            // Initialize audio context
            const ctx = getAudioContext();
            initAudioOnFirstClick();
            // Register default synths (sawtooth, sine, triangle, square, etc.) so .s("sawtooth") etc. work
            registerSynthSounds();

            // Use same strudelCore so draw package and patches share one instance
            await evalScope(
                strudelCore,
                import('@strudel/mini'),
                import('@strudel/webaudio'),
                import('@strudel/tonal'),
                import('@strudel/draw')
            );

            // Provide a hidden default canvas so getDrawContext() (no args) never creates the visible fullscreen one
            if (!document.getElementById('test-canvas')) {
                const defaultCanvas = document.createElement('canvas');
                defaultCanvas.id = 'test-canvas';
                defaultCanvas.width = 1;
                defaultCanvas.height = 1;
                defaultCanvas.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;pointer-events:none;visibility:hidden';
                document.body.appendChild(defaultCanvas);
            }

            // Wrap Pattern.prototype.draw to log errors and haps count (diagnostic)
            const { Pattern } = strudelCore;
            const origDraw = Pattern.prototype.draw;
            if (typeof origDraw === 'function') {
                Pattern.prototype.draw = function (fn, options) {
                    const wrappedFn = (...args) => fn(...args);
                    try {
                        return origDraw.call(this, wrappedFn, options);
                    } catch (e) {
                        console.warn('[StrudelApp] draw() error (getTime or queryArc may have failed):', e);
                        return this;
                    }
                };
            }
            // Create repl with transpiler; afterEval/onToggle for active-tag highlighting in CodeMirror
            const self = this;
            const { evaluate, stop, scheduler } = repl({
                defaultOutput: webaudioOutput,
                getTime: () => ctx.currentTime,
                transpiler,
                afterEval: (options) => {
                    if (self.cmView && options.meta?.miniLocations != null && self.strudelTranspiler) {
                        self._applyEditorMiniLocationsAndMap(options.meta.miniLocations);
                    }
                },
                onToggle: (started) => {
                    if (started) self.startHighlightLoop();
                    else self.stopHighlightLoop();
                },
            });

            // Store evaluate, stop, and scheduler for later use
            this.strudelEvaluate = evaluate;
            this.strudelStop = stop;
            this.strudelScheduler = scheduler;
            this.audioContext = ctx;

            await this.initializeStrudelEditor();
            await this.loadDefaultSamplePacks();
            console.log('[StrudelApp] Strudel initialized with transpiler');
        } catch (error) {
            console.warn('[StrudelApp] Failed to load Strudel from node_modules:', error);
            console.warn('[StrudelApp] Run "npm run build:strudel" then "npm start" to use the bundled Strudel and CodeMirror.');
            await this.initializeStrudelEditor();
        }
    }

    /**
     * Default sample packs to load so built-in sounds (bd, sd, hh, gtr, moog, etc.) work without adding samples() in user code.
     * Use github:user/repo or a full URL to a strudel.json. GM sounds (gm_epiano1, gm_acoustic_bass) come from VCSL on
     * strudel.cc; VCSL does not expose a public strudel.json, so we only load packs that do (e.g. dirt-samples).
     */
    static get DEFAULT_SAMPLE_PACKS() {
        return [
            'github:tidalcycles/dirt-samples',
        ];
    }

    /**
     * Load default sample packs so drums and common sounds are available without adding samples() in user code.
     * Packs that fail (e.g. no strudel.json) are skipped with a warning.
     */
    async loadDefaultSamplePacks() {
        if (!this.strudelEvaluate) return;
        const packs = this.constructor.DEFAULT_SAMPLE_PACKS;
        for (const pack of packs) {
            try {
                await this.strudelEvaluate(`await samples('${pack}');`, false);
                console.log('[StrudelApp] Loaded default sample pack:', pack);
            } catch (e) {
                console.warn('[StrudelApp] Could not load default sample pack', pack, e?.message || e);
            }
        }
    }

    /**
     * Initialize the Strudel editor after Strudel is available.
     */
    async initializeStrudelEditor() {
        try {
            await this.restoreOpenFiles();
            if (!this.strudelEvaluate && typeof initStrudel === 'function') {
                this.strudelInstance = initStrudel({});
            }

            const root = document.getElementById('strudel-cm-root');
            const textarea = document.getElementById('strudel-editor');
            if (!root || !textarea) {
                console.warn('[StrudelApp] strudel-cm-root or strudel-editor not found');
                return;
            }

            const activeDoc = this.activeDocumentId
                ? this.openDocuments.find((d) => d.id === this.activeDocumentId)
                : null;
            const initialCode = activeDoc ? activeDoc.content : '';

            try {
                const { initEditor } = await import('@strudel/codemirror');
                const self = this;
                this.cmView = initEditor({
                    root,
                    initialCode,
                    onChange: (v) => {
                        if (v.docChanged) {
                            self.onStrudelUpdate();
                            self.syncEditorToActiveDocument();
                        }
                    },
                    onEvaluate: () => this.playStrudelContent(),
                    onStop: () => this.stopStrudelContent(),
                });

                root.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                        e.preventDefault();
                        self.saveStrudelContent();
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                        e.preventDefault();
                        console.log('[StrudelApp] Ctrl+/ detected on root, calling toggleComments');
                        self.toggleComments();
                    }
                });

                root.addEventListener('click', (e) => {
                    if (!self.cmView) return;
                    const pos = self.cmView.posAtCoords({ x: e.clientX, y: e.clientY });
                    if (pos == null) return;
                    const word = getWordAtPos(self.cmView, pos);
                    if (word && STRUDEL_DOCS[word.name] != null) {
                        self.showDoc(word.name);
                    }
                });

                textarea.style.display = 'none';
                console.log('[StrudelApp] Strudel editor initialized (CodeMirror)');
            } catch (cmError) {
                console.warn('[StrudelApp] CodeMirror not available, using textarea:', cmError);
                root.style.display = 'none';
                textarea.style.display = 'block';
                const self = this;
                textarea.addEventListener('input', () => {
                    self.onStrudelUpdate();
                    self.syncEditorToActiveDocument();
                });
                textarea.addEventListener('change', () => {
                    self.onStrudelUpdate();
                    self.syncEditorToActiveDocument();
                });
                textarea.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                        e.preventDefault();
                        self.saveStrudelContent();
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                        e.preventDefault();
                        console.log('[StrudelApp] Ctrl+/ detected on textarea, calling toggleComments');
                        self.toggleComments();
                    }
                });
                this.setEditorContent(initialCode);
                console.log('[StrudelApp] Strudel editor initialized (textarea fallback)');
            }
        } catch (error) {
            console.error('[StrudelApp] Error initializing Strudel editor:', error);
        }
    }

    /**
     * Return the editor element for measurements/scroll (textarea or CodeMirror adapter).
     */
    getEditorElement() {
        if (this.cmView) {
            if (!this._cmEditorAdapter) {
                const view = this.cmView;
                const scroller = view.dom.querySelector('.cm-scroller');
                this._cmEditorAdapter = {
                    get value() {
                        return view.state.doc.toString();
                    },
                    get scrollTop() {
                        return scroller ? scroller.scrollTop : 0;
                    },
                    get scrollLeft() {
                        return scroller ? scroller.scrollLeft : 0;
                    },
                    contentDOM: view.contentDOM,
                    closest(sel) {
                        return view.dom.closest(sel);
                    },
                    addEventListener(ev, fn) {
                        if (scroller && ev === 'scroll') scroller.addEventListener(ev, fn);
                        else view.dom.addEventListener(ev, fn);
                    },
                    removeEventListener(ev, fn) {
                        if (scroller && ev === 'scroll') scroller.removeEventListener(ev, fn);
                        else view.dom.removeEventListener(ev, fn);
                    },
                };
            }
            return this._cmEditorAdapter;
        }
        return document.getElementById('strudel-editor');
    }

    /**
     * Show documentation for a Strudel function in the docs panel.
     * @param {string} name - function name (e.g. s, fit, slice, gain)
     */
    showDoc(name) {
        const placeholder = document.querySelector('.strudel-docs-placeholder');
        const contentEl = document.getElementById('strudel-docs-content');
        if (!placeholder || !contentEl) return;
        const doc = STRUDEL_DOCS[name];
        if (!doc) {
            placeholder.hidden = false;
            contentEl.hidden = true;
            return;
        }
        placeholder.hidden = true;
        contentEl.hidden = false;
        contentEl.innerHTML = '';
        const nameEl = document.createElement('div');
        nameEl.className = 'strudel-docs-name';
        nameEl.textContent = name + '()';
        contentEl.appendChild(nameEl);
        const summaryEl = document.createElement('div');
        summaryEl.textContent = doc.summary;
        contentEl.appendChild(summaryEl);
        if (doc.link) {
            this.showDocInIframe(doc.link);
        }
    }

    /**
     * Load documentation URL in the docs iframe. Hash in URL (e.g. #fit) scrolls to that section.
     * @param {string} url - full URL including hash, e.g. https://strudel.cc/learn/samples/#fit
     */
    showDocInIframe(url) {
        const iframe = document.getElementById('strudel-docs-iframe');
        if (!iframe) return;
        iframe.src = url;
        iframe.hidden = false;
    }

    /**
     * Called when the editor content changes.
     * Checks for samples() calls and loads missing samples.
     */
    onStrudelUpdate() {
        try {
            const code = this.getEditorContent();
            if (code === null) return;
            if (!code.trim()) return;

            // Parse code to find all samples() calls
            const samplesRegex = /samples\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
            const foundSamples = [];
            let match;
            
            while ((match = samplesRegex.exec(code)) !== null) {
                foundSamples.push(match[1]);
            }

            // Check and load each sample
            for (const samplePath of foundSamples) {
                this.checkAndLoadSample(samplePath);
            }
        } catch (error) {
            console.warn('[StrudelApp] Error in onStrudelUpdate:', error);
        }
    }

    /**
     * Check if a sample is loaded and load it if not
     */
    async checkAndLoadSample(samplePath) {
        try {
            // Check if samples function is available
            if (typeof samples === 'undefined') {
                console.warn('[StrudelApp] samples function not available yet');
                return;
            }

            // Try to access the samples map if available
            // Strudel may expose the samples map globally or through the strudel instance
            let sampleMap = null;
            
            // Try different ways to access the samples map
            if (typeof getSamples === 'function') {
                sampleMap = getSamples();
            } else if (window.samplesMap) {
                sampleMap = window.samplesMap;
            } else if (this.strudelInstance && this.strudelInstance.samples) {
                sampleMap = this.strudelInstance.samples;
            }

            // Check if sample is already in the map
            const sampleKey = samplePath.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const isLoaded = sampleMap && (sampleMap.has(samplePath) || sampleMap.has(sampleKey) || sampleMap[samplePath] || sampleMap[sampleKey]);

            if (!isLoaded) {
                // Sample not loaded, load it
                console.log(`[StrudelApp] Loading sample: ${samplePath}`);
                try {
                    // Call samples() to load the sample
                    // This should trigger loading if not already loaded
                    const result = samples(samplePath);
                    // If samples() returns a promise, await it
                    if (result && typeof result.then === 'function') {
                        await result;
                    }
                    console.log(`[StrudelApp] Sample loaded: ${samplePath}`);
                } catch (error) {
                    console.warn(`[StrudelApp] Could not load sample ${samplePath}:`, error);
                }
            } else {
                console.log(`[StrudelApp] Sample already loaded: ${samplePath}`);
            }
        } catch (error) {
            console.warn(`[StrudelApp] Error checking/loading sample ${samplePath}:`, error);
            // Fallback: try to load it anyway
            try {
                if (typeof samples === 'function') {
                    samples(samplePath);
                }
            } catch (e) {
                // Ignore errors in fallback
            }
        }
    }

    /**
     * Initialize save, load, play, stop, and update button handlers
     */
    initSaveLoadButtons() {
        const playBtn = document.getElementById('playBtn');
        const stopBtn = document.getElementById('stopBtn');
        const updateBtn = document.getElementById('updateBtn');
        const saveBtn = document.getElementById('saveBtn');
        const openBtn = document.getElementById('openBtn');

        if (playBtn) {
            playBtn.addEventListener('click', () => this.playStrudelContent());
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopStrudelContent());
        }

        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.updateStrudelContent());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveStrudelContent());
        }

        if (openBtn) {
            openBtn.addEventListener('click', () => this.openDocument());
        }

        const newBtn = document.getElementById('newBtn');
        if (newBtn) {
            newBtn.addEventListener('click', () => this.openNewUntitled());
        }

        // Start with one untitled document if none (restoreOpenFiles may have already loaded persisted files)
        if (this.openDocuments.length === 0) {
            this._untitledCounter += 1;
            const doc = createDocument('untitled-' + this._untitledCounter, null, 'Untitled', '');
            this.openDocuments.push(doc);
            this.activeDocumentId = doc.id;
        }
        this.renderOpenDocs();

        window.addEventListener('beforeunload', () => this.persistOpenFiles());
    }

    /**
     * Restore open files from persisted state (called early in initializeStrudelEditor).
     */
    async restoreOpenFiles() {
        if (!window.electron || typeof window.electron.getStrudelOpenFiles !== 'function') return;
        try {
            const state = await window.electron.getStrudelOpenFiles();
            if (!state.openFilePaths || state.openFilePaths.length === 0) return;
            this.openDocuments = [];
            for (const filePath of state.openFilePaths) {
                const readResult = await window.electron.readFile(filePath);
                if (!readResult.success) continue;
                const name = filePath.split(/[/\\]/).pop() || 'Untitled';
                const doc = createDocument(filePath, filePath, name, readResult.content);
                this.openDocuments.push(doc);
            }
            if (this.openDocuments.length === 0) return;
            const activeDoc = state.activeFilePath
                ? this.openDocuments.find((d) => d.filePath === state.activeFilePath)
                : null;
            this.activeDocumentId = (activeDoc || this.openDocuments[0]).id;
            this.renderOpenDocs();
        } catch (e) {
            console.warn('[StrudelApp] Restore open files failed:', e);
        }
    }

    /**
     * Persist open file paths and active tab for next run.
     */
    persistOpenFiles() {
        if (!window.electron || typeof window.electron.setStrudelOpenFiles !== 'function') return;
        try {
            const openFilePaths = this.openDocuments.filter((d) => d.filePath).map((d) => d.filePath);
            const activeDoc = this.activeDocumentId
                ? this.openDocuments.find((d) => d.id === this.activeDocumentId)
                : null;
            const activeFilePath = activeDoc?.filePath ?? null;
            window.electron.setStrudelOpenFiles({ openFilePaths, activeFilePath });
        } catch (e) {
            console.warn('[StrudelApp] Persist open files failed:', e);
        }
    }

    /**
     * Sync editor content to the active document and update unsaved state
     */
    syncEditorToActiveDocument() {
        const content = this.getEditorContent();
        if (content === null || !this.activeDocumentId) return;
        const doc = this.openDocuments.find((d) => d.id === this.activeDocumentId);
        if (!doc) return;
        doc.content = content;
        doc.unsaved = content !== doc.lastSavedContent;
        this.renderOpenDocs();
    }

    /**
     * Switch to a document by id (save current editor to current doc, load doc into editor).
     * File change (undo/redo) history is scoped per tab: we save/restore CodeMirror state per document.
     */
    switchDocument(docId) {
        if (docId === this.activeDocumentId) return;
        this.stopStrudelContent();
        this.syncEditorToActiveDocument();
        if (this.activeDocumentId && this.cmView) {
            this._docEditorStates.set(this.activeDocumentId, this.cmView.state);
        }
        const doc = this.openDocuments.find((d) => d.id === docId);
        if (!doc) return;
        this.activeDocumentId = docId;
        const stored = this._docEditorStates.get(docId);
        if (this.cmView && stored) {
            this.cmView.setState(stored);
        } else {
            this.setEditorContent(doc.content);
        }
        this.syncEditorToActiveDocument();
        this.renderOpenDocs();
        this.persistOpenFiles();
    }

    /**
     * Close a document tab (remove from open list, switch away if it was active).
     */
    closeDocument(docId) {
        const index = this.openDocuments.findIndex((d) => d.id === docId);
        if (index === -1) return;
        this._docEditorStates.delete(docId);
        const wasActive = this.activeDocumentId === docId;
        this.openDocuments.splice(index, 1);
        if (this.openDocuments.length === 0) {
            this.activeDocumentId = null;
            this.setEditorContent('');
            this.stopStrudelContent();
        } else if (wasActive) {
            const next = this.openDocuments[Math.min(index, this.openDocuments.length - 1)];
            this.switchDocument(next.id);
            return;
        }
        this.renderOpenDocs();
        this.persistOpenFiles();
    }

    /**
     * Start inline rename of a tab: replace label span with a text input; on blur commit the new name.
     */
    startTabRename(tab, doc) {
        const label = tab.querySelector('.strudel-doc-tab-label');
        if (!label || tab.querySelector('.strudel-doc-tab-rename-input')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'strudel-doc-tab-rename-input';
        input.value = doc.name;
        input.setAttribute('aria-label', 'Rename tab');
        let committed = false;
        const commit = async () => {
            if (committed) return;
            committed = true;
            const raw = input.value.trim();
            const previousName = doc.name;
            input.removeEventListener('blur', onBlur);
            input.removeEventListener('keydown', onKeydown);
            if (raw) {
                if (doc.filePath && typeof window.electron.renameFile === 'function') {
                    const result = await window.electron.renameFile(doc.filePath, raw);
                    if (result && result.success && result.newFilePath) {
                        doc.filePath = result.newFilePath;
                        doc.name = result.newFilePath.split(/[/\\]/).pop() || raw;
                    } else {
                        doc.name = raw;
                    }
                } else {
                    doc.name = raw;
                }
            }
            tab.title = doc.filePath || doc.name;
            const label = document.createElement('span');
            label.className = 'strudel-doc-tab-label';
            label.textContent = doc.name;
            if (doc.id === this.activeDocumentId) {
                label.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.startTabRename(tab, doc);
                });
            }
            tab.replaceChild(label, input);
            this.persistOpenFiles();
            if (raw && raw !== previousName) {
                console.log('[StrudelApp] Tab/file renamed:', previousName, '→', doc.name);
            }
        };
        const onBlur = () => commit();
        const onKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                input.value = doc.name;
                input.blur();
            }
        };
        input.addEventListener('blur', onBlur);
        input.addEventListener('keydown', onKeydown);
        tab.replaceChild(input, label);
        input.focus();
        input.select();
    }

    /**
     * Reorder open documents: move the doc with fromDocId to the position of the doc with toDocId.
     */
    reorderDocumentTab(fromDocId, toDocId) {
        if (fromDocId === toDocId) return;
        const fromIndex = this.openDocuments.findIndex((d) => d.id === fromDocId);
        const toIndex = this.openDocuments.findIndex((d) => d.id === toDocId);
        if (fromIndex === -1 || toIndex === -1) return;
        const [doc] = this.openDocuments.splice(fromIndex, 1);
        // After removal: when moving left→right, target shifted down; insert at toIndex = "after target".
        // When moving right→left, target unchanged; insert at toIndex = "before target".
        const insertIndex = toIndex;
        this.openDocuments.splice(insertIndex, 0, doc);
        this.renderOpenDocs();
        this.persistOpenFiles();
    }

    /**
     * Render open documents as tabs in the header
     */
    renderOpenDocs() {
        const container = document.getElementById('strudel-open-docs');
        if (!container) return;
        container.textContent = '';
        this.openDocuments.forEach((doc) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.draggable = true;
            tab.className = 'strudel-doc-tab' + (doc.id === this.activeDocumentId ? ' active' : '') + (doc.unsaved ? ' unsaved' : '');
            tab.title = doc.filePath || doc.name;
            tab.setAttribute('data-doc-id', doc.id);
            tab.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                this._draggingDocId = doc.id;
                e.dataTransfer.setData('application/x-strudel-doc-id', doc.id);
                e.dataTransfer.effectAllowed = 'move';
                tab.classList.add('strudel-doc-tab-dragging');
            });
            tab.addEventListener('dragend', () => {
                this._draggingDocId = null;
                tab.classList.remove('strudel-doc-tab-dragging');
                document.querySelectorAll('.strudel-doc-tab-drag-over').forEach((el) => el.classList.remove('strudel-doc-tab-drag-over'));
            });
            const allowDrop = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                if (e.dataTransfer.types.includes('application/x-strudel-doc-id') && doc.id !== this._draggingDocId) {
                    tab.classList.add('strudel-doc-tab-drag-over');
                }
            };
            tab.addEventListener('dragenter', allowDrop);
            tab.addEventListener('dragover', allowDrop);
            tab.addEventListener('dragleave', (e) => {
                if (!tab.contains(e.relatedTarget)) {
                    tab.classList.remove('strudel-doc-tab-drag-over');
                }
            });
            tab.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                tab.classList.remove('strudel-doc-tab-drag-over');
                const draggedDocId = e.dataTransfer.getData('application/x-strudel-doc-id');
                if (draggedDocId && draggedDocId !== doc.id) {
                    this.reorderDocumentTab(draggedDocId, doc.id);
                    this._dragJustHappened = true;
                }
            });
            const label = document.createElement('span');
            label.className = 'strudel-doc-tab-label';
            label.textContent = doc.name;
            if (doc.id === this.activeDocumentId) {
                label.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.startTabRename(tab, doc);
                });
            }
            tab.appendChild(label);
            const closeBtn = document.createElement('span');
            closeBtn.className = 'strudel-doc-tab-close';
            closeBtn.setAttribute('aria-label', 'Close tab');
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeDocument(doc.id);
            });
            tab.appendChild(closeBtn);
            tab.addEventListener('click', (e) => {
                if (e.target.closest('.strudel-doc-tab-close')) return;
                if (e.target.closest('.strudel-doc-tab-rename-input')) return;
                if (this._dragJustHappened) {
                    this._dragJustHappened = false;
                    return;
                }
                this.switchDocument(doc.id);
            });
            container.appendChild(tab);
        });
    }


    /**
     * Toggle comments on selected lines (Ctrl+/ or Cmd+/)
     * CodeMirror path: we apply line-comment toggle ourselves so it works regardless of language commentTokens.
     *
     * Comment characters are defined here (single place for both CodeMirror and textarea paths):
     */
    static get LINE_COMMENT_PREFIX() {
        return '//';  // literal two slashes; used when adding/removing line comments
    }

    toggleComments() {
        const commentPrefix = this.constructor.LINE_COMMENT_PREFIX;
        const log = (msg, data) => console.log('[StrudelApp] toggleComments:', msg, data !== undefined ? data : '');

        if (this.cmView) {
            log('path=CodeMirror', { commentPrefix: JSON.stringify(commentPrefix) });

            const { state, dispatch } = this.cmView;
            const doc = state.doc;
            const { from, to } = state.selection.main;
            const startLine = doc.lineAt(from);
            const endLine = doc.lineAt(to);
            const block = doc.sliceString(startLine.from, endLine.to);
            const lines = block.split('\n');

            log('targeting range', {
                selection: { from, to },
                replaceRange: { from: startLine.from, to: endLine.to },
                docLineNumbers: { start: startLine.number, end: endLine.number },
                lineCount: lines.length,
                blockLength: block.length,
            });

            const prefixEscaped = commentPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const uncommentRegex = new RegExp(`^(\\s*)${prefixEscaped}`);

            // If any non-empty line is uncommented → comment all; otherwise → uncomment all
            const anyLineUncommented = lines.some((l) => {
                const t = l.trim();
                return t && !t.startsWith(commentPrefix);
            });
            const hasAnyContent = lines.some((l) => l.trim());

            const shouldComment = !anyLineUncommented;

            const linesBeingCommented = [];
            const linesBeingUncommented = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                const docLineNum = startLine.number + i;
                const preview = line.slice(0, 50).replace(/\n/g, '\\n');
                if (shouldComment) {
                    if (trimmed && !trimmed.startsWith(commentPrefix)) {
                        linesBeingCommented.push({ docLineNumber: docLineNum, blockIndex: i, preview });
                    }
                } else {
                    if (trimmed.startsWith(commentPrefix)) {
                        linesBeingUncommented.push({ docLineNumber: docLineNum, blockIndex: i, preview });
                    }
                }
            }

            log('comment state', { anyLineUncommented, shouldComment, hasAnyContent });
            if (shouldComment) {
                log('lines being commented', linesBeingCommented);
            } else {
                log('lines being uncommented', linesBeingUncommented);
            }

            if (!hasAnyContent) {
                log('early return: no content in selected lines');
                return;
            }

            const newLines = lines.map((line) => {
                const trimmed = line.trim();
                if (shouldComment) {
                    // Add commentPrefix to each non-empty line that doesn't have it
                    if (trimmed && !trimmed.startsWith(commentPrefix)) {
                        const indent = line.match(/^(\s*)/)[0];
                        return indent + commentPrefix + line.slice(indent.length);
                    }
                    return line;
                }
                // Remove commentPrefix from each line that has it
                if (trimmed.startsWith(commentPrefix)) {
                    return line.replace(uncommentRegex, '$1');
                }
                return line;
            });

            const newText = newLines.join('\n');
            const action = shouldComment ? 'comment' : 'uncomment';
            log('dispatching', {
                action,
                replaceRange: { from: startLine.from, to: endLine.to },
                insertLength: newText.length,
                sampleBefore: lines[0]?.slice(0, 60),
                sampleAfter: newLines[0]?.slice(0, 60),
            });
            dispatch({
                changes: { from: startLine.from, to: endLine.to, insert: newText },
            });
            return;
        }

        log('path=textarea', { commentPrefix: JSON.stringify(commentPrefix) });

        const textarea = this.getEditorElement();
        if (!textarea) {
            log('early return: no editor element');
            return;
        }
        if (this.cmView) return; // already handled at top

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const lines = text.split('\n');

        // Find which lines are selected
        let startLine = 0;
        let endLine = lines.length - 1;
        let charCount = 0;

        const lineStartOffsets = [];
        for (let i = 0; i < lines.length; i++) {
            lineStartOffsets.push(charCount);
            const lineLength = lines[i].length + 1; // +1 for newline
            if (charCount + lines[i].length >= start && startLine === 0) {
                startLine = i;
            }
            if (charCount + lines[i].length >= end) {
                endLine = i;
                break;
            }
            charCount += lineLength;
        }

        // If any non-empty line is uncommented → comment all; otherwise → uncomment all
        let anyLineUncommented = false;
        let hasAnyContent = false;
        for (let i = startLine; i <= endLine; i++) {
            const trimmed = lines[i].trim();
            if (trimmed && !trimmed.startsWith(commentPrefix)) {
                anyLineUncommented = true;
            }
            if (trimmed) {
                hasAnyContent = true;
            }
        }

        const shouldComment = anyLineUncommented;

        const textareaLinesBeingCommented = [];
        const textareaLinesBeingUncommented = [];
        for (let i = startLine; i <= endLine; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            const preview = line.slice(0, 50).replace(/\n/g, '\\n');
            if (shouldComment) {
                if (trimmed && !trimmed.startsWith(commentPrefix)) {
                    textareaLinesBeingCommented.push({ lineIndex: i, lineStartChar: lineStartOffsets[i], preview });
                }
            } else {
                if (trimmed.startsWith(commentPrefix)) {
                    textareaLinesBeingUncommented.push({ lineIndex: i, lineStartChar: lineStartOffsets[i], preview });
                }
            }
        }

        log('targeting range', {
            selection: { start, end },
            lineRange: { startLineIndex: startLine, endLineIndex: endLine, totalLines: lines.length },
            startLineCharOffset: lineStartOffsets[startLine],
            endLineCharOffset: lineStartOffsets[endLine] != null ? lineStartOffsets[endLine] : charCount,
            anyLineUncommented,
            shouldComment,
            hasAnyContent,
        });
        if (shouldComment) {
            log('lines being commented', textareaLinesBeingCommented);
        } else {
            log('lines being uncommented', textareaLinesBeingUncommented);
        }

        if (!hasAnyContent) {
            log('early return: no content in selected lines');
            return;
        }

        const prefixEscaped = commentPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const uncommentRegex = new RegExp(`^(\\s*)${prefixEscaped}`);

        const action = shouldComment ? 'comment' : 'uncomment';
        log('applying', { action, lineRange: `${startLine}-${endLine}` });

        const newLines = [...lines];
        let newStart = start;
        let newEnd = end;
        let offset = 0;

        for (let i = startLine; i <= endLine; i++) {
            const line = newLines[i];
            const trimmed = line.trim();

            if (shouldComment) {
                // Add commentPrefix to each non-empty line that doesn't have it
                if (trimmed && !trimmed.startsWith(commentPrefix)) {
                    const indent = line.match(/^(\s*)/)[0];
                    const commented = indent + commentPrefix + line.slice(indent.length);
                    const lineOffset = commented.length - line.length;
                    newLines[i] = commented;
                    if (i === startLine) {
                        offset += lineOffset;
                    }
                }
            } else {
                // Remove commentPrefix from each line that has it
                if (trimmed.startsWith(commentPrefix)) {
                    const uncommented = line.replace(uncommentRegex, '$1');
                    const lineOffset = line.length - uncommented.length;
                    newLines[i] = uncommented;
                    if (i === startLine) {
                        offset -= lineOffset;
                    }
                }
            }
        }

        // Update textarea content
        const newText = newLines.join('\n');
        textarea.value = newText;

        // Restore selection (adjust for added/removed characters)
        newStart = Math.max(0, start + offset);
        newEnd = Math.max(newStart, end + offset);
        textarea.setSelectionRange(newStart, newEnd);

        // Trigger update
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    getEditorContent() {
        if (this.cmView) return this.cmView.state.doc.toString();
        const ta = document.getElementById('strudel-editor');
        if (ta && ta.tagName === 'TEXTAREA') return ta.value || '';
        return null;
    }

    setEditorContent(content) {
        if (this.cmView) {
            const text = content != null ? String(content) : '';
            this.cmView.dispatch({
                changes: { from: 0, to: this.cmView.state.doc.length, insert: text },
            });
            return true;
        }
        const ta = document.getElementById('strudel-editor');
        if (!ta || ta.tagName !== 'TEXTAREA') return false;
        const text = content != null ? String(content) : '';
        ta.value = text;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    /**
     * Get the current content from the editor (TinyMCE or textarea).
     */
    async getStrudelContent() {
        const content = this.getEditorContent();
        if (content === null) {
            console.warn('[StrudelApp] No editor found');
            return null;
        }
        return content;
    }

    /**
     * Set content in the editor (TinyMCE or textarea).
     */
    async setStrudelContent(content) {
        const ok = this.setEditorContent(content);
        if (!ok) console.warn('[StrudelApp] Could not set editor content');
        return ok;
    }

    /**
     * Parse editor content into pattern blocks with segment mapping (patternCode offset -> document offset).
     * Used to map playCode mini locations (from repl) to editor positions for correct highlight.
     * @param {string} code - Full editor document content
     * @returns {{ code: string, segments: Array<{ patternFrom: number, patternTo: number, docFrom: number, docTo: number }> }[]}
     */
    getDollarBlocksWithSegments(code) {
        return strudelParse.getDollarBlocksWithSegments(code);
    }

    /**
     * Map a range [from, to] in patternCode to document range using segments.
     */
    _mapPatternRangeToDoc(segments, from, to) {
        return strudelParse.mapPatternRangeToDoc(segments, from, to);
    }

    /**
     * Build setup segments (setupCode position -> doc position) from editor content.
     * Setup lines are lines that are not part of any pattern block.
     */
    _getSetupCodeAndSegments(editorContent, blocks) {
        const lines = editorContent.split('\n');
        const patternRanges = [];
        for (const block of blocks) {
            for (const seg of block.segments) {
                patternRanges.push([seg.docFrom, seg.docTo]);
            }
        }
        const isInPattern = (docFrom, docTo) =>
            patternRanges.some(([rFrom, rTo]) => docFrom < rTo && docTo > rFrom);
        const setupSegments = [];
        let setupPos = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            const beforeLine = lines.slice(0, i).join('\n').length;
            const docLineStart = beforeLine + 1;
            const docLineEnd = docLineStart + line.length;
            const leadingSpaces = line.length - line.trimStart().length;
            const docFrom = docLineStart + leadingSpaces;
            const docTo = docFrom + trimmed.length;
            if (!strudelParse.isSetupOnlyLine(trimmed) && isInPattern(docLineStart, docLineEnd)) continue;
            if (setupSegments.length > 0) setupPos += 2;
            setupSegments.push({ from: setupPos, to: setupPos + trimmed.length, docFrom, docTo });
            setupPos += trimmed.length;
        }
        return { setupSegments };
    }

    /**
     * Apply mini locations for highlighting using the Strudel REPL's implementation (@strudel/codemirror).
     *
     * The REPL evaluates raw editor content and calls updateMiniLocations(view, meta.miniLocations)
     * directly—locations are already in document space. We evaluate wrapped code (IIFE with setup +
     * return pattern), so meta.miniLocations are in codeToEval space. We map them to document
     * coordinates and then call updateMiniLocations(view, locations) exactly as the REPL does.
     *
     * The REPL expects locations as [[from, to], ...] in document space. We also build
     * _playCodeToEditorMap for the highlight loop to map hap.context.locations (codeToEval space)
     * to document space when calling highlightMiniLocations.
     */
    _applyEditorMiniLocationsAndMap(playCodeMiniLocations) {
        if (!this.cmView || !this.strudelTranspiler) return;

        const editorContent = this.cmView.state.doc.toString();
        const docLen = editorContent.length;
        const blocks = this.getDollarBlocksWithSegments(editorContent);
        const { setupSegments } = this._getSetupCodeAndSegments(editorContent, blocks);

        const playCodeStart = this._playCodeOffsetInCodeToEval ?? 0;
        const setupCodeStart = this._setupCodeStartInCodeToEval ?? -1;
        const setupCodeEnd = setupCodeStart >= 0 && playCodeStart > setupCodeStart
            ? playCodeStart - ';\nreturn ('.length
            : -1;

        const originalPlayCode = blocks.length === 1
            ? blocks[0].code
            : 'stack(' + blocks.map((b) => b.code).join(',\n') + ')';

        const [storedPlayStart, storedPlayEnd] = this._lastPlayCodeRange ?? [0, originalPlayCode.length];
        const actualPlayCode = this._lastCodeToEval
            ? this._lastCodeToEval.slice(storedPlayStart, storedPlayEnd)
            : originalPlayCode;

        const blockOffsets = [];
        let pos = blocks.length === 1 ? 0 : 7;
        for (const block of blocks) {
            blockOffsets.push(pos);
            pos += block.code.length + (blocks.length === 1 ? 0 : 2);
        }
        const playCodeLen = actualPlayCode.length;

        const playCodeToEditorMap = new Map();
        const docLocations = [];
        const addDocLocation = (from, to, codeToEvalKey = null) => {
            const f = Math.max(0, Math.min(from, docLen));
            const t = Math.max(f, Math.min(to, docLen));
            if (f >= t) return;
            const pair = [f, t];
            docLocations.push(pair);
            if (codeToEvalKey != null) {
                playCodeToEditorMap.set(codeToEvalKey, { start: f, end: t });
            }
        };

        /** Normalize location to [from, to] from various formats. */
        const norm = (loc) => {
            if (Array.isArray(loc)) return [loc[0], loc[1]];
            const f = loc?.from ?? loc?.start;
            const t = loc?.to ?? loc?.end;
            return [f, t];
        };

        /** Map a codeToEval range to document, store mapping, and add to docLocations. */
        const mapCodeToEvalToDoc = (pcFrom, pcTo) => {
            const key = `${pcFrom}:${pcTo}`;

            if (setupCodeStart >= 0 && setupCodeEnd >= 0 && pcFrom >= setupCodeStart && pcTo <= setupCodeEnd) {
                const localFrom = pcFrom - setupCodeStart;
                const localTo = pcTo - setupCodeStart;
                for (const seg of setupSegments) {
                    if (localFrom >= seg.from && localTo <= seg.to) {
                        const docFrom = seg.docFrom + (localFrom - seg.from);
                        const docTo = seg.docTo - (seg.to - localTo);
                        addDocLocation(docFrom, docTo, key);
                        return;
                    }
                }
                return;
            }

            if (playCodeStart <= 0 || pcFrom < playCodeStart || pcTo > playCodeStart + playCodeLen) return;

            let localFrom = pcFrom - playCodeStart;
            let localTo = pcTo - playCodeStart;
            [localFrom, localTo] = this._mapActualPlayCodeRangeToOriginal(actualPlayCode, originalPlayCode, localFrom, localTo);

            let bi = -1;
            for (let b = 0; b < blocks.length; b++) {
                const blockStart = blockOffsets[b];
                const blockEnd = b + 1 < blocks.length ? blockOffsets[b + 1] - 2 : originalPlayCode.length;
                if (localFrom >= blockStart && localTo <= blockEnd) {
                    bi = b;
                    break;
                }
            }
            if (bi < 0) return;

            const block = blocks[bi];
            const blockStart = blockOffsets[bi];
            const blockLen = block.code.length;
            const blFrom = Math.max(0, Math.min(localFrom - blockStart, blockLen));
            const blTo = Math.max(blFrom, Math.min(localTo - blockStart, blockLen));
            const [docFrom, docTo] = this._mapPatternRangeToDoc(block.segments, blFrom, blTo);
            addDocLocation(docFrom, docTo, key);
        };

        for (const loc of playCodeMiniLocations || []) {
            const [pcFrom, pcTo] = norm(loc);
            if (pcFrom == null || pcTo == null) continue;
            mapCodeToEvalToDoc(pcFrom, pcTo);
        }

        for (const seg of setupSegments) {
            const lineCode = editorContent.slice(seg.docFrom, seg.docTo);
            if (!/chord\s*\(|\.dict\s*\(/.test(lineCode)) continue;
            try {
                const { miniLocations: setupLocs } = this.strudelTranspiler(lineCode, { emitMiniLocations: true });
                if (!setupLocs?.length) continue;
                for (const r of setupLocs) {
                    const [from, to] = norm(r);
                    if (from == null || to == null) continue;
                    addDocLocation(seg.docFrom + from, seg.docFrom + to);
                }
            } catch (_) {
                /* setup line may not be valid pattern code */
            }
        }

        for (const block of blocks) {
            try {
                const { miniLocations: blockLocs } = this.strudelTranspiler(block.code, { emitMiniLocations: true });
                if (!blockLocs?.length) continue;
                for (const r of blockLocs) {
                    const [from, to] = norm(r);
                    if (from == null || to == null) continue;
                    const [docFrom, docTo] = this._mapPatternRangeToDoc(block.segments, from, to);
                    addDocLocation(docFrom, docTo);
                }
            } catch (_) {
                /* block might not be valid JS */
            }
        }

        this._playCodeToEditorMap = playCodeToEditorMap;

        const seen = new Set();
        const unique = docLocations.filter(([from, to]) => {
            const k = `${from}:${to}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });

        import('@strudel/codemirror').then(({ updateMiniLocations }) => {
            updateMiniLocations(this.cmView, unique);
        });
    }

    /**
     * True if the line is setup-only (not a pattern to play).
     */
    isSetupOnlyLine(trimmed) {
        return strudelParse.isSetupOnlyLine(trimmed);
    }

    /**
     * Parse editor code into pattern lines and other (setup) lines.
     * Returns { dollarLines: [{ code, lineNumber, hasVisualization }], otherLines: string[] }.
     */
    parseCodeForPlay(code) {
        return strudelParse.parseCodeForPlay(code);
    }

    /**
     * Substitute GM sample names with built-in synths so chord/bass parts play when VCSL isn't loaded.
     * Applied to code before evaluate so user can keep gm_epiano1 / gm_acoustic_bass in the editor.
     */
    substituteGMWithBuiltinSynths(code) {
        if (!code || typeof code !== 'string') return code;
        return code
            .replace(/\.s\(["']gm_epiano1[^"']*["']\)/g, '.s("triangle")')
            .replace(/\.s\(["']gm_acoustic_bass["']\)/g, '.s("sawtooth")');
    }

    /**
     * Map a range [from, to] in substituted (actual) playCode back to original playCode.
     * Used when substituteGMWithBuiltinSynths has changed the evaluated code.
     */
    _mapActualPlayCodeRangeToOriginal(actualPlayCode, originalPlayCode, actualFrom, actualTo) {
        if (actualPlayCode === originalPlayCode) return [actualFrom, actualTo];
        const subs = [
            [/\.s\(["']gm_epiano1[^"']*["']\)/g, '.s("triangle")'],
            [/\.s\(["']gm_acoustic_bass["']\)/g, '.s("sawtooth")'],
        ];
        const matches = [];
        for (const [regex, repl] of subs) {
            let m;
            while ((m = regex.exec(originalPlayCode)) !== null) {
                matches.push({ start: m.index, end: m.index + m[0].length, repl });
            }
        }
        matches.sort((a, b) => a.start - b.start);
        const map = [];
        let oPos = 0;
        let aPos = 0;
        for (const { start, end, repl } of matches) {
            while (oPos < start) {
                map[aPos] = { from: oPos, to: oPos + 1 };
                aPos++;
                oPos++;
            }
            const contentPrefixLen = 4;
            const contentSuffixLen = 2;
            const origContentFrom = start + contentPrefixLen;
            const origContentTo = end - contentSuffixLen;
            for (let i = 0; i < repl.length; i++) {
                map[aPos] = { from: origContentFrom, to: origContentTo };
                aPos++;
            }
            oPos = end;
        }
        while (oPos < originalPlayCode.length) {
            map[aPos] = { from: oPos, to: oPos + 1 };
            aPos++;
            oPos++;
        }
        if (actualFrom >= map.length) return [actualFrom, actualTo];
        let origFrom = map[actualFrom].from;
        let origTo = actualTo > 0 && actualTo - 1 < map.length ? map[actualTo - 1].to : origFrom;
        for (let i = actualFrom; i < actualTo && i < map.length; i++) {
            origFrom = Math.min(origFrom, map[i].from);
            origTo = Math.max(origTo, map[i].to);
        }
        return [origFrom, origTo];
    }

    /**
     * Build stack(...) play code from pattern lines and create pattern visualizations.
     * Returns the playCode string to pass to strudelEvaluate.
     */
    buildStackPlayCodeFromDollarLines(dollarLines) {
        const normalized = dollarLines.map((item, index) => {
            let s = item.code
                .replace(/\._pianoroll\b/g, '.pianoroll')
                .replace(/\._punchcard\b/g, '.punchcard')
                .replace(/\._spiral\b/g, '.spiral')
                .replace(/\._scope\b/g, '.scope')
                .replace(/\._spectrum\b/g, '.spectrum')
                .replace(/\._pitchwheel\b/g, '.pitchwheel');
            if (item.hasVisualization) {
                this.createPatternVisualization(index, item.lineNumber, s);
                const vizId = index + 1;
                const canvasId = `'strudel-viz-${index}'`;
                s = s.replace(
                    /\.(pianoroll|punchcard|spiral|scope|spectrum|pitchwheel)\s*\(([^)]*)\)/g,
                    (match, vizType, args) => {
                        let opts = '';
                        if (!args || args.trim() === '') {
                            opts = `{ ctx: getDrawContext(${canvasId}), id: ${vizId} }`;
                        } else {
                            const trimmed = args.trim();
                            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                                const inner = trimmed.slice(1, -1).trim();
                                opts = `{ ${inner ? inner + ', ' : ''}ctx: getDrawContext(${canvasId}), id: ${vizId} }`;
                            } else {
                                opts = `Object.assign(${trimmed}, { ctx: getDrawContext(${canvasId}), id: ${vizId} })`;
                            }
                        }
                        return `.tag(${vizId}).${vizType}(${opts})`;
                    }
                );
            }
            return s;
        });
        if (normalized.length === 1) return normalized[0];
        return `stack(${normalized.join(',\n')})`;
    }

    /**
     * Play/evaluate the Strudel code from the textarea.
     * Pattern lines are executed as a single stack; setup lines run in the same scope.
     */
    async playStrudelContent() {
        try {
            let code = this.getEditorContent();
            if (code === null) {
                console.warn('[StrudelApp] No editor found');
                return;
            }
            if (!code.trim()) {
                console.warn('[StrudelApp] No code to play');
                return;
            }

            // Check if Strudel is initialized (initStrudel makes functions available globally)
            if (typeof note === 'undefined' && typeof initStrudel === 'undefined') {
                console.warn('[StrudelApp] Strudel not initialized yet');
                alert('Strudel is not initialized. Please wait for it to load.');
                return;
            }

            const { dollarLines, otherLines } = this.parseCodeForPlay(code);

            // Build setup code so variables like `let chords = ...` run in the same scope as patterns.
            const setupLines = otherLines
                .map((line) => line.trim())
                .filter((trimmed) => trimmed && !trimmed.startsWith('//'));
            let setupCode = setupLines.join(';\n');

            // If user removed setcps(...), restore Strudel default (0.5 CPS = one cycle every 2 seconds)
            if (!/\bsetcps\s*\(/i.test(setupCode)) {
                setupCode = setupCode ? `setcps(0.5);\n${setupCode}` : 'setcps(0.5)';
            }

            // When using the repl with setup: we'll pass setup + pattern as one IIFE below (so let/const share scope).

            // Fallback when no repl: run setup with eval (variables will not be visible to patterns).
            if (!this.strudelEvaluate && otherLines.length > 0) {
                for (const line of otherLines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('//')) continue;
                    try {
                        const result = eval(line);
                        if (result && typeof result.then === 'function') {
                            await result;
                        }
                    } catch (error) {
                        console.warn('[StrudelApp] Setup line failed (continuing):', trimmed.slice(0, 60), error.message);
                    }
                }
                await new Promise((resolve) => setTimeout(resolve, 300));
            }

            // Clear previous visualizations (and stop their draw animation frames)
            await this.clearPatternVisualizations();

            // Execute pattern lines as a single stack
            // Following the Strudel REPL example: use stack() to combine patterns and play them together
            if (dollarLines.length > 0) {
                const vizCount = dollarLines.filter((item) => item.hasVisualization).length;
                console.log(`[StrudelApp] Found ${dollarLines.length} pattern line(s) to execute (${vizCount} with visualizations):`, dollarLines.map((item) => ({ line: item.lineNumber, hasViz: item.hasVisualization, code: item.code })));

                // If we have evaluate() from repl, use it (handles transpilation). With setup, wrap in IIFE so let/const share scope.
                if (this.strudelEvaluate) {
                    try {
                        const playCode = this.buildStackPlayCodeFromDollarLines(dollarLines);
                        let codeToEval = setupCode
                            ? `(async function(){ ${setupCode};\nreturn (${playCode}); })()`
                            : playCode;
                        codeToEval = this.substituteGMWithBuiltinSynths(codeToEval);
                        const playCodeStart = codeToEval.indexOf("return (") + "return (".length;
                        const playCodeEnd = setupCode ? codeToEval.indexOf("); })()") : codeToEval.length;
                        this._playCodeOffsetInCodeToEval = setupCode ? playCodeStart : 0;
                        this._setupCodeStartInCodeToEval = setupCode ? ('(async function(){ ').length : -1;
                        this._lastCodeToEval = codeToEval;
                        this._lastPlayCodeRange = [playCodeStart, playCodeEnd];
                        await this.strudelEvaluate(codeToEval, true);
                        if (setupCode && (setupCode.includes('samples(') || setupCode.includes('setcps('))) {
                            await new Promise((resolve) => setTimeout(resolve, 300));
                        }
                        console.log('[StrudelApp] Patterns evaluated + playing via evaluate()');
                        await this.startVizDrawerIfNeeded();
                    } catch (error) {
                        console.error(`[StrudelApp] Error evaluating patterns via evaluate():`, error);
                    }
                } else {
                    // Fallback: evaluate patterns individually with eval()
                    // Normalize _pianoroll -> pianoroll etc so visuals work (same as evaluate path)
                    const normalizeVisuals = (s) =>
                    s
                        .replace(/\._pianoroll\b/g, '.pianoroll')
                        .replace(/\._punchcard\b/g, '.punchcard')
                        .replace(/\._spiral\b/g, '.spiral')
                        .replace(/\._scope\b/g, '.scope')
                        .replace(/\._spectrum\b/g, '.spectrum')
                        .replace(/\._pitchwheel\b/g, '.pitchwheel');

                const patternObjects = [];
                dollarLines.forEach((item, index) => {
                    let code = normalizeVisuals(item.code);
                    
                    // If this pattern has a visualization, create canvas (id strudel-viz-N) and inject ctx via getDrawContext
                    let viz = null;
                    if (item.hasVisualization) {
                        viz = this.createPatternVisualization(index, item.lineNumber, code);
                        const vizId = index + 1;
                        const canvasId = `'strudel-viz-${index}'`;
                        code = code.replace(
                            /\.(pianoroll|punchcard|spiral|scope|spectrum|pitchwheel)\s*\(([^)]*)\)/g,
                            (match, vizType, args) => {
                                let opts = '';
                                if (!args || args.trim() === '') {
                                    opts = `{ ctx: getDrawContext(${canvasId}), id: ${vizId} }`;
                                } else {
                                    const trimmed = args.trim();
                                    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                                        const inner = trimmed.slice(1, -1).trim();
                                        opts = `{ ${inner ? inner + ', ' : ''}ctx: getDrawContext(${canvasId}), id: ${vizId} }`;
                                    } else {
                                        opts = `Object.assign(${trimmed}, { ctx: getDrawContext(${canvasId}), id: ${vizId} })`;
                                    }
                                }
                                return `.tag(${vizId}).${vizType}(${opts})`;
                            }
                        );
                    }
                    
                    try {
                        console.log(`[StrudelApp] Evaluating pattern ${index + 1}: ${code}`);
                            
                            const pattern = eval(code);
                            console.log(`[StrudelApp] Pattern ${index + 1} evaluation result:`, pattern);
                            
                            if (pattern && pattern._Pattern) {
                                patternObjects.push(pattern);
                                console.log(`[StrudelApp] Pattern ${index + 1} prepared: ${code.substring(0, 80)}...`);
                                
                                // Update visualization with the actual pattern
                                if (viz) {
                                    viz.pattern = pattern;
                                }
                            } else {
                                console.warn(`[StrudelApp] Pattern ${index + 1} did not return a Pattern object. Code: ${code}, Result:`, pattern);
                            }
                        } catch (error) {
                            console.error(`[StrudelApp] Error evaluating pattern ${index + 1}:`, error);
                            console.error(`[StrudelApp] Pattern code: ${code}`);
                            
                            if (error.message && error.message.includes('every is not a function')) {
                                console.log(`[StrudelApp] Attempting to fix: string needs to be converted to pattern for .every()`);
                                if (typeof m === 'function') {
                                    try {
                                        const fixedCode = normalizeVisuals(item.code).replace(/"([^"]+)"/g, 'm("$1")');
                                        console.log(`[StrudelApp] Trying fixed code: ${fixedCode}`);
                                        const fixedPattern = eval(fixedCode);
                                        if (fixedPattern && fixedPattern._Pattern) {
                                            patternObjects.push(fixedPattern);
                                            console.log(`[StrudelApp] Pattern ${index + 1} fixed and prepared`);
                                        }
                                    } catch (fixError) {
                                        console.error(`[StrudelApp] Fix attempt also failed:`, fixError);
                                    }
                                }
                            }
                        }
                    });
                    
                    console.log(`[StrudelApp] Prepared ${patternObjects.length} pattern(s) out of ${dollarLines.length} total`);
                    
                    // Use stack() to combine all patterns and play them together (like the Strudel REPL example)
                    if (patternObjects.length > 0) {
                        try {
                            // Check if stack() function is available
                            if (typeof stack === 'function') {
                                console.log(`[StrudelApp] Using stack() to combine ${patternObjects.length} pattern(s)...`);
                                const stackedPattern = stack(...patternObjects);
                                console.log(`[StrudelApp] Stacked pattern created, calling .play()...`);
                                
                                // Store the stacked pattern and individual patterns for stopping
                                this.currentStackedPattern = stackedPattern;
                                this.currentPatterns = [...patternObjects]; // Store individual patterns too
                                
                                stackedPattern.play();
                                console.log(`[StrudelApp] All patterns started playing via stack()`);
                                await this.startVizDrawerIfNeeded();
                            } else {
                                // Fallback: play each pattern individually if stack() is not available
                                console.warn('[StrudelApp] stack() function not available, playing patterns individually');
                                this.currentStackedPattern = null; // Clear since we're not using stack
                                this.currentPatterns = [...patternObjects]; // Store individual patterns
                                patternObjects.forEach((pattern, index) => {
                                    try {
                                        if (typeof pattern.play === 'function') {
                                            pattern.play();
                                            console.log(`[StrudelApp] Pattern ${index + 1} started playing individually`);
                                        }
                                    } catch (error) {
                                        console.error(`[StrudelApp] Error playing pattern ${index + 1}:`, error);
                                    }
                                });
                            }
                        } catch (error) {
                            console.error(`[StrudelApp] Error stacking/playing patterns:`, error);
                            console.error(`[StrudelApp] Error stack:`, error.stack);
                        }
                    } else {
                        console.warn('[StrudelApp] No playable patterns found!');
                    }
                }
            } else {
                console.log('[StrudelApp] No pattern lines found to play');
            }
        } catch (error) {
            console.error('[StrudelApp] Error playing Strudel content:', error);
            alert('Error playing code: ' + error.message);
        }
    }

    /**
     * Update currently playing patterns to their new values from the editor.
     * If already playing, hot-swaps the pattern without stopping (scheduler keeps running).
     * If not playing, stops then plays from scratch.
     */
    async updateStrudelContent() {
        try {
            const code = this.getEditorContent();
            if (code === null || !code.trim()) {
                console.warn('[StrudelApp] No code to update');
                return;
            }
            const { dollarLines, otherLines } = this.parseCodeForPlay(code);
            const wasPlaying = this.strudelScheduler?.started === true;

            if (!wasPlaying) {
                // Not playing: same as before — stop (no-op if already stopped) then play
                console.log('[StrudelApp] Updating patterns (was not playing, starting fresh)...');
                this.stopStrudelContent();
                await new Promise(resolve => setTimeout(resolve, 50));
                await this.playStrudelContent();
                console.log('[StrudelApp] Patterns updated');
                return;
            }

            if (dollarLines.length === 0) {
                // Was playing but user removed all pattern lines — stop playback
                this.stopStrudelContent();
                console.log('[StrudelApp] No pattern lines left, stopped');
                return;
            }

            const setupLines = otherLines
                .map((line) => line.trim())
                .filter((trimmed) => trimmed && !trimmed.startsWith('//'));
            const setupCode = setupLines.join(';\n');

            // Hot-swap: keep scheduler running, only replace the pattern and refresh visualizations
            console.log('[StrudelApp] Hot-updating patterns (playback continues)...');
            await this.clearPatternVisualizations();
            const playCode = this.buildStackPlayCodeFromDollarLines(dollarLines);
            let codeToEval = setupCode
                ? `(async function(){ ${setupCode};\nreturn (${playCode}); })()`
                : playCode;
            codeToEval = this.substituteGMWithBuiltinSynths(codeToEval);
            const playCodeStart = codeToEval.indexOf('return (') + 'return ('.length;
            const playCodeEnd = setupCode ? codeToEval.indexOf('); })()') : codeToEval.length;
            this._playCodeOffsetInCodeToEval = setupCode ? playCodeStart : 0;
            this._setupCodeStartInCodeToEval = setupCode ? ('(async function(){ ').length : -1;
            this._lastCodeToEval = codeToEval;
            this._lastPlayCodeRange = [playCodeStart, playCodeEnd];
            await this.strudelEvaluate(codeToEval, false); // false = setPattern(..., false), scheduler keeps running
            await this.startVizDrawerIfNeeded();
            console.log('[StrudelApp] Patterns hot-updated');
        } catch (error) {
            console.error('[StrudelApp] Error updating patterns:', error);
            alert('Error updating patterns: ' + error.message);
        }
    }

    /**
     * Start the Drawer from @strudel/draw so onPaint-based visuals (punchcard, spiral, pitchwheel)
     * get their painters called each frame. pianoroll/scope/spectrum use this.draw() and don't need this.
     */
    async startVizDrawerIfNeeded() {
        if (!this.strudelScheduler || !this.strudelScheduler.pattern) return;
        try {
            const pattern = this.strudelScheduler.pattern;
            const painters = pattern.getPainters && pattern.getPainters();
            if (!painters || painters.length === 0) return;
            const { Drawer, getDrawContext } = await import('@strudel/draw');
            this.stopVizDrawer();
            const drawTime = [4, 0.1]; // lookbehind 4, lookahead 0.1 (same idea as codemirror REPL)
            this._vizDrawer = new Drawer((haps, time, drawer, paintersList) => {
                paintersList?.forEach((painter) => painter(getDrawContext(), time, haps, drawer.drawTime));
            }, drawTime);
            this._vizDrawer.invalidate(this.strudelScheduler);
            this._vizDrawer.start(this.strudelScheduler);
            console.log('[StrudelApp] Viz Drawer started for onPaint visuals');
        } catch (e) {
            console.warn('[StrudelApp] Could not start viz Drawer:', e);
        }
    }

    /**
     * Stop the Drawer used for onPaint-based visuals.
     */
    stopVizDrawer() {
        if (this._vizDrawer) {
            this._vizDrawer.stop();
            this._vizDrawer = null;
            console.log('[StrudelApp] Viz Drawer stopped');
        }
    }

    /**
     * Clear all pattern visualizations and stop their draw animation frames
     */
    async clearPatternVisualizations() {
        this.stopVizDrawer();
        const editorEl = this.getEditorElement();
        // Stop @strudel/draw animation frames for each viz (ids are 1, 2, ...)
        try {
            const { cleanupDraw } = await import('@strudel/draw');
            this._patternVisualizations.forEach((viz, index) => {
                cleanupDraw(false, index + 1);
            });
        } catch (e) {
            // Draw package may not be available (e.g. fallback mode)
        }
        this._patternVisualizations.forEach((viz, index) => {
            // Remove event handlers
            if (editorEl && viz.container && viz.container._updateHandler) {
                editorEl.removeEventListener('scroll', viz.container._updateHandler);
                window.removeEventListener('resize', viz.container._updateHandler);
            }
            // Remove container
            if (viz.container && viz.container.parentElement) {
                viz.container.remove();
            }
            // Clean up global ctx reference
            delete window[`__strudelVizCtx${index}`];
        });
        this._patternVisualizations.clear();
    }

    /**
     * Create a visualization canvas for a pattern, inserted into the pre tag after its source line
     * Returns the visualization object with ctx for injection into pattern code
     */
    createPatternVisualization(patternIndex, lineNumber, code, pattern = null) {
        const textarea = this.getEditorElement();
        if (!textarea) return null;

        // Remove existing visualization for this pattern if any
        const existing = this._patternVisualizations.get(patternIndex);
        if (existing && existing.container && existing.container.parentElement) {
            existing.container.remove();
        }

        // Calculate how many lines the pattern spans
        // The pattern code might be on a single line (after concatenation) or we need to count from the original
        const codeText = textarea.value;
        const allLines = codeText.split('\n');
        
        // Find the end line of the pattern by looking for where the pattern block ends
        // Start from lineNumber and count continuation lines (including blank lines within the pattern)
        let endLineNumber = lineNumber;
        let i = lineNumber;
        let foundNonBlank = false; // Track if we've found any non-blank continuation
        
        while (i < allLines.length) {
            const line = allLines[i];
            const trimmed = line.trim();
            
            // Skip blank lines but continue (they're part of the pattern block)
            if (trimmed === '') {
                i++;
                continue;
            }
            
            // Stop at comments (unless we haven't found any continuation yet)
            if (trimmed.startsWith('//')) {
                if (foundNonBlank) break;
                i++;
                continue;
            }
            
            // Check if this is a continuation line (starts with . or is part of the pattern)
            if (i === lineNumber || /^\s*\./.test(line) || (foundNonBlank && !trimmed.match(/^\s*[a-zA-Z_$]/))) {
                endLineNumber = i;
                foundNonBlank = true;
                i++;
            } else {
                // If we've found continuation lines before, this might be the end
                if (foundNonBlank) break;
                // Otherwise, this might be the first continuation
                if (i > lineNumber) {
                    endLineNumber = i;
                    foundNonBlank = true;
                    i++;
                } else {
                    break;
                }
            }
        }
        
        // Create container
        const container = document.createElement('div');
        container.className = 'strudel-pattern-visualization';
        container.setAttribute('data-pattern-index', patternIndex);
        container.setAttribute('data-line-number', lineNumber);
        container.setAttribute('data-end-line-number', endLineNumber);

        // Create canvas with id so getDrawContext(id) finds it (same API as #test-canvas)
        const canvasId = `strudel-viz-${patternIndex}`;
        const canvas = document.createElement('canvas');
        canvas.id = canvasId;
        canvas.setAttribute('aria-hidden', 'true');
        container.appendChild(canvas);

        // Get canvas context for placeholder draw
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Insert the visualization into the editor wrap
        const editorWrap = textarea.closest('.strudel-editor-wrap');
        if (!editorWrap) return null;
        editorWrap.appendChild(container);

        // Size canvas immediately so first draw has correct dimensions (avoid race with animation start)
        const measureEl = textarea.contentDOM || textarea;
        const lineHeight = parseFloat(getComputedStyle(measureEl).lineHeight) || 21;
        const padding = parseFloat(getComputedStyle(measureEl).paddingTop) || 10;
        const baseTop = (endLineNumber + 1) * lineHeight + padding;
        const scrollTop = textarea.scrollTop || 0;
        const top = baseTop - scrollTop;
        container.style.top = `${top}px`;
        container.style.height = '100px';
        container.style.width = '100%';
        // Use buffer size = display size; no transform so @strudel/draw (__pianoroll) draws in 0..width, 0..height correctly
        const dpr = window.devicePixelRatio || 1;
        const width = editorWrap.getBoundingClientRect().width || 400;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(100 * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = '100px';
        // Placeholder draw so canvas is not blank until @strudel/draw runs (will be overwritten by pianoroll)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '12px monospace';
        ctx.fillText('Pattern ' + (patternIndex + 1) + ' – waiting for draw…', 10, 24);

        // Calculate position based on the END of the pattern (last line)
        const updatePosition = () => {
            const measureEl = textarea.contentDOM || textarea;
            const lineHeight = parseFloat(getComputedStyle(measureEl).lineHeight) || 21;
            const padding = parseFloat(getComputedStyle(measureEl).paddingTop) || 10;
            
            // Calculate top position based on the END line of the pattern
            // endLineNumber is 0-based, so we add 1 to get the line after it
            // Position it right below the last line of the pattern
            const baseTop = (endLineNumber + 1) * lineHeight + padding;
            
            // Account for textarea scroll - when textarea scrolls down, visualizations move up
            const scrollTop = textarea.scrollTop || 0;
            const top = baseTop - scrollTop;
            
            container.style.top = `${top}px`;
            
            console.log(`[StrudelApp] Visualization ${patternIndex + 1} position: startLine=${lineNumber}, endLine=${endLineNumber}, lineHeight=${lineHeight}, padding=${padding}, baseTop=${baseTop}px, scrollTop=${scrollTop}px, top=${top}px`);
            
            // Resize canvas (no transform - draw package uses 0..canvas.width, 0..canvas.height)
            const dpr = window.devicePixelRatio || 1;
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                canvas.width = Math.floor(rect.width * dpr);
                canvas.height = Math.floor(rect.height * dpr);
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
            }
        };

        // Update position on scroll/resize
        const updateHandler = () => {
            updatePosition();
        };
        
        // Initial position
        setTimeout(() => {
            updatePosition();
        }, 0);
        
        textarea.addEventListener('scroll', updateHandler);
        window.addEventListener('resize', updateHandler);
        
        // Store handler for cleanup
        container._updateHandler = updateHandler;

        // Store visualization info
        const viz = {
            container,
            canvas,
            ctx,
            lineNumber,
            code,
            pattern,
            patternIndex,
            updatePosition,
        };
        
        this._patternVisualizations.set(patternIndex, viz);
        
        console.log(`[StrudelApp] Created visualization ${patternIndex + 1} at line ${lineNumber + 1} (inserted into pre tag, total: ${this._patternVisualizations.size})`);
        return viz;
    }

    /**
     * Stop all Strudel audio playback
     * Uses hush() to stop all patterns simultaneously
     */
    async stopStrudelContent() {
        try {
            this.stopHighlightLoop();
            // Stop the scheduler (stops audio and pattern evaluation)
            if (typeof this.strudelStop === 'function') {
                this.strudelStop();
                console.log('[StrudelApp] Audio stopped via scheduler stop()');
            } else {
                console.warn('[StrudelApp] strudelStop not available. Strudel may not be initialized.');
                alert('Stop function not available. Strudel may not be initialized.');
            }

            // Clear tracked patterns
            this.currentStackedPattern = null;
            this.currentPatterns = [];

            // Clear visualizations (also stops their draw animation frames)
            await this.clearPatternVisualizations();
        } catch (error) {
            console.error('[StrudelApp] Error stopping audio:', error);
            alert('Error stopping audio: ' + error.message);
        }
    }

    /**
     * Start the requestAnimationFrame loop that highlights active pattern tags in CodeMirror.
     * Uses the Strudel REPL's implementation: @strudel/codemirror highlightMiniLocations(view, atTime, haps).
     * We pass haps with context.locations in document space (mapped via _playCodeToEditorMap) so the
     * REPL's extension can match mark ids (start:end) to the marks set by updateMiniLocations.
     */
    startHighlightLoop() {
        this.stopHighlightLoop();
        let highlightMiniLocationsFn = null;
        const loop = () => {
            if (!this.strudelScheduler || !this.strudelScheduler.started || !this.cmView) {
                this._highlightRAF = requestAnimationFrame(loop);
                return;
            }
            const time = this.strudelScheduler.now();
            const pattern = this.strudelScheduler.pattern;
            if (!pattern || typeof pattern.queryArc !== 'function') {
                this._highlightRAF = requestAnimationFrame(loop);
                return;
            }
            const haps = pattern.queryArc(time - 0.1, time + 0.1) || [];
            const activeHaps = haps.filter((h) => h && typeof h.isActive === 'function' && h.isActive(time));
            // Map hap.context.locations from evaluated-code to document space so REPL's highlightMiniLocations can match by id
            const map = this._playCodeToEditorMap;
            const hapsWithDocLocations = map ? activeHaps.map((hap) => {
                const locs = hap.context?.locations || [];
                const newLocs = locs.map((loc) => {
                    const start = loc?.start ?? loc?.[0];
                    const end = loc?.end ?? loc?.[1];
                    if (start == null || end == null) return null;
                    return map.get(`${start}:${end}`);
                }).filter(Boolean);
                if (newLocs.length === 0) return null;
                return { ...hap, context: { ...hap.context, locations: newLocs } };
            }).filter(Boolean) : activeHaps;
            if (highlightMiniLocationsFn) {
                highlightMiniLocationsFn(this.cmView, time, hapsWithDocLocations);
            } else {
                import('@strudel/codemirror').then(({ highlightMiniLocations }) => {
                    highlightMiniLocationsFn = highlightMiniLocations;
                    highlightMiniLocations(this.cmView, time, hapsWithDocLocations);
                });
            }
            this._highlightRAF = requestAnimationFrame(loop);
        };
        this._highlightRAF = requestAnimationFrame(loop);
    }

    /**
     * Stop the highlight loop and clear active-tag decorations.
     * Uses Strudel REPL API: updateMiniLocations(view, []), highlightMiniLocations(view, 0, []).
     */
    stopHighlightLoop() {
        if (this._highlightRAF != null) {
            cancelAnimationFrame(this._highlightRAF);
            this._highlightRAF = null;
        }
        if (this.cmView) {
            import('@strudel/codemirror').then(({ updateMiniLocations, highlightMiniLocations }) => {
                updateMiniLocations(this.cmView, []);
                highlightMiniLocations(this.cmView, 0, []);
            });
        }
    }

    /**
     * Save strudel content (active document to its file, or show Save As if untitled)
     */
    async saveStrudelContent() {
        this.syncEditorToActiveDocument();
        const doc = this.activeDocumentId ? this.openDocuments.find((d) => d.id === this.activeDocumentId) : null;
        if (!doc) return;

        const content = doc.content;
        let filePath = doc.filePath;

        if (!filePath) {
            if (!window.electron || !window.electron.showSaveDialog) {
                console.error('[StrudelApp] Electron file dialog API not available');
                return;
            }
            const result = await window.electron.showSaveDialog({
                defaultPath: doc.name || 'strudel-code.strudel',
                filters: [
                    { name: 'Strudel', extensions: ['strudel'] },
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            if (result.canceled || !result.filePath) return;
            filePath = result.filePath;
            doc.filePath = filePath;
            doc.name = filePath.split(/[/\\]/).pop() || doc.name;
        }

        try {
            const writeResult = await window.electron.writeFile(filePath, content);
            if (writeResult.success) {
                doc.lastSavedContent = content;
                doc.unsaved = false;
                this.renderOpenDocs();
                console.log('[StrudelApp] File saved successfully:', filePath);
                if (this.strudelScheduler?.started) {
                    await this.updateStrudelContent();
                }
            } else {
                alert('Error saving file: ' + writeResult.error);
            }
        } catch (error) {
            console.error('[StrudelApp] Error saving file:', error);
            alert('Error saving file: ' + error.message);
        }
    }

    /**
     * Open a new untitled file (add to open documents and switch to it).
     */
    openNewUntitled() {
        this.syncEditorToActiveDocument();
        this._untitledCounter += 1;
        const doc = createDocument('untitled-' + this._untitledCounter, null, 'Untitled', '');
        this.openDocuments.push(doc);
        this.activeDocumentId = doc.id;
        this.setEditorContent('');
        this.renderOpenDocs();
        this.persistOpenFiles();
    }

    /**
     * Open a file (add to open documents or switch to existing)
     */
    async openDocument() {
        if (!window.electron || !window.electron.showOpenDialog) {
            console.error('[StrudelApp] Electron file dialog API not available');
            return;
        }

        try {
            const result = await window.electron.showOpenDialog({
                filters: [
                    { name: 'Strudel', extensions: ['strudel'] },
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
            });

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;

            const filePath = result.filePaths[0];
            const name = filePath.split(/[/\\]/).pop() || 'Untitled';

            const existing = this.openDocuments.find((d) => d.filePath === filePath);
            if (existing) {
                this.switchDocument(existing.id);
                return;
            }

            const readResult = await window.electron.readFile(filePath);
            if (!readResult.success) {
                alert('Error reading file: ' + readResult.error);
                return;
            }

            this.syncEditorToActiveDocument();
            const doc = createDocument(filePath, filePath, name, readResult.content);
            this.openDocuments.push(doc);
            this.activeDocumentId = doc.id;
            this.setEditorContent(doc.content);
            this.renderOpenDocs();
            this.persistOpenFiles();
            console.log('[StrudelApp] File opened:', filePath);
        } catch (error) {
            console.error('[StrudelApp] Error opening file:', error);
            alert('Error opening file: ' + error.message);
        }
    }
}

// Initialize when DOM is ready (or immediately if script loaded late, e.g. fallback)
function initStrudelApp() {
    new StrudelApp();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStrudelApp);
} else {
    initStrudelApp();
}
