// Native drag events may target Text nodes, not just Elements.
export function targetElement(target) {
  return target instanceof Element ? target : target?.parentElement ?? null;
}
