/**
 * Prism.js grammar for Strudel / mini-notation.
 * Load after prism.min.js.
 */
(function () {
    if (typeof Prism === 'undefined') return;

    Prism.languages.strudel = {
        comment: { pattern: /\/\/.*/, greedy: true },
        string: [
            { pattern: /"(?:[^"\\]|\\.)*"/, greedy: true },
            { pattern: /'(?:[^'\\]|\\.)*'/, greedy: true },
            { pattern: /`(?:[^`\\]|\\.)*`/, greedy: true },
        ],
        number: /%-?\d+|\b\d+\.?\d*\b/,
        'repl-prefix': /\$:/,
        keyword: /\b(?:cps|sound|samples|note|stack|struct|every|slow|fast|gain|speed|rev|chord|scale|m|n|s|rand|segment|cat|append|off|layer|superimpose|jux|juxBy|iter|palindrome|rotate|chunk|substruct|ply|trigger|when|fix|linger|early|late|stretch|compress|trunc|iterate|squeeze|slice|fit|scrub|drop|take|scope|tscope|pianoroll|punchcard|spiral|spectrum|pitchwheel)\b/,
        operator: /[.\[\](){},:~@#-]/,
    };
})();
