import { readFileSync, existsSync } from 'node:fs';
import { marked } from 'marked';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const read = (p) => readFileSync(p, 'utf8');
export const readJson = (p) => JSON.parse(read(p));
export const maybe = (p, fallback = '') => (existsSync(p) ? read(p) : fallback);

// Markdown to HTML for one repository document. Headings can be demoted so the document's own
// title sits under a Part heading. Links to repository files become plain text (the PDF is
// self-contained); external links stay.
export function mdToHtml(source, { demote = 1, dropRelated = true } = {}) {
  let text = source;
  if (dropRelated) text = text.replace(/^\*\*Related:\*\*.*$/gm, '').replace(/^\*\*Planning boundary:\*\*.*$/gm, '');
  const tokens = marked.lexer(text);
  const walk = (list) => {
    for (const t of list) {
      if (t.type === 'heading') t.depth = Math.min(6, t.depth + demote);
    }
  };
  walk(tokens);
  const renderer = {
    code({ text: code, lang }) {
      if (lang === 'mermaid') return `<pre class="mermaid">${esc(code)}</pre>`;
      return `<pre><code>${esc(code)}</code></pre>`;
    },
    link({ href, tokens: inner }) {
      const label = this.parser.parseInline(inner);
      return /^https?:/.test(href) ? `<a href="${esc(href)}">${label}</a>` : `<span class="ref">${label}</span>`;
    },
    heading({ tokens: inner, depth }) {
      return `<h${depth}>${this.parser.parseInline(inner)}</h${depth}>\n`;
    },
  };
  marked.use({ renderer, gfm: true });
  return marked.parser(tokens);
}

export function table(headers, rows, { cls = '' } = {}) {
  const head = headers.map((h) => `<th>${h}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('\n');
  return `<table class="${cls}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export const CSS = `
@page { size: A4; margin: 17mm 15mm 18mm 15mm; }
* { box-sizing: border-box; }
body { font: 10pt/1.42 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #17243b; margin: 0; }
h1 { font-size: 20pt; margin: 0 0 6mm; padding-bottom: 2mm; border-bottom: 2px solid #184995; color: #184995; break-before: page; break-after: avoid; }
h1.first, h1.nobreak { break-before: auto; }
h2 { font-size: 14pt; margin: 7mm 0 3mm; color: #17243b; break-after: avoid; }
h2.docstart { break-before: page; margin-top: 0; }
h3 { font-size: 11.5pt; margin: 5mm 0 2mm; break-after: avoid; }
h4 { font-size: 10.5pt; margin: 4mm 0 1.5mm; break-after: avoid; }
p, li { orphans: 3; widows: 3; }
p { margin: 0 0 2.2mm; }
ul, ol { margin: 0 0 2.5mm 5mm; padding-left: 4mm; }
code { font: 8.6pt/1.3 Menlo, Consolas, monospace; background: #eef2f8; padding: 0 1mm; border-radius: 1mm; }
pre { font: 7.6pt/1.3 Menlo, Consolas, monospace; background: #f4f6fa; border: 1px solid #d7deea; padding: 2.5mm; white-space: pre-wrap; word-break: break-word; margin: 0 0 3mm; }
pre code { background: none; padding: 0; font-size: inherit; }
pre.mermaid { background: #fff; border: none; padding: 0; text-align: center; font-family: inherit; white-space: normal; break-inside: avoid; }
pre.mermaid svg { max-width: 100%; height: auto; max-height: 238mm; }
table { border-collapse: collapse; width: 100%; margin: 1mm 0 4mm; font-size: 8.6pt; }
th, td { border: 1px solid #c9d2e0; padding: 1.2mm 1.8mm; vertical-align: top; text-align: left; }
th { background: #e6ecf6; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
td code { font-size: 7.8pt; word-break: break-word; }
.ref { color: #17243b; }
.cover h1 { border: none; font-size: 26pt; margin-top: 18mm; }
.cover .sub { font-size: 12pt; color: #4e6282; margin-bottom: 8mm; }
.box { border: 1px solid #c9d2e0; background: #f4f6fa; padding: 3mm 4mm; margin: 3mm 0; }
.warn { border-color: #a02032; background: #fbeff1; }
figure { margin: 0 0 4mm; break-inside: avoid; }
figure img { width: 100%; border: 1px solid #c9d2e0; }
figcaption { font-size: 8.6pt; margin-top: 1mm; }
.toc td { border: none; border-bottom: 1px dotted #b8c2d4; padding: 0.7mm 1mm; font-size: 9pt; }
.toc td.pg { text-align: right; width: 14mm; }
.toc tr.l1 td { font-weight: 700; padding-top: 2mm; }
.toc tr.l2 td:first-child { padding-left: 6mm; }
.status-pass { color: #146c2e; font-weight: 700; }
.status-partial { color: #8a5a00; font-weight: 700; }
.status-manual { color: #4e6282; font-weight: 700; }
.status-fail { color: #a02032; font-weight: 700; }
.small { font-size: 8.4pt; color: #4e6282; }
`;
