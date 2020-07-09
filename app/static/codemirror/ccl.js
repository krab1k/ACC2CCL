CodeMirror.defineSimpleMode('ccl', {
    start: [
        {regex: /(?:for|each|parameter|done|name|sum|such|EE|that|and|or|not|is|where)\b/, token: 'keyword'},
        {regex: /(?:atom|bond|common)\b/, token: 'atom'},
        {regex: /(?:exp|sqrt|sin|cos|tan|sinh|cosh|tanh)\b/, token: 'builtin'},
        {regex: /#.*/, token: "comment"},
        {regex: /[-+\/*=<>!^]+/, token: "operator"},
        {regex: /[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i, token: "number"},
    ]
});