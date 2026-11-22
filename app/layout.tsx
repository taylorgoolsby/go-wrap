import type { Metadata } from 'next'
import { Sometype_Mono } from 'next/font/google'
import './globals.css'

const mono = Sometype_Mono({ subsets: ['latin'], variable: '--font-sometype-mono' })

export const metadata: Metadata = {
  title: 'GO-WRAP',
  description:
    'Go-Wrap helps you wrap any open-source AI model, making it feature-complete with long-term memory, function calling, self-refinement, and more.',
  keywords: [
    'AI wrapper',
    'open-source AI',
    'AI infrastructure',
    'function calling',
    'memory',
    'model refinement',
    'chat API',
  ],
  openGraph: {
    title: 'Go-Wrap – Wrap Any Open-Source AI Model',
    description: 'Enhance your AI models with function calling, long-term memory, and more.',
    images: ['https://go-wrap.com/go-wrap.png'],
    url: 'https://go-wrap.com',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Go-Wrap – Wrap Any OS Model',
    description: 'Make any open-source model feature complete with Go-Wrap.',
    images: [{ url: 'https://go-wrap.com/go-wrap.png', alt: 'Go-Wrap – Wrap Any OS Model' }],
    site: '@tay2win',
    creator: '@tay2win',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={mono.variable}>{children}</body>
    </html>
  )
}