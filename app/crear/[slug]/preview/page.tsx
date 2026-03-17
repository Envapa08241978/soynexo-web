import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import Link from 'next/link'


export default async function PreviewPage({ params }: { params: { slug: string } }) {
    // 1. Fetch real event data
    const docRef = doc(db, 'events', params.slug, 'config', 'main')
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
        return (
            <div className="min-h-screen bg-[#0F0F12] flex flex-col items-center justify-center text-white p-6 text-center">
                <h1 className="text-3xl font-black mb-4">Evento no encontrado</h1>
                <p className="text-white/50 mb-8">El evento que buscas no existe o ya expiró.</p>
                <Link href="/crear" className="bg-[#BCA872] text-black px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm">
                    Crear nuevo evento
                </Link>
            </div>
        )
    }

    const eventData = docSnap.data()

    return (
        <div className="min-h-screen bg-[#0F0F12] text-white flex flex-col lg:flex-row">

            {/* Left Column: 100% Real Live Preview */}
            <div className="w-full lg:w-1/2 min-h-[60vh] lg:min-h-screen relative border-b lg:border-b-0 lg:border-r border-white/5 bg-black">
                <iframe
                    src={`/${params.slug}`}
                    className="w-full h-full border-0 absolute inset-0"
                    title="Vista Previa del Evento"
                />

                {/* Floating Tag */}
                <div className="absolute top-6 left-6 bg-[#BCA872] text-black text-xs font-bold px-4 py-2 rounded-full uppercase tracking-widest shadow-lg">
                    Vista Previa LIVE
                </div>
            </div>

            {/* Right Column: Checkout & Activation */}
            <div className="w-full lg:w-1/2 p-8 lg:p-16 flex flex-col justify-center">
                <div className="max-w-md mx-auto w-full">

                    <div className="mb-12">
                        <h1 className="text-4xl lg:text-5xl font-black tracking-tight mb-4">Tu página está <span className="text-[#BCA872]">casi lista.</span></h1>
                        <p className="text-lg text-white/50">Activa tu panel de control, invitaciones ilimitadas y álbum fotográfico colaborativo para <strong className="text-white">{eventData.title}</strong>.</p>
                    </div>

                    <div className="bg-white/5 border border-[#BCA872]/30 rounded-2xl p-6 mb-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#BCA872]/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>

                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <p className="text-xs uppercase tracking-widest text-[#BCA872] font-bold mb-1">Licencia de Evento</p>
                                <h3 className="text-2xl font-bold">Soy Nexo Premium</h3>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-black">$3,500 <span className="text-sm font-normal text-white/50">MXN</span></p>
                            </div>
                        </div>

                        <ul className="space-y-3 text-sm text-white/70 mb-8">
                            <li className="flex items-center gap-3"><span className="text-[#BCA872]">✓</span> Portal web personalizado con cuenta regresiva</li>
                            <li className="flex items-center gap-3"><span className="text-[#BCA872]">✓</span> Álbum digital colaborativo (fotos en vivo)</li>
                            <li className="flex items-center gap-3"><span className="text-[#BCA872]">✓</span> Panel reservado con lista de invitados en tiempo real</li>
                            <li className="flex items-center gap-3"><span className="text-[#BCA872]">✓</span> Códigos QR físicos para mesas ilimitados</li>
                        </ul>

                    </div>

                    <button
                        className="w-full py-5 rounded-xl font-bold text-black uppercase tracking-widest text-sm transition-transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                        style={{ background: '#BCA872', boxShadow: '0 8px 25px rgba(188,168,114,0.3)' }}
                    >
                        <span>Pagar con Stripe / Tarjeta</span>
                        <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>

                    <p className="text-center text-xs text-white/30 mt-6 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Pago 100% seguro encriptado
                    </p>

                </div>
            </div>

        </div>
    )
}
