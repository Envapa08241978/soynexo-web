'use client'

import React, { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore'
import Link from 'next/link'

interface GuestEventConfig {
    title: string
    date: string
    theme?: { accentColor: string; backgroundColor: string; textColor: string }
}

export default function RealdashboardPage({ params }: { params: { 'slug-evento': string } }) {
    const slug = params['slug-evento']
    const [config, setConfig] = useState<GuestEventConfig | null>(null)
    const [rsvps, setRsvps] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Load Event details
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const q = query(collection(db, 'events', slug, 'config'))
                const snapshot = await getDocs(q)
                if (!snapshot.empty) {
                    setConfig(snapshot.docs[0].data() as GuestEventConfig)
                }
            } catch (error) {
                console.error("Config load error", error)
            }
        }
        loadConfig()
    }, [slug])

    // Real-time RSVPs
    useEffect(() => {
        const rsvpRef = collection(db, 'events', slug, 'rsvps')
        const rsvpQ = query(rsvpRef, orderBy('timestamp', 'desc'))
        const unsubscribeRsvps = onSnapshot(rsvpQ, (snapshot) => {
            const firebaseRsvps = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toMillis() || Date.now()
            }))
            setRsvps(firebaseRsvps)
            setIsLoading(false)
        }, (error) => console.error('RSVP sync error:', error))

        return () => unsubscribeRsvps()
    }, [slug])

    const downloadCSV = () => {
        const headers = ['Nombre Completo', 'Lugares Confirmados', 'WhatsApp', 'Fecha de Registro']
        const rows = rsvps.map(r => [
            `"${r.name || ''}"`,
            r.guests || 1,
            r.phone || '',
            new Date(r.timestamp).toLocaleString()
        ])

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + headers.join(',') + '\n'
            + rows.map(e => e.join(',')).join('\n')

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `invitados_${slug}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const accent = config?.theme?.accentColor || '#BCA872'
    const bg = config?.theme?.backgroundColor || '#0F0F12'
    const accentTextColor = bg

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0F12' }}>
                <div className="w-10 h-10 border-4 rounded-full animate-spin border-t-transparent border-[#BCA872]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen text-white p-6 md:p-12 font-sans" style={{ background: '#0F0F12' }}>
            <div className="max-w-4xl mx-auto">
                <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
                    <div>
                        <Link href={`/${slug}`} className="text-[#BCA872] hover:text-white transition-colors text-sm font-bold uppercase tracking-widest mb-2 inline-flex items-center gap-2">
                            ← Volver al Evento
                        </Link>
                        <h1 className="text-3xl md:text-4xl font-black mt-2">
                            Dashboard: <span style={{ color: accent }}>{config?.title || 'Mi Evento'}</span>
                        </h1>
                    </div>

                    <div className="flex bg-[#1A1A1F] rounded-2xl p-4 border border-white/10 shadow-xl items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-500/20 text-green-400 text-xl">
                            👥
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-white/50 font-bold">Total Invitados</p>
                            <p className="text-3xl font-black text-white">{rsvps.reduce((acc, curr) => acc + (parseInt(curr.guests) || 1), 0)}</p>
                        </div>
                    </div>
                </header>

                <div className="bg-[#1A1A1F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="p-4 md:p-6 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-black/20">
                        <div>
                            <h3 className="text-white font-bold tracking-widest uppercase text-sm">Lista de Confirmados</h3>
                            <p className="text-white/40 text-xs mt-1">Gente VIP que ya tiene su acceso.</p>
                        </div>
                        <button onClick={downloadCSV} disabled={rsvps.length === 0}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                            style={{ background: accent, color: accentTextColor }}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Descargar Excel / CSV
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="border-b border-white/5 text-xs tracking-widest uppercase text-white/30 bg-black/40">
                                    <th className="font-bold p-4 pl-6">Invitado Principal</th>
                                    <th className="font-bold p-4 text-center">Lugares</th>
                                    <th className="font-bold p-4">WhatsApp</th>
                                    <th className="font-bold p-4 pr-6 text-right">Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rsvps.map((rsvp, idx) => (
                                    <tr key={rsvp.id || idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4 pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner" style={{ background: accent, color: accentTextColor }}>
                                                    {rsvp.name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="font-bold text-white/90">{rsvp.name}</div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 font-mono text-sm font-bold text-white/80">
                                                {rsvp.guests}
                                            </span>
                                        </td>
                                        <td className="p-4 text-white/60 text-sm font-mono tracking-wider">
                                            {rsvp.phone?.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')}
                                        </td>
                                        <td className="p-4 pr-6 text-right text-white/40 text-[11px] uppercase tracking-wide">
                                            {new Date(rsvp.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                    </tr>
                                ))}
                                {rsvps.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center p-12 text-white/30">
                                            <div className="text-4xl mb-3 opacity-50">👥</div>
                                            <p className="font-bold text-lg mb-1">Tu lista está vacía</p>
                                            <p className="text-sm">Comparte el enlace de tu evento para empezar a recibir confirmaciones.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
