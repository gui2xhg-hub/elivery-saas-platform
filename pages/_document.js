import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        {/* Carrega Tailwind CSS de forma simples e rápida */}
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>
      <body className="bg-gray-950 text-white font-sans antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
