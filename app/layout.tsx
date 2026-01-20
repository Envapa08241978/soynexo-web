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
    description: 'Álbum digital colaborativo para bodas, quinceañeras y fiestas en Navojoa, Sonora y todo México. Tus invitados suben fotos desde su celular y aparecen al instante. Complemento perfecto para tu fotógrafo profesional. ¡Descarga gratis todas las fotos!',
    keywords: [
        // Servicio principal
        'álbum digital evento',
        'álbum colaborativo boda',
        'galería fotos invitados',
        'muro de fotos fiesta',
        'fotos tiempo real evento',
        'código QR fotos boda',
        // Complemento fotógrafo
        'complemento fotógrafo boda',
        'fotos invitados boda',
        'álbum fotos invitados',
        'todas las fotos de mi boda',
        'recopilar fotos evento',
        // Local - Navojoa/Sonora
        'fotógrafo navojoa',
        'fotos boda navojoa',
        'evento navojoa sonora',
        'quinceañera navojoa',
        'bodas navojoa',
        'fotógrafo sonora',
        'eventos sonora méxico',
        // Tipos de evento
        'fotos quinceañera',
        'álbum XV años',
        'fotos cumpleaños',
        'fotos baby shower',
        'fotos graduación',
        'evento corporativo fotos',
        // Marca
        'soy nexo',
        'soynexo'
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
        title: 'Soy Nexo | Álbum Digital para Eventos en Navojoa, Sonora',
        description: 'Álbum colaborativo para bodas, quinceañeras y fiestas en Navojoa y Sonora. Complemento perfecto para tu fotógrafo. Los invitados suben fotos y aparecen al instante.',
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
    verification: {
        google: '8QaIAp7fpIEYkVzlGdSuCRtsQ4P9gCerwi3VtHOPCqQ',
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
                description: 'Álbum digital colaborativo para bodas, quinceañeras y eventos en Navojoa, Sonora y todo México. Complemento perfecto para fotógrafos profesionales.',
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
                description: 'Servicio de álbum fotográfico digital colaborativo para bodas, quinceañeras, cumpleaños y eventos corporativos. Complemento ideal para fotógrafos profesionales en Navojoa, Sonora.',
                areaServed: [
                    {
                        '@type': 'City',
                        name: 'Navojoa',
                        containedInPlace: {
                            '@type': 'State',
                            name: 'Sonora'
                        }
                    },
                    {
                        '@type': 'State',
                        name: 'Sonora'
                    },
                    {
                        '@type': 'Country',
                        name: 'México'
                    }
                ],
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
