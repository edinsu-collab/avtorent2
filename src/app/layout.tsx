import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AvtoRent Montenegro',
  description: 'Iznajmite vozilo u Crnoj Gori',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  )
}
