import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const wordSelectionKey = new PluginKey('wordSelection');
export function selectTextRange(view, range, toggle = false) {
  const ranges = wordSelectionKey.getState(view.state);
  const same = item => item.from === range.from && item.to === range.to;
  const covered = ranges.some(item => item.from <= range.from && item.to >= range.to);
  const next = toggle && ranges.some(same) ? ranges.filter(item => !same(item)) : covered ?
    ranges.map(item => same(item) && range.kind ? { ...item, kind: range.kind } : item) :
    [...ranges.filter(item => item.to <= range.from || item.from >= range.to), range].sort((a, b) => a.from - b.from);
  view.dispatch(view.state.tr.setMeta(wordSelectionKey, next)
    .setSelection(TextSelection.create(view.state.doc, range.from, range.to)));
}
export const wordSelections = Extension.create({
  name: 'wordSelections',
  addProseMirrorPlugins() { return [new Plugin({ key: wordSelectionKey,
    state: { init: () => [], apply: (tr, ranges) => tr.getMeta(wordSelectionKey) ??
      (tr.docChanged ? [] : ranges) },
    props: { decorations(state) { return DecorationSet.create(state.doc, wordSelectionKey.getState(state).map(range =>
      Decoration.inline(range.from, range.to, { class: 'word-multi-selection', style: 'background:#31547a;color:inherit' }))); } }
  })]; }
});
