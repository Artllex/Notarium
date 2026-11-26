import { Extension, Node } from '@tiptap/core';
import { richAttribute } from './rich-label.js';
import { containerTypes } from './container-types.js';

const types = Object.keys(containerTypes);
export const BlockGroup = Node.create({
  name: 'blockGroup', group: 'block', content: 'block+', defining: true, isolating: true,
  addAttributes: () => ({ textFlow: { default: false, parseHTML: el => el.getAttribute('data-text-flow') === 'true', renderHTML: attrs => attrs.textFlow ? { 'data-text-flow': 'true' } : {} } }),
  parseHTML: () => [{ tag: 'section[data-block-group]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['section', { ...HTMLAttributes, 'data-block-group': 'true', class: node.attrs.textFlow ? 'text-flow-content' : 'block-group-content' }, 0]
});
const backgroundColor = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : null;
export const LayoutRow = Node.create({
  name: 'layoutRow', group: 'block', content: 'block+', isolating: true,
  parseHTML: () => [{ tag: 'section[data-layout-row]' }],
  renderHTML: () => ['section', { 'data-layout-row': 'true', class: 'layout-row' }, 0]
});
export const ContainerAttributes = Extension.create({
  name: 'containerAttributes',
  addGlobalAttributes() {
    return [{ types, attributes: { boxBackground: { default: null,
      parseHTML: el => backgroundColor(el.getAttribute('data-boxbackground')),
      renderHTML: attrs => backgroundColor(attrs.boxBackground) ? { 'data-boxbackground': attrs.boxBackground } : {} },
      codeAllowNarrow: { default: false, parseHTML: el => el.getAttribute('data-codeallownarrow') === 'true', renderHTML: attrs => attrs.codeAllowNarrow ? { 'data-codeallownarrow': 'true' } : {} },
      boxEmpty: { default: false, parseHTML: el => el.getAttribute('data-boxempty') === 'true', renderHTML: attrs => attrs.boxEmpty ? { 'data-boxempty': 'true' } : {} },
      boxTextExplicit: { default: false, parseHTML: el => el.getAttribute('data-boxtextexplicit') === 'true', renderHTML: attrs => attrs.boxTextExplicit ? { 'data-boxtextexplicit': 'true' } : {} },
      boxTitleRich: richAttribute('boxTitleRich'), boxCaptionRich: richAttribute('boxCaptionRich'), ...Object.fromEntries(['boxWidth', 'boxHeight', 'boxOffsetX', 'boxAlign', 'boxTitle', 'boxCaption'].map(name => [name, {
      default: null,
      parseHTML: el => {
        const value = el.getAttribute('data-' + name.toLowerCase());
        return ['boxWidth', 'boxHeight', 'boxOffsetX'].includes(name) ? Number(value) || null : value;
      },
      renderHTML: attrs => attrs[name] == null ? {} : { ['data-' + name.toLowerCase()]: attrs[name] }
    }])) } }];
  }
});

// Common capabilities surround each engine's own node view; editing stays with that engine.
