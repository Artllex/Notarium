import { ContainerVisual } from './container-visual.js';

export function setupContainerHover(editor, options) {
  let rowHover = [];
  const gapAtPoint = (x, y) => {
    const rows = [...editor.view.dom.querySelectorAll('.layout-row')];
    for (const row of rows) {
      const rowRect = row.getBoundingClientRect();
      if (y < rowRect.top || y > rowRect.bottom) continue;
      const entries = [...row.children].filter(dom => dom.matches?.('.object-container'))
        .map(dom => ({ dom, rect: dom.getBoundingClientRect() })).sort((a, b) => a.rect.left - b.rect.left);
      for (let index = 0; index < entries.length - 1; index++) {
        const left = entries[index], right = entries[index + 1];
        if (x >= left.rect.right && x <= right.rect.left) return { left, right };
      }
    }
    return null;
  };
  const rowBoundaryAtPoint = (x, y) => {
    const blocks = [...editor.view.dom.children].filter(dom => dom.matches?.('.object-container,.layout-row'));
    for (let index = 0; index < blocks.length - 1; index++) {
      const current = blocks[index], next = blocks[index + 1];
      const currentRect = current.getBoundingClientRect(), nextRect = next.getBoundingClientRect();
      if (y >= currentRect.bottom && y < nextRect.top) return next;
      if (current.matches('.layout-row') && y >= currentRect.top && y <= currentRect.bottom &&
          x >= currentRect.left && x <= currentRect.right &&
          ![...current.querySelectorAll(':scope > .object-container')].some(dom => {
            const rect = dom.getBoundingClientRect();
            return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
          })) return next;
    }
    return null;
  };
  const setRowHover = next => {
    const items = (Array.isArray(next) ? next : next ? [next] : []).filter(Boolean);
    if (items.length === rowHover.length && items.every((item, index) => item === rowHover[index])) return;
    ContainerVisual.hover(rowHover, false);
    rowHover = items;
    ContainerVisual.hover(rowHover, true);
    publishHoveredType();
  };
  let lastHoverLabel = null;
  const publishHoveredType = () => {
    const type = rowHover[0]?.dataset.containerType;
    const label = rowHover[0]?.classList.contains('container-empty') ? 'Empty' :
      ({ codeCell: 'Code Cell', codeBlock: 'Code Block', blockMath: 'Math', image: 'Picture', table: 'Table',
        bulletList: 'List', orderedList: 'List', taskList: 'Task List', blockGroup: 'Container' })[type] || (type ? 'Text' : '');
    if (label === lastHoverLabel) return;
    lastHoverLabel = label;
    window.chrome?.webview?.postMessage({ type: 'containerHover', label });
  };
  let hoverRefreshFrame = 0;
  const refreshHoveredType = () => {
    cancelAnimationFrame(hoverRefreshFrame);
    hoverRefreshFrame = requestAnimationFrame(publishHoveredType);
  };
  editor.on('update', refreshHoveredType);
  let typePanelWarmUntil = 0;
  let typePanelNote = null;
  const rememberTypePanel = () => {
    typePanelWarmUntil = performance.now() + 3000;
    typePanelNote = options.noteId?.();
  };
  editor.view.dom.addEventListener('container-type-revealed', rememberTypePanel);
  const onContainerPointerMove = event => {
    for (const active of editor.view.dom.querySelectorAll('.container-left-exited')) {
      const container = active.getBoundingClientRect(), panel = active.querySelector(':scope > .container-type-tools')?.getBoundingClientRect();
      if (!panel || event.clientX < panel.left || event.clientX >= container.left ||
          event.clientY < panel.top || event.clientY > panel.bottom) {
        active.classList.remove('container-left-exited');
        if (active.containerView) active.containerView.pointerWasInside = false;
      }
    }
    if (typePanelNote === options.noteId?.() && performance.now() < typePanelWarmUntil) {
      const candidates = [...editor.view.dom.querySelectorAll('.object-container:not(.container-empty)')]
        .filter(dom => {
          const rect = dom.getBoundingClientRect();
          return event.clientX >= rect.left - 72 && event.clientX < rect.left &&
            event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
      // Prefer the innermost container when nested panels share the same area.
      candidates.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height);
      candidates[0]?.containerView?.revealTypePanel();
    }
    const pairLine = event.target.closest?.('.container-pair-resize');
    if (pairLine) {
      const left = pairLine.parentElement;
      let right = left?.nextElementSibling;
      while (right && !right.matches?.('.object-container')) right = right.nextElementSibling;
      setRowHover([left, right]); return;
    }
    const gapLine = event.target.closest?.('.container-gap-boundary');
    if (gapLine) {
      const right = gapLine.parentElement;
      let left = right?.previousElementSibling;
      while (left && !left.matches?.('.object-container')) left = left.previousElementSibling;
      setRowHover([left, right]); return;
    }
    const direct = event.target.closest?.('.object-container');
    if (direct) { setRowHover(direct); return; }
    const editorRect = editor.view.dom.parentElement.getBoundingClientRect();
    if (event.clientX < editorRect.left || event.clientX > editorRect.right || event.clientY < editorRect.top || event.clientY > editorRect.bottom) {
      setRowHover(null); return;
    }
    const gap = gapAtPoint(event.clientX, event.clientY);
    if (gap) { setRowHover([gap.left.dom, gap.right.dom]); return; }
    const candidates = [...editor.view.dom.querySelectorAll('.object-container')].map(dom => ({ dom, rect: dom.getBoundingClientRect() }))
      .filter(({ rect }) => event.clientY >= rect.top && event.clientY <= rect.bottom);
    const ordered = candidates.slice().sort((a, b) => a.rect.left - b.rect.left);
    for (let index = 0; index < ordered.length - 1; index++) {
      const left = ordered[index], right = ordered[index + 1];
      if (event.clientX > left.rect.right && event.clientX < right.rect.left) {
        setRowHover([left.dom, right.dom]); return;
      }
    }
    candidates.sort((a, b) => {
      const distance = rect => event.clientX < rect.left ? rect.left - event.clientX : event.clientX > rect.right ? event.clientX - rect.right : 0;
      return distance(a.rect) - distance(b.rect) || a.rect.width * a.rect.height - b.rect.width * b.rect.height;
    });
    setRowHover(candidates[0]?.dom || null);
  };
  document.addEventListener('pointermove', onContainerPointerMove, true);
  editor.on('destroy', () => {
    document.removeEventListener('pointermove', onContainerPointerMove, true);
    editor.view.dom.removeEventListener('container-type-revealed', rememberTypePanel);
    editor.off('update', refreshHoveredType);
    cancelAnimationFrame(hoverRefreshFrame);
    setRowHover(null);
  });
  return { gapAtPoint, rowBoundaryAtPoint };
}
