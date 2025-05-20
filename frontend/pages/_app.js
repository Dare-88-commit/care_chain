// pages/_app.js
import '@/styles/globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../context/AuthContext';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
  <title>CareChain - Secure Health Records</title>
  <meta name="description" content="Decentralized health record system using QR codes" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  {/* Favicon for most browsers */}
  <link rel="icon" href="/images/carechain-logo.png" />
  {/* Apple Touch Icon (for iOS devices) */}
  <link rel="apple-touch-icon" href="/images/carechain-logo.png" />
  {/* Android Chrome */}
  <link rel="icon" type="image/png" sizes="192x192" href="/images/carechain-logo.png" />
</Head>

      <AuthProvider>
        <Component {...pageProps} />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
            },
          }}
        />
      </AuthProvider>
    </>
  );
}