import { Metadata } from 'next';type Props = {
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

    return (
        <div style={{ margin: 0, padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#000' }}>
            {imageUrl ? (
                <img src={imageUrl} style={{ maxWidth: '100%', maxHeight: '100vh', objectFit: 'contain' }} alt="Invitación" />
            ) : (
                <h1 style={{ color: 'white', fontFamily: 'sans-serif' }}>Enlace inválido o sin imagen</h1>
            )}
        </div>
    );
}
