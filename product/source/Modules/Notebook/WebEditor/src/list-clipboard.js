// Text clipboard markers depend on the number of selected list items, not visual wrapping.
export function listClipboardText(slice, state) {
  const items = [];
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos, parent, index) => {
    if (node.type.name === 'listItem') items.push({ pos, marker: parent.type.name === 'orderedList' ? `${(parent.attrs.start || 1) + index}.` : '-' });
  });
  if (!items.length) return null;
  let index = 0;
  const render = node => {
    if (node.isText) return node.text;
    if (node.type.name === 'hardBreak') return '\n';
    const children = [];
    node.forEach(child => children.push(render(child)));
    const text = children.join(node.isTextblock ? '' : '\n');
    if (node.type.name !== 'listItem') return text;
    const marker = items[index++]?.marker || '-';
    return items.length > 1 ? `${marker} ${text}` : text;
  };
  const parts = [];
  slice.content.forEach(node => parts.push(render(node)));
  return parts.join('\n');
}
