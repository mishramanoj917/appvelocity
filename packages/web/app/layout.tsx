import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const geistSans = localFont({
  src: '../assets/fonts/GeistVF.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  fallback: ['system-ui', 'sans-serif'],
});

const geistMono = localFont({
  src: '../assets/fonts/GeistMonoVF.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  fallback: ['monospace'],
});

export const metadata: Metadata = {
  title: 'AppVelocity – AI Mobile Dev Acceleration',
  description:
    'Seven specialized AI agents accelerating every aspect of mobile development',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-full bg-gray-950 font-sans text-gray-100 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
