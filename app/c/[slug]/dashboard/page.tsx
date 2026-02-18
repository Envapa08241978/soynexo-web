'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'

/* ================================================================
   TYPES
   ================================================================ */
interface ContactItem {
    id: string
    name: string
    phone: string
    colonia?: string
    eventId: string
    eventName: string
    timestamp: any
}

interface EventItem {
    id: string
    name: string
    date: string
    location: string
    coords: string
    image: string
    description: string
    time: string
    active?: boolean
}

interface PoliticianConfig {
    name: string
    title: string
    party: string
    phone: string
    photo: string
    dashboardPassword: string
    accentColor: string
    activeEventId?: string
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function DashboardPage() {
    const params = useParams()
    const slug = params.slug as string

    // --- Auth ---
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [password, setPassword] = useState('')
    const [loginError, setLoginError] = useState('')
    const [storedPassword, setStoredPassword] = useState('admin123')

    // --- Tab ---
    const [activeTab, setActiveTab] = useState<'contacts' | 'events' | 'config'>('contacts')

    // --- Data ---
    const [contacts, setContacts] = useState<ContactItem[]>([])
    const [events, setEvents] = useState<EventItem[]>([])
    const [config, setConfig] = useState<PoliticianConfig>({
        name: 'Lic. Juan Pérez', title: 'Candidato', party: '', phone: '6421600559',
        photo: '', dashboardPassword: 'admin123', accentColor: '#1a56db',
    })

    // --- Filters ---
    const [searchQuery, setSearchQuery] = useState('')
    const [filterEvent, setFilterEvent] = useState('')
    const [filterColonia, setFilterColonia] = useState('')

    // --- Event Form ---
    const [showEventForm, setShowEventForm] = useState(false)
    const [eventForm, setEventForm] = useState<Partial<EventItem>>({
        name: '', date: '', location: '', coords: '', image: '', description: '', time: '',
    })
    const [editingEventId, setEditingEventId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // --- Config edit ---
    const [isEditingConfig, setIsEditingConfig] = useState(false)
    const [configForm, setConfigForm] = useState<PoliticianConfig>(config)

    /* ---- Load config ---- */
    useEffect(() => {
        if (!slug) return
        const loadConfig = async () => {
            try {
                const configDoc = await getDoc(doc(db, 'politicians', slug, 'config', 'profile'))
                if (configDoc.exists()) {
                    const data = configDoc.data() as PoliticianConfig
                    setConfig(prev => ({ ...prev, ...data }))
                    setConfigForm(prev => ({ ...prev, ...data }))
                    if (data.dashboardPassword) setStoredPassword(data.dashboardPassword)
                }
            } catch (err) { console.log('Using default config') }
        }
        loadConfig()
    }, [slug])

    /* ---- Real-time contacts ---- */
    useEffect(() => {
        if (!slug || !isAuthenticated) return
        const ref = collection(db, 'politicians', slug, 'contacts')
        const q = query(ref, orderBy('timestamp', 'desc'))
        return onSnapshot(q, (snap) => {
            setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)))
        })
    }, [slug, isAuthenticated])

    /* ---- Real-time events ---- */
    useEffect(() => {
        if (!slug || !isAuthenticated) return
        const ref = collection(db, 'politicians', slug, 'events')
        return onSnapshot(ref, (snap) => {
            setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)))
        })
    }, [slug, isAuthenticated])

    /* ---- Auth ---- */
    const handleLogin = () => {
        if (password === storedPassword) {
            setIsAuthenticated(true)
            setLoginError('')
        } else {
            setLoginError('Contraseña incorrecta')
        }
    }

    /* ---- Filtered contacts ---- */
    const filteredContacts = contacts.filter(c => {
        const search = searchQuery.toLowerCase()
        const matchesSearch = !search || c.name?.toLowerCase().includes(search) || c.phone?.includes(search)
        const matchesEvent = !filterEvent || c.eventId === filterEvent
        const matchesColonia = !filterColonia || c.colonia?.toLowerCase().includes(filterColonia.toLowerCase())
        return matchesSearch && matchesEvent && matchesColonia
    })

    /* ---- Stats ---- */
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayContacts = contacts.filter(c => {
        const ts = c.timestamp?.toDate?.() || new Date(0)
        return ts >= todayStart
    }).length

    const uniqueColonias = Array.from(new Set(contacts.map(c => c.colonia).filter(Boolean))) as string[]
    const contactsByEvent = events.map(e => ({
        ...e,
        count: contacts.filter(c => c.eventId === e.id).length,
    }))

    /* ---- Export ---- */
    const exportContacts = (format: 'google' | 'excel') => {
        const params = new URLSearchParams()
        params.set('format', format)
        if (filterEvent) params.set('event', filterEvent)
        if (filterColonia) params.set('colonia', filterColonia)
        window.open(`/api/export/${slug}?${params.toString()}`, '_blank')
    }

    /* ---- Event CRUD ---- */
    const saveEvent = async () => {
        if (!eventForm.name) return
        setIsSaving(true)
        try {
            if (editingEventId) {
                await updateDoc(doc(db, 'politicians', slug, 'events', editingEventId), { ...eventForm })
            } else {
                await addDoc(collection(db, 'politicians', slug, 'events'), { ...eventForm, active: false })
            }
            setShowEventForm(false); setEventForm({ name: '', date: '', location: '', coords: '', image: '', description: '', time: '' })
            setEditingEventId(null)
        } catch (err) { console.error('Save event error:', err) }
        finally { setIsSaving(false) }
    }

    const setActiveEvent = async (eventId: string) => {
        try {
            await setDoc(doc(db, 'politicians', slug, 'config', 'profile'), {
                ...config, activeEventId: eventId,
            }, { merge: true })
            setConfig(prev => ({ ...prev, activeEventId: eventId }))
        } catch (err) { console.error('Set active event error:', err) }
    }

    const deleteEvent = async (eventId: string) => {
        if (!confirm('¿Eliminar este evento?')) return
        try {
            await deleteDoc(doc(db, 'politicians', slug, 'events', eventId))
        } catch (err) { console.error('Delete event error:', err) }
    }

    /* ---- Save Config ---- */
    const saveConfig = async () => {
        setIsSaving(true)
        try {
            await setDoc(doc(db, 'politicians', slug, 'config', 'profile'), configForm, { merge: true })
            setConfig(configForm)
            setStoredPassword(configForm.dashboardPassword)
            setIsEditingConfig(false)
        } catch (err) { console.error('Save config error:', err) }
        finally { setIsSaving(false) }
    }

    /* ---- Delete contact ---- */
    const deleteContact = async (contactId: string) => {
        if (!confirm('¿Eliminar este contacto?')) return
        try { await deleteDoc(doc(db, 'politicians', slug, 'contacts', contactId)) }
        catch (err) { console.error('Delete contact error:', err) }
    }

    const accent = config.accentColor || '#1a56db'

    /* ================================================================
       LOGIN SCREEN
       ================================================================ */
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0f1117' }}>
                <div className="w-full max-w-sm text-center">
                    <div className="text-4xl mb-4">🏛️</div>
                    <h1 className="text-xl font-bold text-white mb-1">Dashboard</h1>
                    <p className="text-white/40 text-sm mb-6">{slug}</p>
                    <input
                        type="password" value={password} onChange={(e) => { setPassword(e.target.value); setLoginError('') }}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        placeholder="Contraseña" autoFocus
                        className="w-full px-4 py-3.5 rounded-xl mb-3 text-sm outline-none text-white placeholder-white/20"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    {loginError && <p className="text-red-400 text-xs mb-3">{loginError}</p>}
                    <button onClick={handleLogin}
                        className="w-full py-3.5 rounded-xl text-sm font-bold text-white"
                        style={{ background: accent }}>
                        Entrar
                    </button>
                    <Link href={`/c/${slug}`} className="inline-block mt-4 text-xs text-white/30 hover:text-white/50">
                        ← Ver página del evento
                    </Link>
                </div>
            </div>
        )
    }

    /* ================================================================
       DASHBOARD
       ================================================================ */
    return (
        <div className="min-h-screen" style={{ background: '#0f1117' }}>
            {/* Header */}
            <header className="px-4 py-4 flex items-center justify-between"
                style={{ background: 'rgba(15,17,23,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>
                <div>
                    <h1 className="text-white font-bold text-lg">📊 Dashboard</h1>
                    <p className="text-white/30 text-xs">{config.name}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href={`/c/${slug}`} target="_blank"
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/50"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        👁️ Ver página
                    </Link>
                    <button onClick={() => setIsAuthenticated(false)}
                        className="px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/50">
                        Salir
                    </button>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="px-4 py-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-2xl font-black text-white">{contacts.length}</p>
                    <p className="text-[0.6rem] text-white/30 font-bold tracking-wider uppercase">Total Contactos</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-2xl font-black" style={{ color: accent }}>{todayContacts}</p>
                    <p className="text-[0.6rem] text-white/30 font-bold tracking-wider uppercase">Hoy</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-2xl font-black text-white">{events.length}</p>
                    <p className="text-[0.6rem] text-white/30 font-bold tracking-wider uppercase">Eventos</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-4 flex gap-1 mb-4">
                {([
                    { key: 'contacts', label: '👥 Contactos', count: contacts.length },
                    { key: 'events', label: '🏛️ Eventos', count: events.length },
                    { key: 'config', label: '⚙️ Configuración' },
                ] as const).map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className="px-4 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
                        style={{
                            background: activeTab === tab.key ? `${accent}20` : 'rgba(255,255,255,0.03)',
                            color: activeTab === tab.key ? accent : 'rgba(255,255,255,0.4)',
                            border: activeTab === tab.key ? `1px solid ${accent}30` : '1px solid transparent',
                        }}>
                        {tab.label}
                        {'count' in tab && <span className="text-[0.6rem] opacity-60">({tab.count})</span>}
                    </button>
                ))}
            </div>

            {/* ---- TAB: CONTACTS ---- */}
            {activeTab === 'contacts' && (
                <div className="px-4 pb-8">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="🔍 Buscar nombre o teléfono..."
                            className="flex-1 min-w-[180px] px-3 py-2.5 rounded-xl text-xs outline-none text-white placeholder-white/20"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                        <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}
                            className="px-3 py-2.5 rounded-xl text-xs outline-none text-white/60 cursor-pointer"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <option value="">Todos los eventos</option>
                            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        {uniqueColonias.length > 0 && (
                            <select value={filterColonia} onChange={(e) => setFilterColonia(e.target.value)}
                                className="px-3 py-2.5 rounded-xl text-xs outline-none text-white/60 cursor-pointer"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <option value="">Todas las colonias</option>
                                {uniqueColonias.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        )}
                    </div>

                    {/* Export buttons */}
                    <div className="flex gap-2 mb-4">
                        <button onClick={() => exportContacts('google')}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
                            style={{ background: '#34a853' }}>
                            📥 Google Contacts
                        </button>
                        <button onClick={() => exportContacts('excel')}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
                            style={{ background: '#217346' }}>
                            📊 Excel
                        </button>
                        <span className="text-xs text-white/20 self-center ml-2">
                            {filteredContacts.length} resultado{filteredContacts.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Contacts table */}
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        <th className="text-left px-3 py-2.5 text-white/30 font-bold uppercase tracking-wider text-[0.6rem]">Nombre</th>
                                        <th className="text-left px-3 py-2.5 text-white/30 font-bold uppercase tracking-wider text-[0.6rem]">WhatsApp</th>
                                        <th className="text-left px-3 py-2.5 text-white/30 font-bold uppercase tracking-wider text-[0.6rem] hidden sm:table-cell">Evento</th>
                                        <th className="text-left px-3 py-2.5 text-white/30 font-bold uppercase tracking-wider text-[0.6rem] hidden sm:table-cell">Colonia</th>
                                        <th className="text-left px-3 py-2.5 text-white/30 font-bold uppercase tracking-wider text-[0.6rem] hidden md:table-cell">Fecha</th>
                                        <th className="text-left px-3 py-2.5 text-white/30 font-bold uppercase tracking-wider text-[0.6rem]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredContacts.map(c => (
                                        <tr key={c.id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                                            <td className="px-3 py-2.5 text-white font-medium">{c.name}</td>
                                            <td className="px-3 py-2.5">
                                                <a href={`https://wa.me/52${c.phone}`} target="_blank" rel="noopener noreferrer"
                                                    className="hover:underline" style={{ color: '#25d366' }}>
                                                    {c.phone}
                                                </a>
                                            </td>
                                            <td className="px-3 py-2.5 text-white/40 hidden sm:table-cell">{c.eventName}</td>
                                            <td className="px-3 py-2.5 text-white/40 hidden sm:table-cell">{c.colonia || '—'}</td>
                                            <td className="px-3 py-2.5 text-white/30 hidden md:table-cell">
                                                {c.timestamp?.toDate?.()?.toLocaleDateString('es-MX') || '—'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <a href={`https://wa.me/52${c.phone}`} target="_blank" rel="noopener noreferrer"
                                                        className="px-2 py-1 rounded-lg text-[0.6rem] font-bold text-white flex items-center gap-1 transition-all hover:opacity-80 active:scale-95"
                                                        style={{ background: '#25d366' }}>
                                                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                                        Enviar
                                                    </a>
                                                    <button onClick={() => deleteContact(c.id)}
                                                        className="text-white/20 hover:text-red-400 transition-colors text-sm">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {filteredContacts.length === 0 && (
                            <div className="text-center py-8 text-white/20 text-sm">
                                {contacts.length === 0 ? 'Aún no hay contactos' : 'No hay resultados con estos filtros'}
                            </div>
                        )}
                    </div>

                    {/* Contact breakdown by event */}
                    {contactsByEvent.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-xs font-bold text-white/30 uppercase tracking-wider mb-3">Contactos por evento</h3>
                            <div className="space-y-2">
                                {contactsByEvent.map(e => (
                                    <div key={e.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                                        <span className="text-sm text-white/60">{e.name}</span>
                                        <span className="text-sm font-bold" style={{ color: accent }}>{e.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ---- TAB: EVENTS ---- */}
            {activeTab === 'events' && (
                <div className="px-4 pb-8">
                    <button onClick={() => { setShowEventForm(true); setEditingEventId(null); setEventForm({ name: '', date: '', location: '', coords: '', image: '', description: '', time: '' }) }}
                        className="w-full mb-4 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                        style={{ background: accent, border: 'none' }}>
                        ➕ Crear Nuevo Evento
                    </button>

                    {/* Event list */}
                    <div className="space-y-3">
                        {events.map(e => (
                            <div key={e.id} className="rounded-xl p-4"
                                style={{
                                    background: config.activeEventId === e.id ? `${accent}10` : 'rgba(255,255,255,0.02)',
                                    border: config.activeEventId === e.id ? `1px solid ${accent}30` : '1px solid rgba(255,255,255,0.06)',
                                }}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-bold text-white">{e.name}</h3>
                                            {config.activeEventId === e.id && (
                                                <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full"
                                                    style={{ background: `${accent}20`, color: accent }}>ACTIVO</span>
                                            )}
                                        </div>
                                        <p className="text-white/30 text-xs">{e.location} · {e.time}</p>
                                        {e.date && <p className="text-white/20 text-xs mt-0.5">
                                            {new Date(e.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {config.activeEventId !== e.id && (
                                            <button onClick={() => setActiveEvent(e.id)}
                                                className="px-2.5 py-1.5 rounded-lg text-[0.6rem] font-bold"
                                                style={{ background: `${accent}15`, color: accent }}>
                                                Activar
                                            </button>
                                        )}
                                        <button onClick={() => {
                                            setEventForm(e); setEditingEventId(e.id); setShowEventForm(true)
                                        }}
                                            className="px-2 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60"
                                            style={{ background: 'rgba(255,255,255,0.04)' }}>✏️</button>
                                        <button onClick={() => deleteEvent(e.id)}
                                            className="px-2 py-1.5 rounded-lg text-xs text-white/20 hover:text-red-400"
                                            style={{ background: 'rgba(255,255,255,0.04)' }}>🗑️</button>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs" style={{ color: accent }}>
                                    {contacts.filter(c => c.eventId === e.id).length} contactos registrados
                                </div>
                            </div>
                        ))}
                        {events.length === 0 && (
                            <div className="text-center py-8 text-white/20 text-sm">
                                No hay eventos. Crea el primero ☝️
                            </div>
                        )}
                    </div>

                    {/* Event Form Modal */}
                    {showEventForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}
                            onClick={() => setShowEventForm(false)}>
                            <div className="rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto" style={{ background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.1)' }}
                                onClick={(e) => e.stopPropagation()}>
                                <h3 className="text-lg font-bold text-white mb-4">
                                    {editingEventId ? '✏️ Editar Evento' : '➕ Nuevo Evento'}
                                </h3>
                                <div className="space-y-3">
                                    {[
                                        { key: 'name', label: 'Nombre del evento *', placeholder: 'Ej. Informe Ciudadano 2026', type: 'text' },
                                        { key: 'date', label: 'Fecha y hora', placeholder: '', type: 'datetime-local' },
                                        { key: 'time', label: 'Hora (texto)', placeholder: 'Ej. 6:00 PM', type: 'text' },
                                        { key: 'location', label: 'Ubicación', placeholder: 'Ej. Plaza Principal, Navojoa', type: 'text' },
                                        { key: 'coords', label: 'Coordenadas Google Maps', placeholder: 'Ej. 27.082254,-109.457556', type: 'text' },
                                        { key: 'image', label: 'URL de imagen del evento', placeholder: 'https://...', type: 'text' },
                                        { key: 'description', label: 'Descripción', placeholder: 'Breve descripción del evento', type: 'text' },
                                    ].map(field => (
                                        <div key={field.key}>
                                            <label className="text-[0.6rem] text-white/30 font-bold uppercase tracking-wider mb-0.5 block">{field.label}</label>
                                            <input type={field.type} value={(eventForm as any)[field.key] || ''}
                                                onChange={(e) => setEventForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                placeholder={field.placeholder}
                                                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none text-white placeholder-white/15"
                                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-5">
                                    <button onClick={() => setShowEventForm(false)}
                                        className="flex-1 py-3 rounded-xl text-xs text-white/40" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                        Cancelar
                                    </button>
                                    <button onClick={saveEvent} disabled={isSaving || !eventForm.name}
                                        className="flex-1 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-30"
                                        style={{ background: accent }}>
                                        {isSaving ? 'Guardando...' : editingEventId ? 'Guardar Cambios' : 'Crear Evento'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ---- TAB: CONFIG ---- */}
            {activeTab === 'config' && (
                <div className="px-4 pb-8">
                    <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <h3 className="text-sm font-bold text-white mb-4">⚙️ Configuración del Político</h3>
                        <div className="space-y-3">
                            {[
                                { key: 'name', label: 'Nombre completo', placeholder: 'Ej. Lic. Juan Pérez' },
                                { key: 'title', label: 'Título/Cargo', placeholder: 'Ej. Candidato, Diputado' },
                                { key: 'party', label: 'Partido/Movimiento', placeholder: 'Ej. Partido X' },
                                { key: 'phone', label: 'WhatsApp (10 dígitos)', placeholder: '6421234567' },
                                { key: 'photo', label: 'URL de foto de perfil', placeholder: 'https://...' },
                                { key: 'accentColor', label: 'Color de acento (hex)', placeholder: '#1a56db' },
                                { key: 'dashboardPassword', label: 'Contraseña del dashboard', placeholder: '...' },
                            ].map(field => (
                                <div key={field.key}>
                                    <label className="text-[0.6rem] text-white/30 font-bold uppercase tracking-wider mb-0.5 block">{field.label}</label>
                                    <input type={field.key === 'dashboardPassword' ? 'password' : field.key === 'accentColor' ? 'color' : 'text'}
                                        value={(configForm as any)[field.key] || ''}
                                        onChange={(e) => setConfigForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        disabled={!isEditingConfig}
                                        placeholder={field.placeholder}
                                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none text-white placeholder-white/15 disabled:opacity-40"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-5">
                            {isEditingConfig ? (
                                <>
                                    <button onClick={() => { setIsEditingConfig(false); setConfigForm(config) }}
                                        className="flex-1 py-3 rounded-xl text-xs text-white/40" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                        Cancelar
                                    </button>
                                    <button onClick={saveConfig} disabled={isSaving}
                                        className="flex-1 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-30"
                                        style={{ background: accent }}>
                                        {isSaving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => setIsEditingConfig(true)}
                                    className="flex-1 py-3 rounded-xl text-xs font-bold text-white"
                                    style={{ background: accent }}>
                                    ✏️ Editar Configuración
                                </button>
                            )}
                        </div>
                    </div>

                    {/* URL info */}
                    <div className="mt-6 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <h3 className="text-sm font-bold text-white mb-2">🔗 Enlaces</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-white/40">Página del evento:</span>
                                <code className="text-white/60 font-mono">soynexo.com/c/{slug}</code>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/40">Dashboard:</span>
                                <code className="text-white/60 font-mono">soynexo.com/c/{slug}/dashboard</code>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
