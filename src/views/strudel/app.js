/**
 * Strudel Window App
 * 
 * This is the main application logic for the Strudel window.
 */

import * as strudelParse from './strudel-parse.cjs';
import { initSettingsPanel as initSettingsPanelShared, DEFAULT_SETTINGS_FIELDS } from '../shared/settings-panel.js';

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
    bank: { summary: 'Drum/sample bank: prepend a name to sample abbrevs, e.g. s("bd sd").bank("RolandTR808").', link: 'https://strudel.cc/learn/samples/#sound-banks' },
    loop: { summary: 'Loop the sample (unsynced to cycle). Use loopBegin/loopEnd for region.', link: 'https://strudel.cc/learn/samples/#loop' },
    loopBegin: { summary: 'Start of loop region (0–1). Use with loop(1).', link: 'https://strudel.cc/learn/samples/#loopbegin' },
    loopEnd: { summary: 'End of loop region (0–1). Use with loop(1).', link: 'https://strudel.cc/learn/samples/#loopend' },
    cut: { summary: 'Cut group: stop sample when another in same group plays (e.g. open/closed hi-hat).', link: 'https://strudel.cc/learn/samples/#cut' },
    striate: { summary: 'Chop sample into n parts, trigger progressive portions each loop.', link: 'https://strudel.cc/learn/samples/#striate' },
    splice: { summary: 'Like slice but changes speed of each slice to match step duration.', link: 'https://strudel.cc/learn/samples/#splice' },
    samples: { summary: 'Load custom sample map (object or URL to strudel.json).', link: 'https://strudel.cc/learn/samples/#loading-custom-samples' },
    soundAlias: { summary: 'Create alias for existing sound, e.g. soundAlias("RolandTR808_bd", "kick").', link: 'https://strudel.cc/learn/samples/#default-samples' },
    setcps: { summary: 'Set tempo in cycles per second (e.g. setcps(0.75)). Default 0.5 = 2s per cycle.', link: 'https://strudel.cc/understand/cycles/' },
    setcpm: { summary: 'Set tempo in cycles per minute. setcpm(x) = setcps(x/60). Use setcpm(bpm/bpc) for BPM.', link: 'https://strudel.cc/understand/cycles/' },
    /* Notes: https://strudel.cc/learn/notes/ */
    note: { summary: 'Pitch: note names (a3 c#4) or MIDI numbers (57 61 64).', link: 'https://strudel.cc/learn/notes/' },
    n: { summary: 'Note: .n(0) or .note("c4"). Change pitch of a sample.', link: 'https://strudel.cc/learn/mini-notation/' },
    freq: { summary: 'Pitch as frequency in Hz, e.g. freq("220 275 330 440").', link: 'https://strudel.cc/learn/notes/#freq' },
    /* Tonal / chords: https://strudel.cc/learn/tonal/ */
    chord: { summary: 'Chord symbols (e.g. C, Am, G7). Use with .voicing() and optionally .dict("ireal").', link: 'https://strudel.cc/understand/voicings/#what-is-a-chord' },
    dict: { summary: 'Voicing dictionary for chord(), e.g. .dict("ireal"). Custom dicts via addVoicings().', link: 'https://strudel.cc/understand/voicings/#voicing-dictionaries' },
    dictionary: { summary: 'Voicing dictionary for chord() (alias for dict), e.g. .dict("ireal").', link: 'https://strudel.cc/understand/voicings/#voicing-dictionaries' },
    voicing: { summary: 'Turn chord symbols into voicings with optional anchor, mode, below, above, etc.', link: 'https://strudel.cc/learn/tonal/#voicing' },
    scale: { summary: 'Scale: root and type (e.g. C:major). Turns numbers into scale notes or quantizes.', link: 'https://strudel.cc/learn/tonal/#scalename' },
    transpose: { summary: 'Transpose all notes by semitones (number or interval notation).', link: 'https://strudel.cc/learn/tonal/#transposesemitones' },
    scaleTranspose: { summary: 'Transpose notes within the scale by scale steps.', link: 'https://strudel.cc/learn/tonal/#scaletransposesteps' },
    rootNotes: { summary: 'Chord symbols to root notes in given octave. Use with layer/struct/voicing.', link: 'https://strudel.cc/learn/tonal/#rootnotesoctave--2' },
    anchor: { summary: 'Voicing: note to align voicings to (e.g. c5). Used with chord/voicing.', link: 'https://strudel.cc/understand/voicings/#anchor' },
    mode: { summary: 'Voicing mode: below, above, duck, root. Used with chord/voicing.', link: 'https://strudel.cc/understand/voicings/#mode' },
    set: { summary: 'Set pattern value from another (e.g. n("0 1 2").set(chords).voicing()).', link: 'https://strudel.cc/understand/voicings/#example' },
    add: { summary: 'Add values to pattern (e.g. for transposing). Chainable.', link: 'https://strudel.cc/learn/conditional-modifiers/#struct' },
    /* Audio effects: https://strudel.cc/learn/effects/ */
    gain: { summary: 'Volume: multiply amplitude, e.g. .gain(.5).', link: 'https://strudel.cc/learn/effects/#gain' },
    lpf: { summary: 'Low-pass filter: .lpf(2000).lpfq(4).', link: 'https://strudel.cc/learn/effects/#lpf' },
    lpq: { summary: 'Low-pass filter Q (resonance): .lpq(4) or .lpfq(4).', link: 'https://strudel.cc/learn/effects/#lpq' },
    hpf: { summary: 'High-pass filter.', link: 'https://strudel.cc/learn/effects/#hpf' },
    bpf: { summary: 'Band-pass filter.', link: 'https://strudel.cc/learn/effects/#bpf' },
    vowel: { summary: 'Vowel filter: .vowel("a e i o u").', link: 'https://strudel.cc/learn/effects/#vowel' },
    pan: { summary: 'Stereo panning: .pan(sine) or .pan(.5).', link: 'https://strudel.cc/learn/effects/#pan' },
    jux: { summary: 'Juxtapose: apply a function to the pattern and combine with original, e.g. .jux(rev).', link: 'https://strudel.cc/learn/effects/#jux' },
    delay: { summary: 'Delay effect: .delay(.2).delaytime(.5).', link: 'https://strudel.cc/learn/effects/#delay' },
    delaytime: { summary: 'Delay time in cycles or seconds.', link: 'https://strudel.cc/learn/effects/#delaytime' },
    delayfeedback: { summary: 'Delay feedback amount (0–1). Caution: >= 1 can blow up.', link: 'https://strudel.cc/learn/effects/#delayfeedback' },
    delayfb: { summary: 'Synonym for delayfeedback.', link: 'https://strudel.cc/learn/effects/#delayfeedback' },
    room: { summary: 'Reverb level and size. .room(.8).roomsize(4).', link: 'https://strudel.cc/learn/effects/#room' },
    roomsize: { summary: 'Reverb room size (0–10). Changing recalculates reverb.', link: 'https://strudel.cc/learn/effects/#roomsize' },
    roomfade: { summary: 'Reverb fade time in seconds.', link: 'https://strudel.cc/learn/effects/#roomfade' },
    roomlp: { summary: 'Reverb lowpass frequency in Hz.', link: 'https://strudel.cc/learn/effects/#roomlp' },
    roomdim: { summary: 'Reverb lowpass frequency at -60dB (Hz).', link: 'https://strudel.cc/learn/effects/#roomdim' },
    iresponse: { summary: 'Impulse response sample for reverb.', link: 'https://strudel.cc/learn/effects/#iresponse' },
    reverb: { summary: 'Reverb effect (see room).', link: 'https://strudel.cc/learn/effects/#room' },
    hpq: { summary: 'High-pass filter Q (resonance).', link: 'https://strudel.cc/learn/effects/#hpq' },
    bpq: { summary: 'Band-pass filter Q (resonance).', link: 'https://strudel.cc/learn/effects/#bpq' },
    ftype: { summary: 'Filter type: 12db (0), ladder (1), or 24db (2).', link: 'https://strudel.cc/learn/effects/#ftype' },
    attack: { summary: 'Amplitude envelope attack time (seconds).', link: 'https://strudel.cc/learn/effects/#attack' },
    att: { summary: 'Synonym for attack.', link: 'https://strudel.cc/learn/effects/#attack' },
    decay: { summary: 'Amplitude envelope decay time (seconds).', link: 'https://strudel.cc/learn/effects/#decay' },
    dec: { summary: 'Synonym for decay.', link: 'https://strudel.cc/learn/effects/#decay' },
    sustain: { summary: 'Amplitude envelope sustain level (0–1).', link: 'https://strudel.cc/learn/effects/#sustain' },
    sus: { summary: 'Synonym for sustain.', link: 'https://strudel.cc/learn/effects/#sustain' },
    release: { summary: 'Amplitude envelope release time (seconds).', link: 'https://strudel.cc/learn/effects/#release' },
    rel: { summary: 'Synonym for release.', link: 'https://strudel.cc/learn/effects/#release' },
    adsr: { summary: 'ADSR envelope: attack, decay, sustain, release.', link: 'https://strudel.cc/learn/effects/#adsr' },
    lpa: { summary: 'Lowpass filter envelope attack. Synonym: lpattack.', link: 'https://strudel.cc/learn/effects/#lpattack' },
    lpattack: { summary: 'Lowpass filter envelope attack time.', link: 'https://strudel.cc/learn/effects/#lpattack' },
    lpd: { summary: 'Lowpass filter envelope decay. Synonym: lpdecay.', link: 'https://strudel.cc/learn/effects/#lpdecay' },
    lpdecay: { summary: 'Lowpass filter envelope decay time.', link: 'https://strudel.cc/learn/effects/#lpdecay' },
    lps: { summary: 'Lowpass filter envelope sustain. Synonym: lpsustain.', link: 'https://strudel.cc/learn/effects/#lpsustain' },
    lpsustain: { summary: 'Lowpass filter envelope sustain level.', link: 'https://strudel.cc/learn/effects/#lpsustain' },
    lpr: { summary: 'Lowpass filter envelope release. Synonym: lprelease.', link: 'https://strudel.cc/learn/effects/#lprelease' },
    lprelease: { summary: 'Lowpass filter envelope release time.', link: 'https://strudel.cc/learn/effects/#lprelease' },
    lpenv: { summary: 'Lowpass filter envelope modulation depth.', link: 'https://strudel.cc/learn/effects/#lpenv' },
    lpe: { summary: 'Synonym for lpenv.', link: 'https://strudel.cc/learn/effects/#lpenv' },
    pattack: { summary: 'Pitch envelope attack time.', link: 'https://strudel.cc/learn/effects/#pattack' },
    patt: { summary: 'Synonym for pattack.', link: 'https://strudel.cc/learn/effects/#pattack' },
    pdecay: { summary: 'Pitch envelope decay time.', link: 'https://strudel.cc/learn/effects/#pdecay' },
    pdec: { summary: 'Synonym for pdecay.', link: 'https://strudel.cc/learn/effects/#pdecay' },
    prelease: { summary: 'Pitch envelope release time.', link: 'https://strudel.cc/learn/effects/#prelease' },
    prel: { summary: 'Synonym for prelease.', link: 'https://strudel.cc/learn/effects/#prelease' },
    penv: { summary: 'Pitch envelope amount (semitones). Negative flips envelope.', link: 'https://strudel.cc/learn/effects/#penv' },
    pcurve: { summary: 'Pitch envelope curve: 0 = linear, 1 = exponential.', link: 'https://strudel.cc/learn/effects/#pcurve' },
    panchor: { summary: 'Pitch envelope range anchor (0 or 1).', link: 'https://strudel.cc/learn/effects/#panchor' },
    velocity: { summary: 'Velocity 0–1. Multiplied with gain.', link: 'https://strudel.cc/learn/effects/#velocity' },
    compressor: { summary: 'Dynamics compressor. Params: threshold:ratio:knee:attack:release.', link: 'https://strudel.cc/learn/effects/#compressor' },
    postgain: { summary: 'Gain applied after all effects.', link: 'https://strudel.cc/learn/effects/#postgain' },
    post: { summary: 'Synonym for postgain.', link: 'https://strudel.cc/learn/effects/#postgain' },
    xfade: { summary: 'Crossfade between two patterns (0–1).', link: 'https://strudel.cc/learn/effects/#xfade' },
    juxBy: { summary: 'Jux with adjustable stereo width (0 = mono, 1 = full).', link: 'https://strudel.cc/learn/effects/#juxby' },
    coarse: { summary: 'Sample-rate reduction (fake resampling). 1 = original, 2 = half, etc.', link: 'https://strudel.cc/learn/effects/#coarse' },
    crush: { summary: 'Bit crusher. Depth 1 (drastic) to 16 (barely).', link: 'https://strudel.cc/learn/effects/#crush' },
    distort: { summary: 'Waveshaping distortion. Optional postgain and type.', link: 'https://strudel.cc/learn/effects/#distort' },
    dist: { summary: 'Synonym for distort.', link: 'https://strudel.cc/learn/effects/#distort' },
    orbit: { summary: 'Global output/orbit for shared delay/reverb. Same orbit = shared effects.', link: 'https://strudel.cc/learn/effects/#orbit' },
    o: { summary: 'Synonym for orbit.', link: 'https://strudel.cc/learn/effects/#orbit' },
    phaser: { summary: 'Phaser effect. Speed in cycles.', link: 'https://strudel.cc/learn/effects/#phaser' },
    ph: { summary: 'Synonym for phaser.', link: 'https://strudel.cc/learn/effects/#phaser' },
    phaserdepth: { summary: 'Phaser depth (0–1).', link: 'https://strudel.cc/learn/effects/#phaserdepth' },
    phasercenter: { summary: 'Phaser center frequency (Hz).', link: 'https://strudel.cc/learn/effects/#phasercenter' },
    phasersweep: { summary: 'Phaser LFO sweep range (Hz).', link: 'https://strudel.cc/learn/effects/#phasersweep' },
    duckorbit: { summary: 'Duck an orbit (sidechain-style). Target orbit number.', link: 'https://strudel.cc/learn/effects/#duckorbit' },
    duck: { summary: 'Synonym for duckorbit.', link: 'https://strudel.cc/learn/effects/#duckorbit' },
    duckattack: { summary: 'Duck: time for ducked signal to return to normal.', link: 'https://strudel.cc/learn/effects/#duckattack' },
    duckdepth: { summary: 'Duck amount (0–1).', link: 'https://strudel.cc/learn/effects/#duckdepth' },
    tremolosync: { summary: 'Amplitude modulation speed in cycles. Synonym: tremsync.', link: 'https://strudel.cc/learn/effects/#tremolosync' },
    tremsync: { summary: 'Synonym for tremolosync.', link: 'https://strudel.cc/learn/effects/#tremolosync' },
    tremolodepth: { summary: 'Tremolo depth.', link: 'https://strudel.cc/learn/effects/#tremolodepth' },
    tremoloskew: { summary: 'Tremolo waveform shape (0–1).', link: 'https://strudel.cc/learn/effects/#tremoloskew' },
    tremolophase: { summary: 'Tremolo phase offset (cycles).', link: 'https://strudel.cc/learn/effects/#tremolophase' },
    tremoloshape: { summary: 'Tremolo shape: tri, square, sine, saw, ramp.', link: 'https://strudel.cc/learn/effects/#tremoloshape' },
    /* Synths: https://strudel.cc/learn/synths/ */
    sound: { summary: 'Synth waveform: sine, sawtooth, square, triangle, white, pink, brown, user.', link: 'https://strudel.cc/learn/synths/#basic-waveforms' },
    partials: { summary: 'Additive synth: magnitude of harmonics (array). Use with sound("user") or filter.', link: 'https://strudel.cc/learn/synths/#partials' },
    phases: { summary: 'Phase of each harmonic for additive synthesis.', link: 'https://strudel.cc/learn/synths/#phases' },
    vib: { summary: 'Vibrato: frequency in Hz. Optional depth with ":".', link: 'https://strudel.cc/learn/synths/#vib' },
    vibmod: { summary: 'Vibrato depth in semitones. Use with vib.', link: 'https://strudel.cc/learn/synths/#vibmod' },
    fm: { summary: 'FM synthesis: modulation index (brightness).', link: 'https://strudel.cc/learn/synths/#fm' },
    fmh: { summary: 'FM harmonicity ratio (timbre).', link: 'https://strudel.cc/learn/synths/#fmh' },
    fmattack: { summary: 'FM envelope attack time.', link: 'https://strudel.cc/learn/synths/#fmattack' },
    fmdecay: { summary: 'FM envelope decay time.', link: 'https://strudel.cc/learn/synths/#fmdecay' },
    fmsustain: { summary: 'FM envelope sustain level.', link: 'https://strudel.cc/learn/synths/#fmsustain' },
    fmenv: { summary: 'FM envelope ramp type: lin or exp.', link: 'https://strudel.cc/learn/synths/#fmenv' },
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
    /* Random modifiers: https://strudel.cc/learn/random-modifiers/ */
    choose: { summary: 'Pick randomly from a list of values/patterns.', link: 'https://strudel.cc/learn/random-modifiers/#choose' },
    wchoose: { summary: 'Weighted random choice from [value, weight] pairs.', link: 'https://strudel.cc/learn/random-modifiers/#wchoose' },
    chooseCycles: { summary: 'Pick one element at random each cycle. Synonym: randcat.', link: 'https://strudel.cc/learn/random-modifiers/#choosecycles' },
    randcat: { summary: 'Synonym for chooseCycles.', link: 'https://strudel.cc/learn/random-modifiers/#choosecycles' },
    wchooseCycles: { summary: 'Weighted random pick per cycle. Synonym: wrandcat.', link: 'https://strudel.cc/learn/random-modifiers/#wchoosecycles' },
    wrandcat: { summary: 'Synonym for wchooseCycles.', link: 'https://strudel.cc/learn/random-modifiers/#wchoosecycles' },
    degradeBy: { summary: 'Randomly remove events (0–1 = 0–100% removal).', link: 'https://strudel.cc/learn/random-modifiers/#degradeby' },
    degrade: { summary: 'Remove 50% of events at random. Like degradeBy(0.5).', link: 'https://strudel.cc/learn/random-modifiers/#degrade' },
    undegradeBy: { summary: 'Inverse of degradeBy: 0 = 100% removal, 1 = 0%.', link: 'https://strudel.cc/learn/random-modifiers/#undegradeby' },
    undegrade: { summary: 'Inverse of degrade (50%).', link: 'https://strudel.cc/learn/random-modifiers/#undegrade' },
    sometimes: { summary: 'Apply function with 50% chance.', link: 'https://strudel.cc/learn/random-modifiers/#sometimes' },
    sometimesBy: { summary: 'Apply function with given probability (0–1).', link: 'https://strudel.cc/learn/random-modifiers/#sometimesby' },
    someCycles: { summary: 'Apply function 50% of cycles. Like someCyclesBy(0.5, fn).', link: 'https://strudel.cc/learn/random-modifiers/#somecycles' },
    someCyclesBy: { summary: 'Apply function with probability on a per-cycle basis.', link: 'https://strudel.cc/learn/random-modifiers/#somecyclesby' },
    often: { summary: 'Shorthand for sometimesBy(0.75, fn).', link: 'https://strudel.cc/learn/random-modifiers/#often' },
    rarely: { summary: 'Shorthand for sometimesBy(0.25, fn).', link: 'https://strudel.cc/learn/random-modifiers/#rarely' },
    almostNever: { summary: 'Shorthand for sometimesBy(0.1, fn).', link: 'https://strudel.cc/learn/random-modifiers/#almostnever' },
    almostAlways: { summary: 'Shorthand for sometimesBy(0.9, fn).', link: 'https://strudel.cc/learn/random-modifiers/#almostalways' },
    never: { summary: 'sometimesBy(0, fn) – never apply.', link: 'https://strudel.cc/learn/random-modifiers/#never' },
    always: { summary: 'sometimesBy(1, fn) – always apply.', link: 'https://strudel.cc/learn/random-modifiers/#always' },
    /* Signals: https://strudel.cc/learn/signals/ */
    rand: { summary: 'Continuous random 0–1. Use rand.range(a,b) for range.', link: 'https://strudel.cc/learn/signals/#rand' },
    irand: { summary: 'Continuous random integers 0 to n-1.', link: 'https://strudel.cc/learn/signals/#irand' },
    perlin: { summary: 'Perlin noise signal (0–1). Smooth random.', link: 'https://strudel.cc/learn/signals/#perlin' },
    saw: { summary: 'Sawtooth signal 0–1. Use .range(), .slow(), .segment().', link: 'https://strudel.cc/learn/signals/#saw' },
    sine: { summary: 'Sine signal 0–1.', link: 'https://strudel.cc/learn/signals/#sine' },
    tri: { summary: 'Triangle signal 0–1.', link: 'https://strudel.cc/learn/signals/#tri' },
    square: { summary: 'Square signal 0–1.', link: 'https://strudel.cc/learn/signals/#square' },
    brand: { summary: 'Binary random 0 or 1.', link: 'https://strudel.cc/learn/signals/#brand' },
    brandBy: { summary: 'Binary random with probability for 1.', link: 'https://strudel.cc/learn/signals/#brandby' },
    every: { summary: 'Apply function every n cycles (e.g. .every(4, rev)).', link: 'https://strudel.cc/learn/conditional-modifiers/' },
    /* Code: https://strudel.cc/learn/code/ */
    register: { summary: 'Register a custom chained function for reuse.', link: 'https://strudel.cc/learn/code/#write-your-own-chained-function' },
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
    // Resolve position: if click is on non-word char, try to get an adjacent word
    let p = pos;
    if (!isWordChar(doc[p])) {
        if (p > 0 && isWordChar(doc[p - 1])) p = p - 1;           // e.g. click just after "samples" before "("
        else if (p < len - 1 && doc[p] === '.' && isWordChar(doc[p + 1])) p = p + 1;  // e.g. click on "." in ".dict("
        else return null;
    }
    if (!isWordChar(doc[p])) return null;
    let from = p;
    while (from > 0 && isWordChar(doc[from - 1])) from--;
    let to = p;
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
        /** @type {{ tags: Array<{id:string, label?:string}>, examples: Array<{id?:string, label?:string, code?:string, tags?: string[]}> }} Loaded from pallet-tags.json */
        this.palletData = { tags: [], examples: [] };
        /** @type {import('@codemirror/view').EditorView[]} Read-only CodeMirror views for palette examples; destroyed on re-render. */
        this._palletExampleViews = [];
        this.initStrudel();
        this.initSaveLoadButtons();
        this.initSettingsPanel();
        this.initDocsPaletteButtons();
        this.initPalletButtons();
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
            const { getAudioContext, webaudioOutput, initAudioOnFirstClick, registerSynthSounds, setAudioContext } = strudelWebaudio;

            // Initialize audio context: use explicit options to match REPL quality and reduce buzz/crackle.
            // - latencyHint: 'playback' uses a larger buffer than default 'interactive', reducing buffer underruns.
            // - setAudioContext() ensures superdough/webaudio use this same context (same as webaudioRepl).
            const ctx = new AudioContext({ latencyHint: 'playback' });
            setAudioContext(ctx);
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
     * Optional URL to a strudel.json that provides VCSL/GM sounds (gm_epiano1, gm_acoustic_bass, etc.).
     * When set and loaded successfully, we do not substitute those with built-in synths.
     * Set to a full URL when available (e.g. https://strudel.cc/sounds.json if strudel.cc exposes it, or a self-hosted strudel.json).
     */
    static get VCSL_SAMPLE_PACK_URL() {
        return null;
    }

    /**
     * Default sample packs to load so built-in sounds (bd, sd, hh, gtr, moog, etc.) work without adding samples() in user code.
     * If VCSL_SAMPLE_PACK_URL is set, it is tried first so GM sounds use VCSL instead of synth substitution.
     */
    static get DEFAULT_SAMPLE_PACKS() {
        const packs = ['github:tidalcycles/dirt-samples'];
        const vcsl = this.VCSL_SAMPLE_PACK_URL;
        if (vcsl) packs.unshift(vcsl);
        return packs;
    }

    /**
     * Sample map for RolandTR909 from geikha/tidal-drum-machines so .bank("RolandTR909") works.
     * Keys match Strudel's bank naming: RolandTR909_bd, RolandTR909_sd, etc.
     */
    static get ROLAND_TR909_SAMPLE_MAP() {
        const base = 'machines/RolandTR909/rolandtr909-';
        return {
            RolandTR909_bd: [base + 'bd/Bassdrum-01.wav', base + 'bd/Bassdrum-02.wav', base + 'bd/Bassdrum-03.wav', base + 'bd/Bassdrum-04.wav'],
            RolandTR909_sd: [base + 'sd/sd01.wav', base + 'sd/sd02.wav', base + 'sd/sd03.wav', base + 'sd/sd04.wav', base + 'sd/sd05.wav', base + 'sd/sd06.wav', base + 'sd/sd07.wav', base + 'sd/sd08.wav', base + 'sd/sd09.wav', base + 'sd/sd10.wav'],
            RolandTR909_hh: [base + 'hh/hh01.wav', base + 'hh/hh02.wav', base + 'hh/hh03.wav', base + 'hh/hh04.wav'],
            RolandTR909_oh: [base + 'oh/oh01.wav', base + 'oh/oh02.wav', base + 'oh/oh03.wav', base + 'oh/oh04.wav'],
        };
    }

    /** Base URL for tidal-drum-machines (geikha) so RolandTR909 samples load. */
    static get TIDAL_DRUM_MACHINES_BASE_URL() {
        return 'https://raw.githubusercontent.com/geikha/tidal-drum-machines/main/';
    }

    /**
     * Load default sample packs so drums and common sounds are available without adding samples() in user code.
     * When VCSL pack loads successfully, GM substitution is disabled so gm_epiano1 / gm_acoustic_bass use real samples.
     * Also loads RolandTR909 samples from tidal-drum-machines so .bank("RolandTR909") works.
     */
    async loadDefaultSamplePacks() {
        if (!this.strudelEvaluate) return;
        this.vcslGmSoundsAvailable = false;
        const packs = this.constructor.DEFAULT_SAMPLE_PACKS;
        const vcslUrl = this.constructor.VCSL_SAMPLE_PACK_URL;
        for (const pack of packs) {
            try {
                await this.strudelEvaluate(`await samples('${pack}');`, false);
                if (pack === vcslUrl) this.vcslGmSoundsAvailable = true;
                console.log('[StrudelApp] Loaded default sample pack:', pack);
            } catch (e) {
                console.warn('[StrudelApp] Could not load default sample pack', pack, e?.message || e);
            }
        }
        // Load RolandTR909 bank so .bank("RolandTR909") finds RolandTR909_bd, RolandTR909_sd, etc.
        await this.ensureRolandTR909Loaded();
    }

    /**
     * Load RolandTR909 sample map into the global sampler so .bank("RolandTR909") works.
     * Uses globalThis.samples (same as REPL) so registration is in the correct sound map.
     * Call at init and optionally again before play when code uses .bank("RolandTR909").
     */
    async ensureRolandTR909Loaded() {
        try {
            const samplesFn = typeof globalThis !== 'undefined' && globalThis.samples;
            if (typeof samplesFn !== 'function') {
                console.warn('[StrudelApp] samples not available on globalThis, skipping RolandTR909 load');
                return;
            }
            const map = this.constructor.ROLAND_TR909_SAMPLE_MAP;
            const baseUrl = this.constructor.TIDAL_DRUM_MACHINES_BASE_URL;
            await samplesFn(map, baseUrl);
            console.log('[StrudelApp] Loaded RolandTR909 drum bank (tidal-drum-machines)');
        } catch (e) {
            console.warn('[StrudelApp] Could not load RolandTR909 bank', e?.message || e);
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
     * Show documentation for a Strudel function in the docs panel (loads URL in iframe).
     * @param {string} name - function name (e.g. s, fit, slice, gain)
     */
    showDoc(name) {
        const doc = STRUDEL_DOCS[name];
        if (doc?.link) {
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
        // Switch to Docs panel so the user sees the loaded doc (in case Palette was selected)
        const strudelDocs = document.getElementById('strudel-docs');
        const strudelPallet = document.getElementById('strudel-pallet');
        const showDocsBtn = document.getElementById('showDocsBtn');
        const showPaletteBtn = document.getElementById('showPaletteBtn');
        if (strudelDocs && strudelPallet) {
            strudelDocs.removeAttribute('hidden');
            strudelPallet.setAttribute('hidden', '');
        }
        if (showDocsBtn && showPaletteBtn) {
            showDocsBtn.classList.add('button-depressed');
            showPaletteBtn.classList.remove('button-depressed');
        }
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
     * Initialize Docs / Palette toggle buttons in horrizontal-split: show one panel, hide the other; toggle button-depressed.
     */
    initDocsPaletteButtons() {
        const showDocsBtn = document.getElementById('showDocsBtn');
        const showPaletteBtn = document.getElementById('showPaletteBtn');
        const strudelDocs = document.getElementById('strudel-docs');
        const strudelPallet = document.getElementById('strudel-pallet');

        if (!showDocsBtn || !showPaletteBtn || !strudelDocs || !strudelPallet) return;

        function showDocs() {
            strudelDocs.removeAttribute('hidden');
            strudelPallet.setAttribute('hidden', '');
            showDocsBtn.classList.add('button-depressed');
            showPaletteBtn.classList.remove('button-depressed');
        }

        function showPalette() {
            strudelPallet.removeAttribute('hidden');
            strudelDocs.setAttribute('hidden', '');
            showPaletteBtn.classList.add('button-depressed');
            showDocsBtn.classList.remove('button-depressed');
        }

        showDocsBtn.addEventListener('click', showDocs);
        showPaletteBtn.addEventListener('click', showPalette);
    }

    /**
     * Load palette tags from pallet-tags.json and create pallet-btn elements. Click toggles button-depressed and refreshes examples.
     */
    async initPalletButtons() {
        const container = document.querySelector('.pallet-button-container');
        const contentEl = document.querySelector('.strudel-pallet-content');
        if (!container) return;

        try {
            const url = new URL('pallet-tags.json', window.location.href).href;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data?.tags && Array.isArray(data.tags)) {
                    this.palletData.tags = data.tags;
                }
                if (data?.examples && Array.isArray(data.examples)) {
                    this.palletData.examples = data.examples;
                }
            }
        } catch (e) {
            console.warn('[StrudelApp] Could not load pallet-tags.json:', e?.message || e);
        }

        container.innerHTML = '';
        for (const tag of this.palletData.tags) {
            const id = typeof tag === 'string' ? tag : tag?.id ?? '';
            const label = typeof tag === 'object' && tag?.label != null ? tag.label : id;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pallet-btn';
            btn.setAttribute('data-pallet-category', id);
            btn.textContent = label;
            btn.addEventListener('click', () => {
                btn.classList.toggle('button-depressed');
                this.renderPalletExamples();
            });
            container.appendChild(btn);
        }

        if (contentEl) this.renderPalletExamples();
    }

    /**
     * Show in strudel-pallet-content all examples whose tags include every currently selected (depressed) tag.
     * If no tag is selected, show all examples. Each example gets a read-only CodeMirror with syntax highlighting.
     */
    async renderPalletExamples() {
        const contentEl = document.querySelector('.strudel-pallet-content');
        if (!contentEl) return;

        (this._palletExampleViews || []).forEach((v) => {
            try {
                v.destroy();
            } catch (_) {}
        });
        this._palletExampleViews = [];
        contentEl.innerHTML = '';

        const selectedTags = Array.from(document.querySelectorAll('.pallet-btn.button-depressed'))
            .map((btn) => btn.getAttribute('data-pallet-category'))
            .filter(Boolean);

        const examples = this.palletData.examples.filter((ex) => {
            const exTags = Array.isArray(ex.tags) ? ex.tags : [];
            if (selectedTags.length === 0) return true;
            return selectedTags.every((t) => exTags.includes(t));
        });

        if (examples.length === 0) {
            contentEl.textContent = selectedTags.length === 0 ? 'Select one or more tags to filter examples.' : 'No examples match the selected tags.';
            return;
        }
        const list = document.createElement('ul');
        list.className = 'pallet-examples-list';
        const mounts = [];
        for (const ex of examples) {
            const li = document.createElement('li');
            li.className = 'pallet-example-item';
            const main = document.createElement('div');
            main.className = 'pallet-example-main';
            const labelEl = document.createElement('span');
            labelEl.className = 'pallet-example-label';
            labelEl.textContent = ex.label ?? ex.id ?? 'Untitled';
            main.appendChild(labelEl);
            if (ex.code) {
                const codeMount = document.createElement('div');
                codeMount.className = 'pallet-example-cm-container';
                main.appendChild(codeMount);
                mounts.push({ el: codeMount, code: ex.code });
            }
            li.appendChild(main);
            const actions = document.createElement('div');
            actions.className = 'pallet-example-actions';
            const playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'pallet-example-btn pallet-example-play';
            playBtn.title = 'Play';
            playBtn.textContent = 'Play';
            playBtn.addEventListener('click', () => this.playExampleCode(ex.code));
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'pallet-example-btn pallet-example-copy';
            copyBtn.title = 'Copy to clipboard';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => this.copyExampleToClipboard(ex.code));
            actions.appendChild(playBtn);
            actions.appendChild(copyBtn);
            li.appendChild(actions);
            list.appendChild(li);
        }
        contentEl.appendChild(list);
        for (const { el, code } of mounts) {
            await this.createPalletExampleCodeMirror(el, code);
        }
    }

    /**
     * Create a read-only CodeMirror view for palette example code (syntax highlighting only). Does not touch the main editor.
     * On failure falls back to a plain <pre>.
     * @param {HTMLElement} container - Element to mount the editor into (or fallback pre)
     * @param {string} code - Example code text
     */
    async createPalletExampleCodeMirror(container, code) {
        try {
            const [stateMod, viewMod, langJs, langMod] = await Promise.all([
                import('@codemirror/state'),
                import('@codemirror/view'),
                import('@codemirror/lang-javascript'),
                import('@codemirror/language'),
            ]);
            const { EditorState } = stateMod;
            const { EditorView } = viewMod;
            const { javascript } = langJs;
            const { defaultHighlightStyle, syntaxHighlighting } = langMod;
            const state = EditorState.create({
                doc: code,
                extensions: [
                    javascript(),
                    syntaxHighlighting(defaultHighlightStyle),
                    EditorView.editable.of(false),
                    EditorView.lineWrapping,
                ],
            });
            const view = new EditorView({
                state,
                parent: container,
            });
            (this._palletExampleViews = this._palletExampleViews || []).push(view);
        } catch (e) {
            console.warn('[StrudelApp] Palette example CodeMirror failed, using plain pre:', e?.message || e);
            container.innerHTML = '';
            const pre = document.createElement('pre');
            pre.className = 'pallet-example-code';
            pre.textContent = code;
            container.appendChild(pre);
        }
    }

    /**
     * Play a single example code snippet programmatically (does not use or change the editor).
     * Plays one cycle then stops.
     * @param {string} code - Example code to play
     */
    async playExampleCode(code) {
        if (!code || !code.trim()) return;
        await this.playStrudelContent(code, 1);
    }

    /**
     * Copy example code to the clipboard.
     * @param {string} code - Example code to copy
     */
    async copyExampleToClipboard(code) {
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
        } catch (e) {
            console.warn('[StrudelApp] Could not copy to clipboard:', e?.message || e);
        }
    }

    /**
     * Initialize settings button and panel. Uses shared initSettingsPanel with shared + strudel settings-fields.json.
     */
    initSettingsPanel() {
        initSettingsPanelShared({
            getFields: async () => {
                let sharedFields = DEFAULT_SETTINGS_FIELDS;
                try {
                    const sharedUrl = new URL('../shared/settings-fields.json', window.location.href).href;
                    const sharedRes = await fetch(sharedUrl);
                    if (sharedRes.ok) {
                        const loaded = await sharedRes.json();
                        if (Array.isArray(loaded) && loaded.length > 0 && loaded.every((f) => f.id && f.label)) {
                            sharedFields = loaded;
                        }
                    }
                } catch (e) {
                    console.warn('[StrudelApp] Could not load shared settings-fields.json, using defaults:', e?.message || e);
                }
                let strudelFields = [];
                try {
                    const strudelUrl = new URL('settings-fields.json', window.location.href).href;
                    const strudelRes = await fetch(strudelUrl);
                    if (strudelRes.ok) {
                        const loaded = await strudelRes.json();
                        if (Array.isArray(loaded) && loaded.every((f) => f.id && f.label)) {
                            strudelFields = loaded;
                        }
                    }
                } catch (e) {
                    console.warn('[StrudelApp] Could not load strudel settings-fields.json:', e?.message || e);
                }
                return [...sharedFields, ...strudelFields];
            },
            getValues: () => (window.electron && typeof window.electron.getWindowPosition === 'function' ? window.electron.getWindowPosition() : null),
            applyValues: (values) => {
                if (window.electron?.moveWindowTo) {
                    window.electron.moveWindowTo(values.x, values.y, values.width, values.height);
                }
            },
            validate: (values) => {
                const { x, y, width, height } = values;
                return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && width >= 100 && Number.isFinite(height) && height >= 100;
            },
            logLabel: 'StrudelApp',
        });
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
     * Substitute GM sample names with built-in synths only when VCSL is not loaded.
     * When vcslGmSoundsAvailable (VCSL pack loaded), leave code unchanged so gm_epiano1 / gm_acoustic_bass use real samples.
     * Inline comments indicate which sample was substituted.
     */
    substituteGMWithBuiltinSynths(code) {
        if (!code || typeof code !== 'string') return code;
        if (this.vcslGmSoundsAvailable) return code;
        return code
            .replace(/\.s\(["']gm_epiano1[^"']*["']\)/g, '.s("triangle").gain(0.6) // was gm_epiano1')
            .replace(/\.s\(["']gm_acoustic_bass["']\)/g, '.s("sawtooth").gain(0.5) // was gm_acoustic_bass');
    }

    /**
     * Find the position of the closing ')' that matches the '(' at openPos.
     * Skips over strings and nested parens.
     */
    _findMatchingCloseParen(str, openPos) {
        let depth = 1;
        let i = openPos + 1;
        while (i < str.length && depth > 0) {
            const ch = str[i];
            if (ch === '"' || ch === "'" || ch === '`') {
                const quote = ch;
                i++;
                while (i < str.length && str[i] !== quote) {
                    if (str[i] === '\\') i++;
                    i++;
                }
                i++;
                continue;
            }
            if (ch === '(' || ch === '[' || ch === '{') depth++;
            else if (ch === ')' || ch === ']' || ch === '}') {
                depth--;
                if (ch === ')' && depth === 0) return i;
            }
            i++;
        }
        return -1;
    }

    /**
     * Map a range [from, to] in substituted (actual) playCode back to original playCode.
     * Handles (1) substituteGMWithBuiltinSynths and (2) viz injection (.scope() -> .tag(id).scope({ ctx, id })).
     */
    _mapActualPlayCodeRangeToOriginal(actualPlayCode, originalPlayCode, actualFrom, actualTo) {
        if (actualPlayCode === originalPlayCode) return [actualFrom, actualTo];

        // Build viz replacement spans: .tag(N).(scope|...)(...) in actual vs .(scope|...)(...) in original
        const vizMethods = 'pianoroll|punchcard|spiral|scope|spectrum|pitchwheel';
        const actualSpans = [];
        const actualVizStartRe = new RegExp(`\\.tag\\(\\d+\\)\\.(${vizMethods})\\s*\\(`, 'g');
        let m;
        while ((m = actualVizStartRe.exec(actualPlayCode)) !== null) {
            const open = m.index + m[0].length - 1; // position of '('
            const close = this._findMatchingCloseParen(actualPlayCode, open);
            if (close !== -1) actualSpans.push({ from: m.index, to: close + 1 });
        }
        const originalSpans = [];
        const originalVizStartRe = new RegExp(`\\.(${vizMethods})\\s*\\(`, 'g');
        while ((m = originalVizStartRe.exec(originalPlayCode)) !== null) {
            const open = m.index + m[0].length - 1;
            const close = this._findMatchingCloseParen(originalPlayCode, open);
            if (close !== -1) originalSpans.push({ from: m.index, to: close + 1 });
        }

        const segments = [];
        for (let i = 0; i < actualSpans.length && i < originalSpans.length; i++) {
            segments.push({
                actualFrom: actualSpans[i].from,
                actualTo: actualSpans[i].to,
                originalFrom: originalSpans[i].from,
                originalTo: originalSpans[i].to,
            });
        }
        segments.sort((a, b) => a.actualFrom - b.actualFrom);

        const actualToOriginal = (p) => {
            let offset = 0;
            for (const seg of segments) {
                if (p < seg.actualFrom) return p - offset;
                if (p < seg.actualTo) {
                    const frac = (p - seg.actualFrom) / (seg.actualTo - seg.actualFrom);
                    return seg.originalFrom + Math.floor(frac * (seg.originalTo - seg.originalFrom));
                }
                offset += (seg.actualTo - seg.actualFrom) - (seg.originalTo - seg.originalFrom);
            }
            return p - offset;
        };

        if (actualFrom >= actualPlayCode.length) actualFrom = actualPlayCode.length - 1;
        if (actualTo > actualPlayCode.length) actualTo = actualPlayCode.length;
        if (actualFrom >= actualTo) return [actualToOriginal(actualFrom), actualToOriginal(actualFrom)];

        const origFrom = actualToOriginal(actualFrom);
        const origToEnd = actualToOriginal(actualTo - 1);
        const origTo = origToEnd + 1;

        if (segments.length > 0) return [Math.max(0, origFrom), Math.min(originalPlayCode.length, origTo)];

        // GM substitution (must match substituteGMWithBuiltinSynths including inline comments)
        const subs = [
            [/\.s\(["']gm_epiano1[^"']*["']\)/g, '.s("triangle").gain(0.6) // was gm_epiano1'],
            [/\.s\(["']gm_acoustic_bass["']\)/g, '.s("sawtooth").gain(0.5) // was gm_acoustic_bass'],
        ];
        const matches = [];
        for (const [regex, repl] of subs) {
            let match;
            while ((match = regex.exec(originalPlayCode)) !== null) {
                matches.push({ start: match.index, end: match.index + match[0].length, repl });
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
        if (actualFrom >= map.length) return [origFrom, origTo];
        let gmOrigFrom = map[actualFrom].from;
        let gmOrigTo = actualTo > 0 && actualTo - 1 < map.length ? map[actualTo - 1].to : gmOrigFrom;
        for (let i = actualFrom; i < actualTo && i < map.length; i++) {
            gmOrigFrom = Math.min(gmOrigFrom, map[i].from);
            gmOrigTo = Math.max(gmOrigTo, map[i].to);
        }
        return [gmOrigFrom, gmOrigTo];
    }

    /** Count visualization method calls (scope, pianoroll, etc.) in code for multi-vis support. */
    countVizCallsInCode(code) {
        const matches = code.match(/\.(pianoroll|punchcard|spiral|scope|spectrum|pitchwheel)\s*\(/g);
        return matches ? matches.length : 0;
    }

    /**
     * Build stack(...) play code from pattern lines and create pattern visualizations.
     * Returns the playCode string to pass to strudelEvaluate.
     * Supports multiple viz calls per pattern block (e.g. two .scope() in one stack).
     */
    buildStackPlayCodeFromDollarLines(dollarLines) {
        let globalVizIndex = 0;
        const normalized = dollarLines.map((item, index) => {
            let s = item.code
                .replace(/\._pianoroll\b/g, '.pianoroll')
                .replace(/\._punchcard\b/g, '.punchcard')
                .replace(/\._spiral\b/g, '.spiral')
                .replace(/\._scope\b/g, '.scope')
                .replace(/\._spectrum\b/g, '.spectrum')
                .replace(/\._pitchwheel\b/g, '.pitchwheel');
            if (item.hasVisualization) {
                const count = this.countVizCallsInCode(s);
                for (let i = 0; i < count; i++) {
                    this.createPatternVisualization(globalVizIndex + i, item.lineNumber, i);
                }
                const startGlobal = globalVizIndex;
                globalVizIndex += count;
                let occurrence = 0;
                s = s.replace(
                    /\.(pianoroll|punchcard|spiral|scope|spectrum|pitchwheel)\s*\(([^)]*)\)/g,
                    (match, vizType, args) => {
                        const canvasId = `'strudel-viz-${startGlobal + occurrence}'`;
                        const vizId = startGlobal + occurrence + 1;
                        occurrence++;
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

    /** Default cycle duration in ms when setcps(0.5) (one cycle every 2 seconds). */
    static get CYCLE_MS() {
        return 2000;
    }

    /**
     * Play/evaluate Strudel code. If codeToPlay is provided, uses it; otherwise uses the editor content.
     * Pattern lines are executed as a single stack; setup lines run in the same scope.
     * @param {string|null|undefined} [codeToPlay] - Optional code string to play (e.g. palette example). When omitted, uses editor content.
     * @param {number|undefined} [cycles] - If a positive number, stop playback after this many cycles (default cycle = 2s). If undefined, play until stopped.
     */
    async playStrudelContent(codeToPlay, cycles) {
        try {
            const code = codeToPlay != null ? codeToPlay : this.getEditorContent();
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
                        // Load RolandTR909 bank before play if code uses .bank("RolandTR909") so sounds are registered
                        if (/\.bank\s*\(\s*["']RolandTR909["']\s*\)/.test(code)) {
                            await this.ensureRolandTR909Loaded();
                        }
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
                        if (typeof cycles === 'number' && cycles > 0 && typeof this.strudelStop === 'function') {
                            setTimeout(() => this.strudelStop(), cycles * StrudelApp.CYCLE_MS);
                        }
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
                let globalVizIndex = 0;
                dollarLines.forEach((item, index) => {
                    let code = normalizeVisuals(item.code);
                    
                    // If this pattern has visualization(s), create one canvas per viz and inject ctx (multi-vis support)
                    if (item.hasVisualization) {
                        const count = this.countVizCallsInCode(code);
                        for (let i = 0; i < count; i++) {
                            this.createPatternVisualization(globalVizIndex + i, item.lineNumber, i);
                        }
                        const startGlobal = globalVizIndex;
                        globalVizIndex += count;
                        let occurrence = 0;
                        code = code.replace(
                            /\.(pianoroll|punchcard|spiral|scope|spectrum|pitchwheel)\s*\(([^)]*)\)/g,
                            (match, vizType, args) => {
                                const canvasId = `'strudel-viz-${startGlobal + occurrence}'`;
                                const vizId = startGlobal + occurrence + 1;
                                occurrence++;
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
                                if (typeof cycles === 'number' && cycles > 0 && typeof this.strudelStop === 'function') {
                                    setTimeout(() => this.strudelStop(), cycles * StrudelApp.CYCLE_MS);
                                }
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
                                if (typeof cycles === 'number' && cycles > 0 && typeof this.strudelStop === 'function') {
                                    setTimeout(() => this.strudelStop(), cycles * StrudelApp.CYCLE_MS);
                                }
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

    /** Height in px of each visualization container (for stacking multiple viz in one block). */
    static get VIZ_CONTAINER_HEIGHT() {
        return 100;
    }

    /**
     * Create a visualization canvas for one viz slot (supports multiple viz per pattern block).
     * @param {number} globalVizIndex - Unique index across all viz (0, 1, 2, …); used for canvas id and storage key.
     * @param {number} lineNumber - Start line of the pattern block (0-based).
     * @param {number} [occurrenceInBlock=0] - Which viz in this block (0 = first), used to stack containers vertically.
     * @returns The visualization object (container, canvas, ctx, updatePosition, etc.) or null.
     */
    createPatternVisualization(globalVizIndex, lineNumber, occurrenceInBlock = 0) {
        const textarea = this.getEditorElement();
        if (!textarea) return null;

        // Calculate how many lines the pattern spans
        const codeText = textarea.value;
        const allLines = codeText.split('\n');
        
        let endLineNumber = lineNumber;
        let i = lineNumber;
        let foundNonBlank = false;
        
        while (i < allLines.length) {
            const line = allLines[i];
            const trimmed = line.trim();
            
            if (trimmed === '') {
                i++;
                continue;
            }
            if (trimmed.startsWith('//')) {
                if (foundNonBlank) break;
                i++;
                continue;
            }
            if (i === lineNumber || /^\s*\./.test(line) || (foundNonBlank && !trimmed.match(/^\s*[a-zA-Z_$]/))) {
                endLineNumber = i;
                foundNonBlank = true;
                i++;
            } else {
                if (foundNonBlank) break;
                if (i > lineNumber) {
                    endLineNumber = i;
                    foundNonBlank = true;
                    i++;
                } else {
                    break;
                }
            }
        }
        
        const container = document.createElement('div');
        container.className = 'strudel-pattern-visualization';
        container.setAttribute('data-viz-index', globalVizIndex);
        container.setAttribute('data-line-number', lineNumber);
        container.setAttribute('data-end-line-number', endLineNumber);

        const canvasId = `strudel-viz-${globalVizIndex}`;
        const canvas = document.createElement('canvas');
        canvas.id = canvasId;
        canvas.setAttribute('aria-hidden', 'true');
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const editorWrap = textarea.closest('.strudel-editor-wrap');
        if (!editorWrap) return null;
        editorWrap.appendChild(container);

        const measureEl = textarea.contentDOM || textarea;
        const lineHeight = parseFloat(getComputedStyle(measureEl).lineHeight) || 21;
        const padding = parseFloat(getComputedStyle(measureEl).paddingTop) || 10;
        const baseTop = (endLineNumber + 1) * lineHeight + padding;
        const scrollTop = textarea.scrollTop || 0;
        const vizHeight = StrudelApp.VIZ_CONTAINER_HEIGHT;
        const top = baseTop - scrollTop + occurrenceInBlock * vizHeight;
        container.style.top = `${top}px`;
        container.style.height = vizHeight + 'px';
        container.style.width = '100%';
        const dpr = window.devicePixelRatio || 1;
        const width = editorWrap.getBoundingClientRect().width || 400;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(vizHeight * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = vizHeight + 'px';
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '12px monospace';
        ctx.fillText('Viz ' + (globalVizIndex + 1) + ' – waiting for draw…', 10, 24);

        const updatePosition = () => {
            const measureEl = textarea.contentDOM || textarea;
            const lineHeight = parseFloat(getComputedStyle(measureEl).lineHeight) || 21;
            const padding = parseFloat(getComputedStyle(measureEl).paddingTop) || 10;
            const baseTop = (endLineNumber + 1) * lineHeight + padding;
            const scrollTop = textarea.scrollTop || 0;
            const top = baseTop - scrollTop + occurrenceInBlock * StrudelApp.VIZ_CONTAINER_HEIGHT;
            container.style.top = `${top}px`;
            const dpr = window.devicePixelRatio || 1;
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                canvas.width = Math.floor(rect.width * dpr);
                canvas.height = Math.floor(rect.height * dpr);
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
            }
        };

        const updateHandler = () => updatePosition();
        setTimeout(() => updatePosition(), 0);
        textarea.addEventListener('scroll', updateHandler);
        window.addEventListener('resize', updateHandler);
        container._updateHandler = updateHandler;

        const viz = {
            container,
            canvas,
            ctx,
            lineNumber,
            code: null,
            pattern: null,
            patternIndex: globalVizIndex,
            updatePosition,
        };
        
        this._patternVisualizations.set(globalVizIndex, viz);
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
