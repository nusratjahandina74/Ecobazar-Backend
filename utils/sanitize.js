const sanitizeHtml = require('sanitize-html');

// Rich-text (TipTap / Quill) HTML coming from the dashboard is untrusted: strip scripts, inline handlers, etc.
const OPTIONS = {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
        'blockquote', 'hr', 'a', 'img', 'span', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'mark', 'sub', 'sup'],
    allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'width', 'height'],
        span: ['style'], p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], mark: ['style'],
        th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
    },
    allowedStyles: {
        '*': {
            color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^hsl\(/i],
            'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^hsl\(/i],
            'text-align': [/^(left|right|center|justify)$/],
        },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) },
};
const cleanHtml = (html) => (html ? sanitizeHtml(String(html), OPTIONS) : '');
const cleanText = (s, max = 500) => sanitizeHtml(String(s ?? ''), { allowedTags: [], allowedAttributes: {} }).trim().slice(0, max);

module.exports = { cleanHtml, cleanText };
