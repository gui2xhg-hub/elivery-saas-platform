import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/master');
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans">
      <p className="text-sm text-gray-400">Redirecionando para o Painel Master...</p>
    </div>
  );
}
