import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SpeechAI — AI Interview Platform',
  description: 'Practice interviews with AI-powered voice conversations. Get real-time feedback and improve your skills.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        backgroundColor: '#030712',
        color: '#F9FAFB',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        minHeight: '100vh',
      }}>
        {children}
      </body>
    </html>
  );
}
