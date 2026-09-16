import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const mathHtml = (latex, block) => {
  const node = document.createElement(block ? 'div' : 'span');
  node.dataset.type = block ? 'block-math' : 'inline-math'; node.dataset.latex = latex;
  return node.outerHTML;
};
marked.use({ extensions: [
  { name: 'blockLatex', level: 'block', start: text => text.indexOf('$$'),
    tokenizer(text) { const match = /^\$\$\s*\n?([\s\S]+?)\n?\$\$(?:\n|$)/.exec(text); if (match) return { type: 'blockLatex', raw: match[0], latex: match[1].trim() }; },
    renderer(token) { return mathHtml(token.latex, true); } },
  { name: 'inlineLatex', level: 'inline', start: text => text.indexOf('$'),
    tokenizer(text) { const match = /^\$([^$\n]+)\$/.exec(text); if (match) return { type: 'inlineLatex', raw: match[0], latex: match[1] }; },
    renderer(token) { return mathHtml(token.latex, false); } }
] });

export function importLegacy(markdown) {
  const root = document.createElement('div');
  // Preserve cell identity before sanitizing HTML (which intentionally removes comments).
  const tagged = (markdown || '').replace(/<!-- cell:python -->[ \t]*\r?\n(`{3,})python[ \t]*\r?\n([\s\S]*?)\r?\n\1(?=\s|$)/g,
    (_match, _fence, code) => `<section data-code-cell="python"><pre><code>${escapeHtml(code)}</code></pre></section>\n`);
  root.innerHTML = DOMPurify.sanitize(marked.parse(tagged, { breaks: true, gfm: true }), { ADD_ATTR: ['data-code-cell'] });
  return root.innerHTML;
}

function escapeHtml(value) { const element = document.createElement('div'); element.textContent = value; return element.innerHTML; }

const exportMarkdown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
exportMarkdown.use(gfm);
exportMarkdown.addRule('math', {
  filter: node => ['inline-math', 'block-math'].includes(node.getAttribute('data-type')),
  replacement: (_content, node) => node.dataset.type === 'block-math'
    ? `\n\n$$\n${node.dataset.latex}\n$$\n\n` : `$${node.dataset.latex}$`
});
exportMarkdown.addRule('codeCell', {
  filter: node => node.nodeName === 'SECTION' && node.hasAttribute('data-code-cell'),
  replacement: (_content, node) => {
    const text = node.querySelector('code')?.textContent || '';
    const longest = Math.max(2, ...(text.match(/`+/g) || []).map(run => run.length));
    const fence = '`'.repeat(longest + 1);
    return `\n\n<!-- cell:python -->\n${fence}python\n${text}\n${fence}\n\n`;
  }
});
exportMarkdown.addRule('styledText', {
  filter: node => (node.nodeName === 'SPAN' && node.getAttribute('style')) || node.nodeName === 'MARK',
  replacement: (content, node) => `<${node.nodeName.toLowerCase()} style="${node.getAttribute('style') || ''}">${content}</${node.nodeName.toLowerCase()}>`
});

export function snapshot(editor) {
  const html = document.createElement('div'); html.innerHTML = editor.getHTML();
  // Turndown treats empty atomic nodes as blank before consulting custom rules.
  html.querySelectorAll('[data-latex]').forEach(node => { node.textContent = node.dataset.latex; });
  return {
    documentJson: JSON.stringify({ version: 1, doc: editor.getJSON() }),
    markdown: exportMarkdown.turndown(html.innerHTML),
    plainText: editor.getText({ blockSeparator: '\n' })
  };
}

export function readDocument(json) {
  const stored = JSON.parse(json);
  if (stored.version !== 1 || stored.doc?.type !== 'doc') throw new Error('Nieobsługiwana wersja dokumentu. Oryginalny zapis pozostaje nienaruszony.');
  return stored.doc;
}
