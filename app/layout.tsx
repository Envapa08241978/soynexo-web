import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Soy Nexo | Tu fiesta, convertida en un álbum vivo',
    description: 'Plataforma de eventos donde los invitados suben fotos y estas aparecen en una pantalla gigante en tiempo real con efectos de gravedad.',
    keywords: ['eventos', 'fotos', 'fiesta', 'boda', 'quinceañera', 'pantalla', 'tiempo real'],
    openGraph: {
        title: 'Soy Nexo | Tu fiesta, convertida en un álbum vivo',
        description: 'Transforma tu evento en una experiencia interactiva inolvidable',
        type: 'website',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es">
            {/* Google Analytics */}
            <Script
                src="https://www.googletagmanager.com/gtag/js?id=G-FY1ZFLYF8J"
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', 'G-FY1ZFLYF8J');
                `}
            </Script>
            <body className={inter.className}>{children}</body>
        </html>
    )
}
