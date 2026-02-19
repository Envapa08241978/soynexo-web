import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: '🎂 Mis Setenta — Albita Rojo | Soy Nexo',
    description: 'Viernes 20 de Febrero · 18 Hrs · ¡Comparte tus fotos y videos de la fiesta!',
    openGraph: {
        title: '🎂 Mis Setenta — Albita Rojo',
        description: 'Viernes 20 de Febrero · 18 Hrs · ¡Sube tus recuerdos al álbum!',
        images: [
            {
                url: '/invitacion albita rojo mis 70.jpeg',
                width: 720,
                height: 1280,
                alt: 'Mis Setenta — Albita Rojo — Viernes 20 de Febrero, 18 Hrs',
            },
        ],
        type: 'website',
        siteName: 'Soy Nexo',
    },
    twitter: {
        card: 'summary',
        title: '🎂 Mis Setenta — Albita Rojo',
        description: 'Viernes 20 de Febrero · 18 Hrs · ¡Comparte tus fotos!',
        images: ['/invitacion albita rojo mis 70.jpeg'],
    },
}

export default function AlbitaRojo70Layout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
