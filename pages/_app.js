import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.log('Erro ao registrar Service Worker:', err);
        });
      });
    }
  }, []);

  return <Component {...pageProps} />;
}
