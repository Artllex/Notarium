import { EditorState, TextSelection } from '@tiptap/pm/state';
import { sinkListItem, liftListItem } from '@tiptap/pm/schema-list';
import { closeHistory } from '@tiptap/pm/history';

export const indentStep = 12.7; // Word's default half-inch tab stop, in mm.
const listTypes = new Set(['orderedList', 'bulletList', 'taskList']);
const itemTypes = new Set(['listItem', 'taskItem']);
const adjusted = (value, backwards) => Math.max(0, Math.min(100, Math.round(((Number(value) || 0) + (backwards ? -indentStep : indentStep)) * 100) / 100));

export function indentText(editor, backwards, ranges = [], rangeKey = null) {
  const { state } = editor;
  const selection = state.selection;
  const targets = ranges.length ? ranges : [{ from: selection.from, to: selection.to }];
  const paragraphs = new Map(), lists = new Map();
  for (const range of targets) state.doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (!['paragraph', 'heading'].includes(node.type.name)) return;
    if (range.from !== range.to && (pos + 1 >= range.to || pos + node.nodeSize - 1 <= range.from)) return;
    const $pos = state.doc.resolve(pos + 1);
    for (let depth = $pos.depth; depth > 0; depth--) {
      if (!itemTypes.has($pos.node(depth).type.name)) continue;
      const list = $pos.node(depth - 1);
      if (!listTypes.has(list.type.name)) break;
      const listPos = $pos.before(depth - 1);
      if (!lists.has(listPos)) lists.set(listPos, { pos: listPos, node: list, nested: itemTypes.has($pos.node(depth - 2)?.type.name), items: new Map() });
      lists.get(listPos).items.set($pos.before(depth), { from: pos + 1, to: pos + 1 + node.content.size });
      return;
    }
    paragraphs.set(pos, node);
  });
  for (const [pos, group] of lists) {
    if ([...lists.values()].some(parent => parent.pos < pos &&
      parent.pos + parent.node.nodeSize > pos && parent.items.size === parent.node.childCount)) lists.delete(pos);
  }
  if (!paragraphs.size && !lists.size) return false;
  const tr = closeHistory(state.tr);
  if (!lists.size && !ranges.length && selection.empty) {
    const $pos = selection.$from;
    if (!$pos.parent.isTextblock) return false;
    const pos = $pos.before(), node = $pos.parent;
    if ($pos.parentOffset === 0) {
      const field = backwards && !node.attrs.firstLineIndent ? 'indentLeft' : 'firstLineIndent';
      const current = node.attrs[field] ?? (field === 'indentLeft' ? state.doc.attrs.pageLayout?.indentLeft : 0);
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, [field]: adjusted(current, backwards) });
    } else if (!backwards) {
      tr.insertText('\t', selection.from);
    } else if ($pos.parent.textBetween($pos.parentOffset - 1, $pos.parentOffset) === '\t') {
      tr.delete(selection.from - 1, selection.from);
    } else {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, indentLeft: adjusted(node.attrs.indentLeft ?? state.doc.attrs.pageLayout?.indentLeft, true) });
    }
  } else {
    for (const [pos, node] of paragraphs) tr.setNodeMarkup(pos, undefined, {
      ...node.attrs, indentLeft: adjusted(node.attrs.indentLeft ?? state.doc.attrs.pageLayout?.indentLeft, backwards)
    });
    for (const group of [...lists.values()].sort((a, b) => b.pos - a.pos)) {
      const pos = tr.mapping.map(group.pos), node = tr.doc.nodeAt(pos);
      if (group.items.size === group.node.childCount && !group.nested) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, listIndent: adjusted(node.attrs.listIndent, backwards) });
        continue;
      }
      const items = [...group.items.entries()].sort((a, b) => a[0] - b[0]);
      // Handle each contiguous run independently, so skipped list items stay put.
      const runs = [];
      for (const [itemPos, item] of items) {
        const previous = runs.at(-1);
        if (previous && previous.end === itemPos) { previous.to = item.to; previous.end = itemPos + state.doc.nodeAt(itemPos).nodeSize; }
        else runs.push({ from: item.from, to: item.to, end: itemPos + state.doc.nodeAt(itemPos).nodeSize });
      }
      for (const run of runs.reverse()) {
        const from = tr.mapping.map(run.from), to = tr.mapping.map(run.to);
        const current = EditorState.create({ doc: tr.doc, selection: TextSelection.create(tr.doc, from, to) });
        const $from = current.selection.$from;
        let depth = $from.depth;
        while (depth && !itemTypes.has($from.node(depth).type.name)) depth--;
        const itemType = depth ? $from.node(depth).type : state.schema.nodes.listItem;
        const command = backwards ? liftListItem(itemType) : sinkListItem(itemType);
        // At the outermost level Shift+Tab must not extract text from its container.
        const nested = depth > 2 && itemTypes.has($from.node(depth - 2).type.name);
        const done = (!backwards || nested) && command(current, next => { for (const step of next.steps) tr.step(step); });
        if (!done) {
          // The first item has no preceding sibling to nest under. Give only
          // the selected items a local visual indent; never invent an empty item.
          for (const [itemPos, originalItem] of items) {
            if (originalItem.from < run.from || originalItem.to > run.to) continue;
            const mapped = tr.mapping.map(itemPos), item = tr.doc.nodeAt(mapped);
            if (item && itemTypes.has(item.type.name)) {
              const itemIndent = adjusted(item.attrs.itemIndent, backwards);
              tr.setNodeMarkup(mapped, undefined, { ...item.attrs, itemIndent,
                itemStyleType: node.type.name === 'orderedList' ? ['decimal', 'lower-alpha', 'lower-roman'][Math.round(itemIndent / indentStep) % 3] : null });
            }
          }
        }
      }
    }
    // Lists changed by this gesture use Word's decimal / letter / roman cycle.
    if (tr.docChanged) {
      for (const group of lists.values()) {
        const from = tr.mapping.map(group.pos), node = tr.doc.nodeAt(from);
        if (!node) continue;
        tr.doc.nodesBetween(from, Math.min(tr.doc.content.size, from + node.nodeSize), (list, pos) => {
          if (list.type.name !== 'orderedList') return;
          const $pos = tr.doc.resolve(pos); let depth = 0;
          for (let i = 1; i <= $pos.depth; i++) if ($pos.node(i).type.name === 'orderedList') depth++;
          tr.setNodeMarkup(pos, undefined, { ...list.attrs, listStyleType: ['decimal', 'lower-alpha', 'lower-roman'][depth % 3] });
        });
      }
    }
  }
  if (ranges.length && rangeKey) {
    tr.setMeta(rangeKey, ranges.map(range => ({ ...range, from: tr.mapping.map(range.from, 1), to: tr.mapping.map(range.to, -1) })));
  }
  // Attribute-only formatting and list transforms keep the original selection.
  if (lists.size || !selection.empty || ranges.length) tr.setSelection(selection.map(tr.doc, tr.mapping));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}
