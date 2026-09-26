import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'TalkingHead 3D Character & Figure Studio',
  description: 'Interactive 3D Character Studio based on mahdiyarKoushki/TalkingHead featuring all characters and 10 dynamic poses/figures with real-time lip-sync, gestures, and studio lighting.',
  openGraph: {
    title: 'TalkingHead 3D Character & Figure Studio',
    description: 'Interactive 3D Character Studio based on mahdiyarKoushki/TalkingHead featuring all characters and 10 dynamic poses/figures with real-time lip-sync, gestures, and studio lighting.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TalkingHead 3D Character & Figure Studio',
    description: 'Interactive 3D Character Studio based on mahdiyarKoushki/TalkingHead featuring all characters and 10 dynamic poses/figures with real-time lip-sync, gestures, and studio lighting.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
