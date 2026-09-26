import policy from '../../UI/ui-policy.json';

// Same source as the Windows adapter. DEV owns no separate palette or menu geometry.
export function applyTheme(element = document.documentElement) {
  for (const [key, value] of Object.entries(policy)) {
    const name = '--ui-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
    element.style.setProperty(name, typeof value === 'number' && key !== 'disabledOpacity' ? value + 'px' : value);
  }
  element.style.setProperty('--ui-menu-min-height', policy.itemMinHeight + 'px');
}
applyTheme();
