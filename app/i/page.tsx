import { Metadata } from 'next';
import { redirect } from 'next/navigation';

type Props = {
    searchParams: { [key: string]: string | string[] | undefined };
};

export function generateMetadata({ searchParams }: Props): Metadata {
    const imgParam = searchParams.img;
    const imageUrl = Array.isArray(imgParam) ? imgParam[0] : imgParam;

    if (!imageUrl) {
        return {
            title: 'Invitación'
        };
    }

    return {
        title: 'Invitación Comunitara',
        description: 'Asiste a nuestra asamblea.',
        openGraph: {
            title: 'Invitación',
            description: 'Asiste a nuestra asamblea.',
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt: 'Invitación',
                }
            ]
        },
        twitter: {
            card: 'summary_large_image',
            title: 'Invitación',
            description: 'Asiste a nuestra asamblea.',
            images: [imageUrl],
        }
    };
}

export default function RouteRedirect({ searchParams }: Props) {
    const imgParam = searchParams.img;
    const imageUrl = Array.isArray(imgParam) ? imgParam[0] : imgParam;

    // Redirigir siempre a la imagen si un humano abre el link en su navegador
    if (imageUrl) {
        redirect(imageUrl);
    }

    return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <h1>Enlace inválido o sin imagen</h1>
        </div>
    );
}
