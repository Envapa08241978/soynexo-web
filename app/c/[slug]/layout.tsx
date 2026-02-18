import type { Metadata } from 'next'

interface Props {
    params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const slug = params.slug
    const displayName = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    return {
        title: `${displayName} — Evento Ciudadano`,
        description: `Confirma tu asistencia al evento de ${displayName}. Álbum de fotos en tiempo real.`,
        openGraph: {
            title: `${displayName} — Evento Ciudadano`,
            description: `Confirma tu asistencia y comparte fotos del evento.`,
            type: 'website',
            siteName: 'Soy Nexo',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${displayName} — Evento`,
            description: `Confirma tu asistencia al evento.`,
        },
    }
}

export default function CitizenLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
