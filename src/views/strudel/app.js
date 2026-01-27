/**
 * Strudel Window App
 * 
 * This is the main application logic for the Strudel window.
 */

class StrudelApp {
    constructor() {
        this.strudelInstance = null;
        this.currentStackedPattern = null; // Track the currently playing stacked pattern
        this.currentPatterns = []; // Track all currently playing patterns for stopping
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
            
            const { repl, evalScope } = strudelCore;
            const { transpiler } = strudelTranspiler;
            const { getAudioContext, webaudioOutput, initAudioOnFirstClick } = strudelWebaudio;
            
            // Initialize audio context
            const ctx = getAudioContext();
            initAudioOnFirstClick();
            
            // Set up eval scope with all Strudel modules
            await evalScope(
                import('@strudel/core'),
                import('@strudel/mini'),
                import('@strudel/webaudio'),
                import('@strudel/tonal')
            );
            
            // Create repl with transpiler
            const { evaluate } = repl({
                defaultOutput: webaudioOutput,
                getTime: () => ctx.currentTime,
                transpiler,
            });
            
            // Store evaluate function for later use
            this.strudelEvaluate = evaluate;
            this.audioContext = ctx;
            
            this.initializeStrudelEditor();
            console.log('[StrudelApp] Strudel initialized with transpiler');
        } catch (error) {
            console.warn('[StrudelApp] Failed to load Strudel with transpiler, falling back to @strudel/web:', error);
            // Fallback to simple @strudel/web approach
            this.initStrudelFromWeb();
        }
    }

    /**
     * Fallback: Initialize Strudel using @strudel/web (simpler but may not handle all cases)
     */
    initStrudelFromWeb() {
        // Check if initStrudel is already available (loaded via script tag)
        if (typeof initStrudel === 'function') {
            this.initializeStrudelEditor();
            return;
        }

        // Load from CDN
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@strudel/web@latest';
        script.onload = () => {
            if (typeof initStrudel === 'function') {
                this.initializeStrudelEditor();
            } else {
                console.error('[StrudelApp] initStrudel function not available after loading script');
            }
        };
        script.onerror = () => {
            console.error('[StrudelApp] Failed to load Strudel from CDN');
        };
        document.head.appendChild(script);
    }

    /**
     * Initialize the Strudel editor after Strudel is available
     */
    initializeStrudelEditor() {
        try {
            // If we have the evaluate function from repl, use it
            // Otherwise, initialize with initStrudel() if available
            if (!this.strudelEvaluate && typeof initStrudel === 'function') {
                this.strudelInstance = initStrudel({
                    // prebake: () => samples('github:tidalcycles/dirt-samples')
                    // We'll load samples dynamically in onStrudelUpdate instead
                });
            }
            
            // Create a simple code editor in the container
            const container = document.getElementById('strudel-container');
            if (container) {
                container.innerHTML = `
                    <textarea id="strudel-editor" style="width: 100%; height: 100%; font-family: monospace; padding: 10px; border: none; resize: none; background: #1e1e1e; color: #d4d4d4; box-sizing: border-box;"></textarea>
                `;
                
                // Set up change listener for the textarea
                const editor = document.getElementById('strudel-editor');
                if (editor) {
                    editor.addEventListener('input', () => this.onStrudelUpdate());
                    editor.addEventListener('change', () => this.onStrudelUpdate());
                }
                
                console.log('[StrudelApp] Strudel editor initialized successfully');
            }
        } catch (error) {
            console.error('[StrudelApp] Error initializing Strudel editor:', error);
        }
    }

    /**
     * Called when the textarea content changes
     * Checks for samples() calls and loads missing samples
     */
    onStrudelUpdate() {
        try {
            const container = document.getElementById('strudel-container');
            if (!container) {
                return;
            }

            const editor = container.querySelector('#strudel-editor') || container.querySelector('textarea');
            if (!editor) {
                return;
            }

            const code = editor.value || '';
            if (!code.trim()) {
                return;
            }

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
        const loadBtn = document.getElementById('loadBtn');

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

        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadStrudelContent());
        }
    }

    /**
     * Get the current content from the textarea inside strudel-container
     */
    async getStrudelContent() {
        try {
            const container = document.getElementById('strudel-container');
            if (!container) {
                console.warn('[StrudelApp] strudel-container not found');
                return null;
            }

            const editor = container.querySelector('#strudel-editor');
            if (editor) {
                return editor.value || '';
            }
            
            // Fallback: try to find any textarea in the container
            const textarea = container.querySelector('textarea');
            if (textarea) {
                return textarea.value || '';
            }
            
            console.warn('[StrudelApp] No textarea found in strudel-container');
            return null;
        } catch (e) {
            console.warn('[StrudelApp] Error getting Strudel content:', e);
            return null;
        }
    }

    /**
     * Set content in the textarea inside strudel-container
     */
    async setStrudelContent(content) {
        try {
            const container = document.getElementById('strudel-container');
            if (!container) {
                console.warn('[StrudelApp] strudel-container not found');
                return false;
            }

            const editor = container.querySelector('#strudel-editor');
            if (editor) {
                editor.value = content;
                // Trigger input event
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                editor.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
            
            // Fallback: try to find any textarea in the container
            const textarea = container.querySelector('textarea');
            if (textarea) {
                textarea.value = content;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
            
            console.warn('[StrudelApp] No textarea found in strudel-container');
            return false;
        } catch (e) {
            console.warn('[StrudelApp] Error setting Strudel content:', e);
            return false;
        }
    }

    /**
     * Play/evaluate the Strudel code from the textarea
     * Supports Strudel REPL syntax with $: prefix for auto-play
     * All $: lines are executed concurrently (at the same time)
     */
    async playStrudelContent() {
        try {
            const container = document.getElementById('strudel-container');
            if (!container) {
                console.warn('[StrudelApp] strudel-container not found');
                return;
            }

            const editor = container.querySelector('#strudel-editor') || container.querySelector('textarea');
            if (!editor) {
                console.warn('[StrudelApp] No textarea found');
                return;
            }

            let code = editor.value || '';
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
            const lines = code.split('\n');
            const dollarLines = []; // Lines starting with $: (pattern code without .play())
            const otherLines = []; // All other lines
            
            for (let line of lines) {
                const trimmedLine = line.trim();
                
                // Skip commented lines
                if (trimmedLine.startsWith('//')) {
                    // Check if it's a commented $: line
                    const uncommented = trimmedLine.substring(2).trim();
                    if (uncommented.startsWith('$:')) {
                        // Skip commented $: lines
                        continue;
                    }
                    otherLines.push(line);
                    continue;
                }
                
                // Handle $: syntax - remove $: but DON'T add .play() yet
                if (trimmedLine.startsWith('$:')) {
                    let patternCode = trimmedLine.substring(2).trim();
                    // Remove .play() if it already has it - we'll add it later
                    patternCode = patternCode.replace(/\.play\(\);?$/, '');
                    if (patternCode) {
                        dollarLines.push(patternCode);
                    }
                } else {
                    otherLines.push(line);
                }
            }

            // First, execute all non-$: lines (setup code, samples, etc.)
            if (otherLines.length > 0) {
                const otherCode = otherLines.join('\n');
                try {
                    const result = eval(otherCode);
                    console.log('[StrudelApp] Setup code executed');
                    
                    // If samples() returns a promise, wait for it
                    if (result && typeof result.then === 'function') {
                        await result;
                        console.log('[StrudelApp] Samples loading completed');
                    }
                    
                    // Wait a bit more for samples to be ready
                    // Samples loading is async, so we give it time to complete
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.warn('[StrudelApp] Error executing setup code:', error);
                }
            }

            // Then, execute all $: lines concurrently (at the same time)
            // Following the Strudel REPL example: use stack() to combine patterns and play them together
            if (dollarLines.length > 0) {
                console.log(`[StrudelApp] Found ${dollarLines.length} $: line(s) to execute:`, dollarLines);
                
                // If we have evaluate() from repl, use it (handles transpilation automatically)
                if (this.strudelEvaluate) {
                    try {
                        // Combine all $: lines into a single code block
                        const allPatternCode = dollarLines.map(code => code).join('\n');
                        
                        // Use evaluate() which handles transpilation and string-to-pattern conversion
                        this.strudelEvaluate(allPatternCode);
                        console.log(`[StrudelApp] All patterns evaluated via evaluate()`);
                    } catch (error) {
                        console.error(`[StrudelApp] Error evaluating patterns via evaluate():`, error);
                    }
                } else {
                    // Fallback: evaluate patterns individually with eval()
                    const patternObjects = [];
                    dollarLines.forEach((patternCode, index) => {
                        try {
                            console.log(`[StrudelApp] Evaluating pattern ${index + 1}: ${patternCode}`);
                            
                            // Use eval() directly - it should have access to all Strudel functions in global scope
                            const pattern = eval(patternCode);
                            console.log(`[StrudelApp] Pattern ${index + 1} evaluation result:`, pattern);
                            
                            if (pattern && pattern._Pattern) {
                                patternObjects.push(pattern);
                                console.log(`[StrudelApp] Pattern ${index + 1} prepared: ${patternCode.substring(0, 80)}...`);
                            } else {
                                console.warn(`[StrudelApp] Pattern ${index + 1} did not return a Pattern object. Code: ${patternCode}, Result:`, pattern);
                            }
                        } catch (error) {
                            console.error(`[StrudelApp] Error evaluating pattern ${index + 1}:`, error);
                            console.error(`[StrudelApp] Pattern code: ${patternCode}`);
                            
                            // Try to fix common issues: if .every() is called on a string, we need to convert it to a pattern first
                            if (error.message && error.message.includes('every is not a function')) {
                                console.log(`[StrudelApp] Attempting to fix: string needs to be converted to pattern for .every()`);
                                if (typeof m === 'function') {
                                    try {
                                        const fixedCode = patternCode.replace(/"([^"]+)"/g, 'm("$1")');
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
     * Stop all Strudel audio playback
     * Uses hush() to stop all patterns simultaneously
     */
    stopStrudelContent() {
        try {
            // Stop all patterns simultaneously
            // First, try to stop the stacked pattern if it exists and has a stop method
            if (this.currentStackedPattern) {
                try {
                    if (typeof this.currentStackedPattern.stop === 'function') {
                        this.currentStackedPattern.stop();
                        console.log('[StrudelApp] Stacked pattern stopped');
                    }
                } catch (e) {
                    // Ignore errors, fall through to hush()
                }
            }
            
            // Also try to stop individual patterns if they have stop methods
            if (this.currentPatterns.length > 0) {
                // Stop all patterns in the same synchronous execution
                for (let i = 0; i < this.currentPatterns.length; i++) {
                    try {
                        const pattern = this.currentPatterns[i];
                        if (pattern && typeof pattern.stop === 'function') {
                            pattern.stop();
                        }
                    } catch (e) {
                        // Ignore individual errors
                    }
                }
            }
            
            // Use hush() to stop all audio playback (this should stop everything at once)
            if (typeof hush === 'function') {
                hush();
                console.log('[StrudelApp] Audio stopped via hush()');
            } else {
                console.warn('[StrudelApp] hush function not available. Strudel may not be initialized.');
                alert('Stop function not available. Strudel may not be initialized.');
            }
            
            // Clear tracked patterns
            this.currentStackedPattern = null;
            this.currentPatterns = [];
        } catch (error) {
            console.error('[StrudelApp] Error stopping audio:', error);
            alert('Error stopping audio: ' + error.message);
        }
    }

    /**
     * Save strudel content to a file
     */
    async saveStrudelContent() {
        if (!window.electron || !window.electron.showSaveDialog) {
            console.error('[StrudelApp] Electron file dialog API not available');
            return;
        }

        try {
            const content = await this.getStrudelContent();
            if (content === null) {
                alert('Could not retrieve Strudel content from textarea.');
                return;
            }

            // Log the content before saving
            console.log('[StrudelApp] Content to save:', content);
            console.log('[StrudelApp] Content length:', content.length, 'characters');

            const result = await window.electron.showSaveDialog({
                defaultPath: 'strudel-code.txt',
                filters: [
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (!result.canceled && result.filePath) {
                const writeResult = await window.electron.writeFile(result.filePath, content);
                if (writeResult.success) {
                    console.log('[StrudelApp] File saved successfully:', result.filePath);
                } else {
                    alert('Error saving file: ' + writeResult.error);
                }
            }
        } catch (error) {
            console.error('[StrudelApp] Error saving file:', error);
            alert('Error saving file: ' + error.message);
        }
    }

    /**
     * Load strudel content from a file
     */
    async loadStrudelContent() {
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

            if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                const readResult = await window.electron.readFile(filePath);
                
                if (readResult.success) {
                    console.log('[StrudelApp] Content to load:', readResult.content);
                    console.log('[StrudelApp] Content length:', readResult.content.length, 'characters');
                    
                    const success = await this.setStrudelContent(readResult.content);
                    if (success) {
                        console.log('[StrudelApp] File loaded successfully:', filePath);
                    } else {
                        alert('Could not set content in textarea. Content was read from file but not applied.');
                    }
                } else {
                    alert('Error reading file: ' + readResult.error);
                }
            }
        } catch (error) {
            console.error('[StrudelApp] Error loading file:', error);
            alert('Error loading file: ' + error.message);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new StrudelApp();
});
