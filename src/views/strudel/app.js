/**
 * Strudel Window App
 * 
 * This is the main application logic for the Strudel window.
 */

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
            console.log('[StrudelApp] Strudel initialized with transpiler');
        } catch (error) {
            console.warn('[StrudelApp] Failed to load Strudel from node_modules:', error);
            console.warn('[StrudelApp] Run "npm run build:strudel" then "npm start" to use the bundled Strudel and CodeMirror.');
            await this.initializeStrudelEditor();
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
                const { initEditor, toggleLineComment } = await import('@strudel/codemirror');
                this._toggleLineComment = toggleLineComment;
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
                        self._toggleLineComment(self.cmView);
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
     * Switch to a document by id (save current editor to current doc, load doc into editor)
     */
    switchDocument(docId) {
        if (docId === this.activeDocumentId) return;
        this.stopStrudelContent();
        this.syncEditorToActiveDocument();
        const doc = this.openDocuments.find((d) => d.id === docId);
        if (!doc) return;
        this.activeDocumentId = docId;
        this.setEditorContent(doc.content);
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
            tab.className = 'strudel-doc-tab' + (doc.id === this.activeDocumentId ? ' active' : '') + (doc.unsaved ? ' unsaved' : '');
            tab.title = doc.filePath || doc.name;
            tab.textContent = doc.name;
            tab.setAttribute('data-doc-id', doc.id);
            tab.addEventListener('click', () => this.switchDocument(doc.id));
            container.appendChild(tab);
        });
    }


    /**
     * Toggle comments on selected lines (Ctrl+/ or Cmd+/)
     */
    toggleComments() {
        if (this.cmView && this._toggleLineComment) {
            this._toggleLineComment(this.cmView);
            return;
        }
        const textarea = this.getEditorElement();
        if (!textarea) return;
        if (this.cmView) return; // already handled at top

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const lines = text.split('\n');

        // Find which lines are selected
        let startLine = 0;
        let endLine = lines.length - 1;
        let charCount = 0;

        for (let i = 0; i < lines.length; i++) {
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

        // Determine if we should comment or uncomment
        // Check if all selected lines are commented
        let allCommented = true;
        let hasAnyContent = false;
        for (let i = startLine; i <= endLine; i++) {
            const trimmed = lines[i].trim();
            if (trimmed && !trimmed.startsWith('//')) {
                allCommented = false;
            }
            if (trimmed) {
                hasAnyContent = true;
            }
        }

        // If no content selected, do nothing
        if (!hasAnyContent) return;

        // Toggle comments
        const newLines = [...lines];
        let newStart = start;
        let newEnd = end;
        let offset = 0;

        for (let i = startLine; i <= endLine; i++) {
            const line = newLines[i];
            const trimmed = line.trim();

            if (allCommented) {
                // Uncomment: remove // from start of line
                if (trimmed.startsWith('//')) {
                    const uncommented = line.replace(/^(\s*)\/\//, '$1');
                    const lineOffset = line.length - uncommented.length;
                    newLines[i] = uncommented;
                    if (i === startLine) {
                        offset -= lineOffset;
                    }
                }
            } else {
                // Comment: add // at start of line (after leading whitespace)
                if (trimmed && !trimmed.startsWith('//')) {
                    const indent = line.match(/^(\s*)/)[0];
                    const commented = indent + '//' + line.slice(indent.length);
                    const lineOffset = commented.length - line.length;
                    newLines[i] = commented;
                    if (i === startLine) {
                        offset += lineOffset;
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
     * Parse editor content into $: blocks with segment mapping (patternCode offset -> document offset).
     * Used to map playCode mini locations (from repl) to editor positions for correct highlight.
     * @param {string} code - Full editor document content
     * @returns {{ code: string, segments: Array<{ patternFrom: number, patternTo: number, docFrom: number, docTo: number }> }[]}
     */
    getDollarBlocksWithSegments(code) {
        const lines = code.split('\n');
        const blocks = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('//')) {
                const uncommented = trimmedLine.slice(2).trim();
                if (uncommented.startsWith('$:')) {
                    i++;
                    continue;
                }
                i++;
                continue;
            }
            if (!trimmedLine.startsWith('$:')) {
                i++;
                continue;
            }
            const startLineIndex = i;
            let patternCode = trimmedLine.slice(2).trim().replace(/\.play\(\);?$/, '');
            const lineStarts = []; // doc offset of start of each line
            for (let k = 0; k <= i; k++) lineStarts.push(lines.slice(0, k).join('\n').length);
            const codeStartOnFirstLine = lines[i].match(/^\s*\$:\s*/)?.[0].length ?? 0;
            let docStart = lineStarts[i] + codeStartOnFirstLine;
            const segments = [{ patternFrom: 0, patternTo: patternCode.length, docFrom: docStart, docTo: docStart + patternCode.length }];
            i++;
            while (i < lines.length) {
                const next = lines[i].trim();
                const nextLine = lines[i];
                if (!next) { i++; continue; }
                if (next.startsWith('//') || next.startsWith('$:')) break;
                const isContinuation = /^\s*\./.test(nextLine) || (patternCode && !/^\s*[a-zA-Z_$]/.test(next));
                if (!isContinuation) break;
                const partStartInDoc = lines.slice(0, i).join('\n').length;
                const leadingSpaces = nextLine.length - nextLine.trimStart().length;
                const partDocFrom = partStartInDoc + leadingSpaces;
                const partDocTo = partDocFrom + next.trim().length;
                const patternFrom = patternCode.length;
                patternCode += ' ' + next.trim();
                const patternTo = patternCode.length;
                segments.push({ patternFrom, patternTo, docFrom: partDocFrom, docTo: partDocTo });
                i++;
            }
            if (patternCode) blocks.push({ code: patternCode, segments });
        }
        return blocks;
    }

    /**
     * Map a range [from, to] in patternCode to document range using segments.
     */
    _mapPatternRangeToDoc(segments, from, to) {
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

    /**
     * Compute mini locations in editor document coordinates and a map from playCode location id to editor range.
     * Call after eval; uses current editor content and playCode miniLocations from meta.
     */
    _applyEditorMiniLocationsAndMap(playCodeMiniLocations) {
        if (!this.cmView || !this.strudelTranspiler) return;
        const editorContent = this.cmView.state.doc.toString();
        const blocks = this.getDollarBlocksWithSegments(editorContent);
        const editorMiniLocations = [];
        const playCodeToEditorMap = new Map();
        let playCodeIndex = 0;
        for (const block of blocks) {
            try {
                const { miniLocations: blockLocs } = this.strudelTranspiler(block.code, { emitMiniLocations: true });
                if (!blockLocs || !blockLocs.length) continue;
                // Merge only when the merged slice has no space, so "breaks125" → one span but "0 1 1" → separate leaves (each highlights on its own step).
                const indexed = blockLocs.map((r, i) => ({ range: r, index: i }));
                indexed.sort((a, b) => a.range[0] - b.range[0]);
                const merged = [];
                const mergedGroups = [];
                for (const { range: [from, to], index: i } of indexed) {
                    const wouldMerge = merged.length > 0 && from <= merged[merged.length - 1][1] + 1;
                    const last = merged.length > 0 ? merged[merged.length - 1] : null;
                    const mergedSlice = last ? block.code.slice(Math.min(last[0], from), Math.max(last[1], to)) : block.code.slice(from, to);
                    const mergeAllowed = !mergedSlice.includes(' ');
                    if (merged.length === 0 || !wouldMerge || !mergeAllowed) {
                        merged.push([from, to]);
                        mergedGroups.push([i]);
                    } else {
                        last[0] = Math.min(last[0], from);
                        last[1] = Math.max(last[1], to);
                        mergedGroups[merged.length - 1].push(i);
                    }
                }
                for (let k = 0; k < merged.length; k++) {
                    const [from, to] = merged[k];
                    const blockRanges = mergedGroups[k].map((i) => blockLocs[i]);
                    const blockSlice = block.code.slice(from, to);
                    let [docFrom, docTo] = this._mapPatternRangeToDoc(block.segments, from, to);
                    const beforeDiscount = [docFrom, docTo];
                    let discountApplied = false;
                    // Shift position only to skip opening delimiter when range starts with one
                    const skipOpeningDelimiters = ['"', '<', '{', ' ', '%'];
                    const firstChar = docTo > docFrom ? editorContent.slice(docFrom, docFrom + 1) : '';
                    if (skipOpeningDelimiters.includes(firstChar)) {
                        docFrom += 1;
                        docTo += 1;
                        discountApplied = true;
                    }
                    editorMiniLocations.push([docFrom, docTo]);
                    const tokenText = editorContent.slice(docFrom, docTo);
                    const tokenNum = editorMiniLocations.length;
                    console.log(`[StrudelApp] highlighted token #${tokenNum}: [${docFrom}, ${docTo}] "${tokenText.replace(/\n/g, '\\n')}" (${mergedGroups[k].length} leaf/leaves)`);
                    console.log(`[StrudelApp]   token #${tokenNum} chain: blockRanges=${JSON.stringify(blockRanges)} → merged block [${from},${to}] → block slice "${blockSlice.replace(/\n/g, '\\n')}" → _mapPatternRangeToDoc [${beforeDiscount[0]},${beforeDiscount[1]}]${discountApplied ? ` → quote discount → [${docFrom},${docTo}]` : ''}`);
                    for (const i of mergedGroups[k]) {
                        if (playCodeIndex + i < playCodeMiniLocations.length) {
                            const [pcFrom, pcTo] = playCodeMiniLocations[playCodeIndex + i];
                            playCodeToEditorMap.set(`${pcFrom}:${pcTo}`, { start: docFrom, end: docTo });
                        }
                    }
                }
                playCodeIndex += blockLocs.length;
            } catch (_) {
                // block might not be valid JS; skip
            }
        }
        this._playCodeToEditorMap = playCodeToEditorMap;
        import('@strudel/codemirror').then(({ updateMiniLocations }) => {
            updateMiniLocations(this.cmView, editorMiniLocations);
        });
    }

    /**
     * Play/evaluate the Strudel code from the textarea
     * Supports Strudel REPL syntax with $: prefix for auto-play
     * All $: lines are executed concurrently (at the same time)
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

            // Process code line by line to handle $: syntax (Strudel REPL auto-play)
            // Multi-line $: blocks are supported: continuation lines (e.g. ".s(...)" or ".pianoroll()") are merged
            const lines = code.split('\n');
            const dollarLines = []; // { code, lineNumber, hasVisualization }
            const otherLines = [];
            let i = 0;
            while (i < lines.length) {
                const line = lines[i];
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('//')) {
                    const uncommented = trimmedLine.slice(2).trim();
                    if (uncommented.startsWith('$:')) {
                        i++;
                        continue;
                    }
                    otherLines.push(line);
                    i++;
                    continue;
                }
                if (trimmedLine.startsWith('$:')) {
                    const startLine = i;
                    let patternCode = trimmedLine.slice(2).trim().replace(/\.play\(\);?$/, '');
                    i++;
                    // Collect continuation lines (e.g. ".s('sawtooth')" or ".pianoroll()")
                    // Skip blank lines but continue collecting
                    while (i < lines.length) {
                        const next = lines[i].trim();
                        const nextLine = lines[i];
                        
                        // Skip blank lines but continue
                        if (!next) {
                            i++;
                            continue;
                        }
                        
                        // Stop at comments or next pattern
                        if (next.startsWith('//')) break;
                        if (next.startsWith('$:')) break;
                        
                        // Check if this is a continuation line
                        if (/^\s*\./.test(nextLine) || (patternCode && !/^\s*[a-zA-Z_$]/.test(next))) {
                            patternCode += ' ' + next;
                            i++;
                        } else {
                            break;
                        }
                    }
                    if (patternCode) {
                        // Detect if this pattern has a visualization (check both _pianoroll and pianoroll)
                        const vizRegex = /\._?(pianoroll|punchcard|spiral|scope|spectrum|pitchwheel)\s*\(/;
                        const hasVisualization = vizRegex.test(patternCode);
                        const match = patternCode.match(vizRegex);
                        console.log(`[StrudelApp] Pattern at line ${startLine + 1}: hasVisualization=${hasVisualization}`, 
                            match ? `(found: ${match[0]})` : '(no match)', 
                            `code: ${patternCode.substring(0, 150)}`);
                        dollarLines.push({ code: patternCode, lineNumber: startLine, hasVisualization });
                    }
                    continue;
                }
                otherLines.push(line);
                i++;
            }

            // First, execute all non-$: lines (setup code, samples, etc.)
            // Run line-by-line so one bad line (e.g. samples(...).s()) doesn't block the rest
            if (otherLines.length > 0) {
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
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Clear previous visualizations (and stop their draw animation frames)
            await this.clearPatternVisualizations();

            // Then, execute all $: lines concurrently (at the same time)
            // Following the Strudel REPL example: use stack() to combine patterns and play them together
            if (dollarLines.length > 0) {
                const vizCount = dollarLines.filter(item => item.hasVisualization).length;
                console.log(`[StrudelApp] Found ${dollarLines.length} $: line(s) to execute (${vizCount} with visualizations):`, dollarLines.map(item => ({ line: item.lineNumber, hasViz: item.hasVisualization, code: item.code.substring(0, 60) })));
                
                // If we have evaluate() from repl, use it (handles transpilation automatically)
                if (this.strudelEvaluate) {
                    try {
                        // NOTE:
                        // - In Strudel docs, the "_" prefixed visuals (e.g. ._pianoroll()) are "inline"
                        //   and rely on a rich code editor integration. Our textarea editor can't render
                        //   inline visuals, so we normalize them to the global variants (e.g. .pianoroll()).
                        // - The repl's evaluate(code, autostart) evaluates code to a Pattern and starts via setPattern(); do not append .play().

                        // Create visualizations first so we can inject ctx
                        const normalized = dollarLines.map((item, index) => {
                            let s = item.code
                                .replace(/\._pianoroll\b/g, '.pianoroll')
                                .replace(/\._punchcard\b/g, '.punchcard')
                                .replace(/\._spiral\b/g, '.spiral')
                                .replace(/\._scope\b/g, '.scope')
                                .replace(/\._spectrum\b/g, '.spectrum')
                                .replace(/\._pitchwheel\b/g, '.pitchwheel');
                            
                            // If this pattern has a visualization, create canvas (id strudel-viz-N) and inject ctx via getDrawContext (same API as top canvas)
                            if (item.hasVisualization) {
                                console.log(`[StrudelApp] Creating visualization for pattern ${index + 1} at line ${item.lineNumber + 1}`);
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
                                console.log(`[StrudelApp] Modified code for pattern ${index + 1}:`, s.substring(0, 100));
                            }
                            return s;
                        });

                        // Evaluate to a single stacked Pattern; repl's evaluate() will setPattern() and start playback (autostart=true).
                        const playCode = `stack(${normalized.join(',\n')})`;

                        await this.strudelEvaluate(playCode, true);
                        console.log('[StrudelApp] Patterns evaluated + playing via evaluate()');
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
                console.log('[StrudelApp] No $: lines found to play');
            }
        } catch (error) {
            console.error('[StrudelApp] Error playing Strudel content:', error);
            alert('Error playing code: ' + error.message);
        }
    }

    /**
     * Update currently playing patterns to their new values from the textarea
     * Stops current patterns and starts new ones seamlessly
     */
    async updateStrudelContent() {
        try {
            console.log('[StrudelApp] Updating patterns...');
            
            // Stop current patterns first
            this.stopStrudelContent();
            
            // Wait a brief moment to ensure stop completes
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Then play the updated content
            await this.playStrudelContent();
            
            console.log('[StrudelApp] Patterns updated');
        } catch (error) {
            console.error('[StrudelApp] Error updating patterns:', error);
            alert('Error updating patterns: ' + error.message);
        }
    }

    /**
     * Clear all pattern visualizations and stop their draw animation frames
     */
    async clearPatternVisualizations() {
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
            
            // Stop at next pattern
            if (i > lineNumber && trimmed.startsWith('$:')) {
                break;
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
     * Uses @strudel/codemirror highlightMiniLocations (same as strudel.repl).
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
            // Map hap.context.locations from playCode coordinates to editor coordinates so highlights appear on the right lines
            const map = this._playCodeToEditorMap;
            const transformedHaps = map ? activeHaps.map((hap) => {
                const locs = hap.context?.locations || [];
                const newLocs = locs.map(({ start, end }) => map.get(`${start}:${end}`)).filter(Boolean);
                if (newLocs.length === 0) return null;
                return { ...hap, context: { ...hap.context, locations: newLocs } };
            }).filter(Boolean) : activeHaps;
            if (highlightMiniLocationsFn) {
                highlightMiniLocationsFn(this.cmView, time, transformedHaps);
            } else {
                import('@strudel/codemirror').then(({ highlightMiniLocations }) => {
                    highlightMiniLocationsFn = highlightMiniLocations;
                    highlightMiniLocations(this.cmView, time, transformedHaps);
                });
            }
            this._highlightRAF = requestAnimationFrame(loop);
        };
        this._highlightRAF = requestAnimationFrame(loop);
    }

    /**
     * Stop the highlight loop and clear active-tag decorations.
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
                defaultPath: doc.name || 'strudel-code.txt',
                filters: [
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
            } else {
                alert('Error saving file: ' + writeResult.error);
            }
        } catch (error) {
            console.error('[StrudelApp] Error saving file:', error);
            alert('Error saving file: ' + error.message);
        }
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
