import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ResitKu',
    short_name: 'ResitKu',
    description: 'Personal Malaysian Tax Relief & Expense Tracker with Zero-Typing OCR',
    start_url: '/dashboard/expenses',
    display: 'standalone',
    background_color: '#FAFAFA',
    theme_color: '#0052FF',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
