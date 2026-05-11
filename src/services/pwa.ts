export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Falha ao registrar service worker:', error);
    });
  });
}
