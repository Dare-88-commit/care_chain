
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <Head>
      <title>CareChain | Redirecting...</title>
      <meta name="robots" content="noindex" />
    </Head>
  );
}
