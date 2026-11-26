// Public container API; state and event ownership live in the focused modules.
export { BlockGroup, LayoutRow, ContainerAttributes } from './container-schema.js';
export { ContainerView } from './container-view.js';
export { setupContainers } from './container-controller.js';
import { NodeSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { getContainerType, isContainerAt } from './container-types.js';

export function alignContainer(editor, alignment) {
  const selection = editor.state.selection;
  if (!(selection instanceof NodeSelection)) return false;
  const node = selection.node;
  if (!isContainerAt(editor.state.doc, selection.from)) return false;
  const attrs = { ...node.attrs, boxAlign: alignment, ...(alignment === 'justify' ? { boxWidth: null, boxOffsetX: null } : {}) };
  editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(selection.from, undefined, getContainerType(node).copyAttrs(attrs)));
  return true;
}
