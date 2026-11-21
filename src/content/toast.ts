import { type ToastKind } from '../definitions';

const TOAST_REMOVE_DELAY_MS = 4000;

const TOAST_KIND_COLOR: Record<ToastKind, string> = {
  success: '#30a46c',
  error: '#e5484d',
  info: '#3e63dd',
};

const TOAST_THEME_COLORS = {
  dark: {
    background: '#1d1f23',
    border: 'rgba(255, 255, 255, 0.1)',
    text: 'rgba(255, 255, 255, 0.92)',
    shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  light: {
    background: '#ffffff',
    border: 'rgba(17, 19, 23, 0.12)',
    text: 'rgba(17, 19, 23, 0.92)',
    shadow: '0 4px 16px rgba(17, 19, 23, 0.18)',
  },
} as const;

export function showToast(text: string, kind: ToastKind, theme: 'light' | 'dark'): void {
  if (!document.getElementById('rpc-toast-style')) {
    const style = document.createElement('style');
    style.id = 'rpc-toast-style';
    style.textContent = `@keyframes rpc-toast-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }`;
    document.head.appendChild(style);
  }

  const colors = TOAST_THEME_COLORS[theme];
  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:fixed',
    'right:20px',
    'bottom:20px',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'gap:9px',
    'max-width:420px',
    'padding:9px 14px 9px 11px',
    'border-radius:10px',
    `background:${colors.background}`,
    `border:1px solid ${colors.border}`,
    `color:${colors.text}`,
    'font:13px/1.45 "Inter", system-ui, sans-serif',
    `box-shadow:${colors.shadow}`,
    'pointer-events:none',
    'overflow:hidden',
    'animation:rpc-toast-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
  ].join(';');

  const dot = document.createElement('span');
  dot.style.cssText = [
    'flex:none',
    'width:7px',
    'height:7px',
    'border-radius:50%',
    `background:${TOAST_KIND_COLOR[kind]}`,
  ].join(';');
  toast.appendChild(dot);
  const label = document.createElement('span');
  label.style.cssText = [
    'min-width:0',
    'overflow:hidden',
    'display:-webkit-box',
    '-webkit-box-orient:vertical',
    '-webkit-line-clamp:3',
    'overflow-wrap:anywhere',
  ].join(';');
  label.appendChild(document.createTextNode(text));
  toast.appendChild(label);
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), TOAST_REMOVE_DELAY_MS);
}
