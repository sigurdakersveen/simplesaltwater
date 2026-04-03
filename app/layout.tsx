import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SimpleSaltwater',
  description: 'Fiskeforhold for saltvannsfiskere',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body className="antialiased">{children}</body>
    </html>
  )
}
