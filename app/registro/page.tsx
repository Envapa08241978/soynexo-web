'use client'

import React, { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp, doc, getDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import Link from 'next/link'

// Default Theme: Morena (Guinda y Dorado)
const defaultTheme = {
    accent: '#A60321', // Guinda
    gold: '#CFA968', // Dorado
    bg: '#ffffff',
    text: '#333333'
}

type EventConfig = {
    id: string;
    name: string;
    description: string;
    date: string;
    time: string;
    location: string;
    image: string; // URL
}

export default function RegistroPage() {
    const [config, setConfig] = useState<any>({
        name: 'Registro Ciudadano',
        title: 'Atención Comunitaria',
        phone: '', // Default WhatsApp
        logo: '', // Placeholder
        activeEventId: null
    })
    const [event, setEvent] = useState<EventConfig | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Form State
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [cp, setCp] = useState('')
    const [colonia, setColonia] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Load active config and event
    useEffect(() => {
        const loadData = async () => {
            try {
                // Reference to the main campaign document
                const configRef = doc(db, 'campaigns', 'main_campaign', 'config', 'profile')
                const configSnap = await getDoc(configRef)

                if (configSnap.exists()) {
                    const data = configSnap.data()
                    setConfig((prev: any) => ({ ...prev, ...data }))

                    if (data.activeEventId) {
                        const eventDoc = await getDoc(doc(db, 'campaigns', 'main_campaign', 'events', data.activeEventId))
                        if (eventDoc.exists()) {
                            setEvent({ id: eventDoc.id, ...eventDoc.data() } as EventConfig)
                        }
                    }
                }
            } catch (err) {
                console.error("Error loading config:", err)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const cleanPhone = phone.replace(/\D/g, '')
        if (!name.trim()) return setError('El nombre es obligatorio')
        if (cleanPhone.length !== 10) return setError('El WhatsApp debe tener 10 dígitos')
        if (!cp.trim()) return setError('El Código Postal es obligatorio')
        if (!colonia.trim()) return setError('La Colonia es obligatoria')

        setIsSubmitting(true)
        try {
            await addDoc(collection(db, 'campaigns', 'main_campaign', 'contacts'), {
                name: name.trim(),
                phone: cleanPhone,
                cp: cp.trim(),
                colonia: colonia.trim(),
                eventId: event?.id || 'general',
                eventName: event?.name || 'Registro General',
                timestamp: serverTimestamp()
            })

            setShowSuccess(true)
            setName(''); setPhone(''); setCp(''); setColonia('')

            // Generate and trigger vCard download
            downloadVCard()

            // Redirect to WhatsApp after 2 seconds
            setTimeout(() => {
                const targetPhone = config.phone ? config.phone.replace(/\D/g, '') : ''
                if (targetPhone) {
                    const msg = encodeURIComponent(`¡Hola! Ya me registré en la plataforma. Mi nombre es ${name.trim()}.`)
                    window.location.href = `https://wa.me/52${targetPhone}?text=${msg}`
                }
            }, 2000)

        } catch (err) {
            console.error(err)
            setError('Error al enviar. Intenta de nuevo.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const downloadVCard = () => {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${config.name}\nTEL;TYPE=cell:+52${config.phone}\nEND:VCARD`
        const blob = new Blob([vcard], { type: 'text/vcard' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'contacto.vcf'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 rounded-full animate-spin border-t-transparent" style={{ borderColor: defaultTheme.accent, borderTopColor: 'transparent' }}></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white relative pb-12 font-sans overflow-x-hidden">
            {/* Header / Logo */}
            <header className="pt-8 pb-4 px-6 flex flex-col items-center justify-center text-center">
                {config.logo ? (
                    <img src={config.logo} alt="Logo" className="h-20 object-contain mb-4" />
                ) : (
                    <div className="w-24 h-24 rounded-full mb-4 flex items-center justify-center shadow-md bg-gray-100 border-2" style={{ borderColor: defaultTheme.accent }}>
                        <span className="text-3xl">🏛️</span>
                    </div>
                )}
                <h1 className="text-2xl font-black tracking-tight" style={{ color: defaultTheme.accent }}>{config.name}</h1>
                <p className="text-sm font-semibold uppercase tracking-widest mt-1" style={{ color: defaultTheme.gold }}>{config.title}</p>
            </header>

            {/* Event Info (If active event exists) */}
            {event && (
                <section className="px-5 mb-8">
                    <div className="rounded-2xl overflow-hidden shadow-xl" style={{ border: `1px solid ${defaultTheme.gold}33` }}>
                        {event.image ? (
                            <img src={event.image} alt={event.name} className="w-full h-48 object-cover" />
                        ) : (
                            <div className="w-full h-24 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${defaultTheme.accent}, ${defaultTheme.gold})` }}>
                                <span className="text-white font-bold text-xl">{event.name}</span>
                            </div>
                        )}
                        <div className="p-4 bg-white">
                            <h2 className="font-bold text-lg mb-2 text-gray-800">{event.name}</h2>
                            <div className="flex flex-col gap-1.5 text-sm text-gray-600">
                                <div className="flex items-center gap-2"><span>📅</span> {new Date(event.date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                                <div className="flex items-center gap-2"><span>🕐</span> {event.time} hrs</div>
                                <div className="flex items-center gap-2"><span>📍</span> {event.location}</div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Registration Form */}
            <main className="px-5 max-w-md mx-auto relative z-10">
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border" style={{ borderColor: `${defaultTheme.accent}22` }}>
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold text-gray-800">Censo Comunitario</h2>
                        <p className="text-sm text-gray-500 mt-1">Regístrate para mantenernos en contacto</p>
                    </div>

                    {showSuccess ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: `${defaultTheme.gold}22`, color: defaultTheme.gold }}>
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="font-bold text-lg text-gray-800 mb-2">¡Registro Exitoso!</h3>
                            <p className="text-sm text-gray-600 mb-4">Descargando contacto... serás redirigido a WhatsApp.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {error && (
                                <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100 text-center">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre Completo</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Ej. Ana García"
                                    className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-red-500 transition-colors text-gray-800" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">WhatsApp (10 dígitos)</label>
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required placeholder="Ej. 642 123 4567"
                                    className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-red-500 transition-colors text-gray-800" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">C.P.</label>
                                    <input type="text" value={cp} onChange={e => setCp(e.target.value.replace(/\D/g, '').slice(0, 5))} required placeholder="Ej. 85800"
                                        className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-red-500 transition-colors text-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Colonia</label>
                                    <input type="text" value={colonia} onChange={e => setColonia(e.target.value)} required placeholder="Ej. Centro"
                                        className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-red-500 transition-colors text-gray-800" />
                                </div>
                            </div>

                            <button type="submit" disabled={isSubmitting}
                                className="w-full mt-2 py-4 rounded-xl font-bold text-white tracking-wide transition-all active:scale-[0.98] shadow-lg disabled:opacity-70 flex justify-center items-center"
                                style={{ background: `linear-gradient(to right, ${defaultTheme.accent}, #800018)` }}>
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-3 rounded-full animate-spin border-t-transparent border-white"></div>
                                ) : 'REGISTRARME AHORA'}
                            </button>
                        </form>
                    )}
                </div>
            </main>

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-gray-400 font-medium">
                <p>Plataforma Segura y Confidencial</p>
                <div className="mt-4 flex justify-center">
                    <img src="/logo soynexo horizontal sin fondo.png" alt="Soy Nexo" className="h-4 opacity-50 grayscale" onError={(e) => e.currentTarget.style.display = 'none'} />
                </div>
            </div>

            {/* Background Decorations */}
            <div className="fixed top-[-10%] left-[-20%] w-[60%] h-[30%] rounded-[100%] blur-[80px] opacity-10 pointer-events-none z-0" style={{ background: defaultTheme.accent }}></div>
            <div className="fixed top-[20%] right-[-30%] w-[50%] h-[40%] rounded-[100%] blur-[100px] opacity-[0.08] pointer-events-none z-0" style={{ background: defaultTheme.gold }}></div>
        </div>
    )
}
