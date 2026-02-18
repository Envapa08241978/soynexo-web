import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: '🎉 Patty 50th Birthday | Celebra con nosotros',
    description: 'Sábado 28 de Febrero · Calle Corregidora · 7PM · ¡Confirma tu asistencia y comparte tus fotos!',
    openGraph: {
        title: '🎉 Patty 50th Birthday',
        description: 'Celebra con nosotros · Sábado 28 de Febrero · Calle Corregidora · 7PM · Lleva tu bebida',
        images: [
            {
                url: '/PATTY 50.jpeg',
                width: 800,
                height: 1100,
                alt: 'Patty 50th Birthday — Celebra con nosotros',
            },
        ],
        type: 'website',
        siteName: 'Soy Nexo',
    },
    twitter: {
        card: 'summary_large_image',
        title: '🎉 Patty 50th Birthday',
        description: 'Celebra con nosotros · Sábado 28 de Febrero · 7PM',
        images: ['/PATTY 50.jpeg'],
    },
}

export default function Patty50Layout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
