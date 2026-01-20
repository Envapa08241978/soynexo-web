import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    metadataBase: new URL('https://www.soynexo.com'),
    title: {
        default: 'Soy Nexo | Álbum Digital para Eventos - Fotos en Tiempo Real',
        template: '%s | Soy Nexo'
    },
    description: 'Crea un álbum colaborativo para tu boda, quinceañera o fiesta. Tus invitados suben fotos con código QR y aparecen en pantalla al instante. ¡Descarga gratis todas las fotos!',
    keywords: [
        'álbum digital evento',
        'fotos boda tiempo real',
        'galería fotos quinceañera',
        'muro de fotos fiesta',
        'álbum colaborativo',
        'fotos invitados evento',
        'pantalla fotos boda',
        'código QR fotos evento',
        'galería interactiva',
        'soy nexo',
        'fotos en vivo evento'
    ],
    authors: [{ name: 'Soy Nexo' }],
    creator: 'Soy Nexo',
    publisher: 'Soy Nexo',
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    openGraph: {
        type: 'website',
        locale: 'es_MX',
        url: 'https://www.soynexo.com',
        siteName: 'Soy Nexo',
        title: 'Soy Nexo | Álbum Digital para Eventos - Fotos en Tiempo Real',
        description: 'Crea un álbum colaborativo para tu boda, quinceañera o fiesta. Tus invitados suben fotos y aparecen en pantalla al instante.',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'Soy Nexo - Álbum digital para eventos',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Soy Nexo | Álbum Digital para Eventos',
        description: 'Crea un álbum colaborativo para tu evento. Fotos en tiempo real, descarga gratis.',
        images: ['/og-image.png'],
    },
    alternates: {
        canonical: 'https://www.soynexo.com',
    },
    category: 'technology',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization',
                '@id': 'https://www.soynexo.com/#organization',
                name: 'Soy Nexo',
                url: 'https://www.soynexo.com',
                logo: {
                    '@type': 'ImageObject',
                    url: 'https://www.soynexo.com/og-image.png',
                },
                description: 'Plataforma de álbum digital colaborativo para eventos. Tus invitados suben fotos y aparecen en tiempo real.',
                contactPoint: {
                    '@type': 'ContactPoint',
                    telephone: '+52-642-160-0559',
                    contactType: 'sales',
                    availableLanguage: 'Spanish',
                },
            },
            {
                '@type': 'WebSite',
                '@id': 'https://www.soynexo.com/#website',
                url: 'https://www.soynexo.com',
                name: 'Soy Nexo',
                publisher: {
                    '@id': 'https://www.soynexo.com/#organization',
                },
            },
            {
                '@type': 'Service',
                '@id': 'https://www.soynexo.com/#service',
                name: 'Álbum Digital para Eventos',
                provider: {
                    '@id': 'https://www.soynexo.com/#organization',
                },
                description: 'Servicio de álbum fotográfico digital colaborativo para bodas, quinceañeras, cumpleaños y eventos corporativos.',
                areaServed: {
                    '@type': 'Country',
                    name: 'México',
                },
                serviceType: 'Álbum Digital de Fotos para Eventos',
            },
        ],
    }

    return (
        <html lang="es">
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            </head>
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
