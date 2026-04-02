/**
 * Lightweight imperative toast for temporary feedback messages.
 * Creates a temporary DOM element at the bottom of the viewport
 * that auto-removes after the specified duration.
 */
export function showToast(message: string, durationMs: number = 2500): void {
  if (typeof document === 'undefined') return;

  const container = document.createElement('div');
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%) translateY(8px)',
    zIndex: '9999',
    padding: '10px 20px',
    borderRadius: '8px',
    backgroundColor: 'hsl(var(--foreground))',
    color: 'hsl(var(--background))',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    opacity: '0',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    pointerEvents: 'none',
    maxWidth: '90vw',
    textAlign: 'center',
  });
  container.textContent = message;
  document.body.appendChild(container);

  // Trigger enter animation on next frame
  requestAnimationFrame(() => {
    container.style.opacity = '1';
    container.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    container.style.opacity = '0';
    container.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => {
      container.remove();
    }, 200);
  }, durationMs);
}
