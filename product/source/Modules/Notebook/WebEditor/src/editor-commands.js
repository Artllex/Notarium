import { Dialog } from '../../../../Shared/Web/UI/components.js';
import { closeHistory } from '@tiptap/pm/history';
import { textTarget } from './rich-label.js';
import { alignContainer } from './containers.js';
import { openMath, openImage, openTable } from './media.js';

export function setupEditorCommands(editor, getNoteId) {
  function insertionBoundary() {
    const { selection } = editor.state;
    if (selection.node?.type.name === 'blockGroup') return selection.from + selection.node.nodeSize - 1;
    for (let depth = selection.$from.depth; depth > 0; depth--) {
      if (['doc', 'blockGroup', 'layoutRow'].includes(selection.$from.node(depth - 1).type.name)) return selection.$from.after(depth);
    }
    return selection.to;
  }
  function command(message) {
    if (!getNoteId()) return;
    const action = message.action, value = message.value;
    if (action === 'undo') { editor.commands.undo(); return; }
    if (action === 'redo') { editor.commands.redo(); return; }
    if (action === 'lineSpacing') {
      const spacing = Number(value);
      if (!Number.isFinite(spacing) || spacing < 1 || spacing > 2) return;
      const { from, to, empty } = editor.state.selection;
      const tr = closeHistory(editor.state.tr);
      editor.state.doc.nodesBetween(from, to, (node, pos) => {
        if (!['paragraph', 'heading'].includes(node.type.name)) return;
        if (!empty && (pos + node.nodeSize <= from || pos >= to)) return;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineSpacing: spacing });
      });
      if (tr.docChanged) editor.view.dispatch(tr);
      editor.view.dispatch(closeHistory(editor.state.tr));
      return;
    }
    if (action === 'persistentHighlights') {
      document.body.classList.toggle('persistent-container-highlights', value === true || value === 'true');
      return;
    }
    editor.view.dispatch(closeHistory(editor.state.tr));
    const alignment = { alignLeft: 'left', alignCenter: 'center', alignRight: 'right', alignJustify: 'justify' }[action];
    const target = textTarget(editor);
    if (alignment && target === editor && alignContainer(editor, alignment)) return;
    const chain = target.chain().focus();
    switch (action) {
      case 'bold': chain.toggleBold().run(); break;
      case 'italic': chain.toggleItalic().run(); break;
      case 'strike': chain.toggleStrike().run(); break;
      case 'alignLeft': chain.setTextAlign('left').run(); break;
      case 'alignCenter': chain.setTextAlign('center').run(); break;
      case 'alignRight': chain.setTextAlign('right').run(); break;
      case 'alignJustify': chain.setTextAlign('justify').run(); break;
      case 'heading': chain.toggleHeading({ level: 1 }).run(); break;
      case 'bullet': chain.toggleBulletList().run(); break;
      case 'numbered': chain.toggleOrderedList().run(); break;
      case 'checklist': chain.toggleTaskList().run(); break;
      case 'code': chain.toggleCode().run(); break;
      case 'codeblock': chain.toggleCodeBlock().run(); break;
      case 'font': chain.setFontFamily(value).run(); break;
      case 'color': chain.setColor(value).run(); break;
      case 'clearColor': chain.unsetColor().run(); break;
      case 'clearHighlight': chain.unsetHighlight().run(); break;
      case 'highlight': chain.setHighlight({ color: value }).run(); break;
      case 'link': showLinkDialog(); break;
      case 'math': openMath(); break;
      case 'image': openImage(); break;
      case 'table': openTable(); break;
      case 'contentWidth': {
        const width = Number(value);
        if (![0, 650, 790, 960].includes(width)) throw new Error('Nieobsługiwana szerokość składu.');
        editor.view.dispatch(editor.state.tr.setDocAttribute('contentWidth', width)); break;
      }
      case 'container': {
        const position = insertionBoundary();
        editor.chain().focus().insertContentAt(position, { type: 'blockGroup', content: [{ type: 'paragraph' }] }).setTextSelection(position + 2).run();
        break;
      }
      case 'cell': {
        const position = insertionBoundary();
        chain.insertContentAt(position, [{ type: 'codeCell', attrs: { language: 'python' } }, { type: 'paragraph', attrs: { boxEmpty: true } }])
          .setTextSelection(position + 1).run();
        break;
      }
    }
  }

  let linkTarget, linkSelection;
  function showLinkDialog() {
    linkTarget = textTarget(editor);
    linkSelection = linkTarget.state.selection;
    const dialog = document.querySelector('#link-dialog');
    const input = document.querySelector('#link-url');
    input.value = linkTarget.getAttributes('link').href || 'https://';
    Dialog.for(dialog).open(); input.focus({ preventScroll: true }); input.select();
  }
  const linkDialog = document.querySelector('#link-dialog');
  const onLinkClose = event => {
    const target = linkTarget && !linkTarget.isDestroyed ? linkTarget : editor;
    if (event.target.returnValue !== 'save') { target.commands.focus(); return; }
    if (linkSelection) target.view.dispatch(target.state.tr.setSelection(linkSelection));
    const href = document.querySelector('#link-url').value.trim();
    if (!/^(https?:\/\/|mailto:)/i.test(href)) return;
    if (target.state.selection.empty) target.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    else target.chain().focus().setLink({ href }).run();
  };
  linkDialog.addEventListener('close', onLinkClose);
  editor.on('destroy', () => linkDialog.removeEventListener('close', onLinkClose));

  return command;
}
