import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'TalkingHead 3D · AI English Teacher (Live Voice)',
  description: 'Interactive 3D English Language Teacher with real-time ChatGPT Live Voice call, lip-sync, gestures, and IELTS / conversation practice.',
  openGraph: {
    title: 'TalkingHead 3D · AI English Teacher (Live Voice)',
    description: 'Interactive 3D English Language Teacher with real-time ChatGPT Live Voice call, lip-sync, gestures, and IELTS / conversation practice.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TalkingHead 3D · AI English Teacher (Live Voice)',
    description: 'Interactive 3D English Language Teacher with real-time ChatGPT Live Voice call, lip-sync, gestures, and IELTS / conversation practice.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
