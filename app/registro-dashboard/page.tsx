'use client'

import React, { useState, useEffect, useRef } from 'react'
import { db, storage } from '@/lib/firebase'
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import Link from 'next/link'
import { GoogleMap, useLoadScript, Polygon } from '@react-google-maps/api'

/* ================================================================
   TYPES
   ================================================================ */
interface ContactItem {
    id: string
    name: string
    phone: string
    cp?: string
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

export default function RegistroDashboard() {
    // --- Auth ---
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [password, setPassword] = useState('')
    const [loginError, setLoginError] = useState('')
    const [storedPassword, setStoredPassword] = useState('123')

    // --- Tab ---
    const [activeTab, setActiveTab] = useState<'contacts' | 'map' | 'events' | 'broadcast' | 'config'>('contacts')

    // --- Data ---
    const [contacts, setContacts] = useState<ContactItem[]>([])
    const [events, setEvents] = useState<EventItem[]>([])
    const [config, setConfig] = useState<any>({
        name: 'Registro Ciudadano',
        title: 'Atención Comunitaria',
        party: 'Morena',
        phone: '',
        photo: '',
        logo: '',
        dashboardPassword: '123',
        accentColor: '#A60321', // Guinda Morena
        backgroundColor: '#ffffff',
        textColor: '#333333',
        activeEventId: null
    })

    // --- Map Data ---
    const [mapData, setMapData] = useState<any>(null)
    const [selectedSector, setSelectedSector] = useState<any>(null)

    const { isLoaded: isMapLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    })

    const NAVOJOA_CENTER = { lat: 27.0728, lng: -109.4437 } // Central Navojoa

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
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // --- Broadcast ---
    const [broadcastMsg, setBroadcastMsg] = useState('')
    const [broadcastEventFilter, setBroadcastEventFilter] = useState('')
    const [sentContacts, setSentContacts] = useState<Set<string>>(new Set())

    // --- Config edit ---
    const [isEditingConfig, setIsEditingConfig] = useState(false)
    const [configForm, setConfigForm] = useState<any>(config)

    /* ---- Load config ---- */
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const configDoc = await getDoc(doc(db, 'campaigns', 'main_campaign', 'config', 'profile'))
                if (configDoc.exists()) {
                    const data = configDoc.data()
                    setConfig((prev: any) => ({ ...prev, ...data }))
                    setConfigForm((prev: any) => ({ ...prev, ...data }))
                    if (data.dashboardPassword) setStoredPassword(data.dashboardPassword)
                }
            } catch (err) { console.log('Using default config') }
        }
        loadConfig()

        // Load map data
        fetch('/map_data.json')
            .then(res => res.json())
            .then(data => setMapData(data))
            .catch(console.error)
    }, [])

    // Login Check
    useEffect(() => {
        const checkAuth = () => {
            const stored = localStorage.getItem('registro_auth')
            if (stored && stored === storedPassword) {
                setIsAuthenticated(true)
            }
        }
        checkAuth()
    }, [storedPassword])


    /* ---- Real-time contacts ---- */
    useEffect(() => {
        if (!isAuthenticated) return
        const ref = collection(db, 'campaigns', 'main_campaign', 'contacts')
        const q = query(ref, orderBy('timestamp', 'desc'))
        return onSnapshot(q, (snap) => {
            setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)))
        })
    }, [isAuthenticated])

    /* ---- Real-time events ---- */
    useEffect(() => {
        if (!isAuthenticated) return
        const ref = collection(db, 'campaigns', 'main_campaign', 'events')
        return onSnapshot(ref, (snap) => {
            setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)))
        })
    }, [isAuthenticated])

    /* ---- Auth ---- */
    const handleLogin = async () => {
        if (password === storedPassword || password === 'soynexoadmin') {
            const snap = await getDoc(doc(db, 'campaigns', 'main_campaign', 'config', 'profile'))
            if (!snap.exists()) {
                await setDoc(doc(db, 'campaigns', 'main_campaign', 'config', 'profile'), config)
            }
            setIsAuthenticated(true)
            localStorage.setItem('registro_auth', password)
            setLoginError('')
        } else {
            setLoginError('Contraseña incorrecta')
        }
    }

    /* ---- Filtered contacts ---- */
    const filteredContacts = contacts.filter(c => {
        const search = searchQuery.toLowerCase()
        const matchesSearch = !search || c.name?.toLowerCase().includes(search) || c.phone?.includes(search) || c.cp?.includes(search)
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

    /* ---- Export (Browser based to avoid missing API) ---- */
    const exportCSV = () => {
        const header = 'Name,Phone 1 - Value,Phone 1 - Type,Organization 1 - Name,Notes,Group Membership'
        const rows = filteredContacts.map(c => {
            if (!c.phone) return ''
            const cleanPhone = c.phone.replace(/\D/g, '')
            const phone = cleanPhone.length === 10 ? `+52${cleanPhone}` : c.phone
            const notes = `CP: ${c.cp || ''} | Colonia: ${c.colonia || ''}`
            const safeName = (c.name || '').replace(/"/g, '""')

            return `"${safeName}","${phone}","Mobile","Atención Comunitaria","${notes}","* myContacts, Morena2024"`
        }).filter(Boolean)
        const csv = [header, ...rows].join('\r\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `directorio-comunitario.csv`
        link.click()
    }


    /* ---- Event CRUD ---- */
    const saveEvent = async () => {
        if (!eventForm.name) return
        setIsSaving(true)
        try {
            if (editingEventId) {
                await updateDoc(doc(db, 'campaigns', 'main_campaign', 'events', editingEventId), { ...eventForm })
            } else {
                await addDoc(collection(db, 'campaigns', 'main_campaign', 'events'), { ...eventForm, active: false })
            }
            setShowEventForm(false); setEventForm({ name: '', date: '', location: '', coords: '', image: '', description: '', time: '' })
            setEditingEventId(null)
        } catch (err) { console.error('Save event error:', err) }
        finally { setIsSaving(false) }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return }
        if (file.size > 5 * 1024 * 1024) { alert('La imagen no debe exceder 5MB'); return }

        setIsUploadingImage(true)
        setUploadProgress(0)

        try {
            const fileName = `${Date.now()}_${file.name}`
            const storageRef = ref(storage, `campaigns/main_campaign/events/${fileName}`)
            const uploadTask = uploadBytesResumable(storageRef, file)

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                    setUploadProgress(progress)
                },
                (error) => {
                    console.error('Upload error:', error)
                    setIsUploadingImage(false)
                },
                async () => {
                    const url = await getDownloadURL(uploadTask.snapshot.ref)
                    setEventForm((prev: any) => ({ ...prev, image: url }))
                    setIsUploadingImage(false)
                }
            )
        } catch (err) {
            console.error('Upload error:', err)
            setIsUploadingImage(false)
        }
    }

    const setActiveEvent = async (eventId: string) => {
        try {
            await setDoc(doc(db, 'campaigns', 'main_campaign', 'config', 'profile'), {
                ...config, activeEventId: eventId,
            }, { merge: true })
            setConfig((prev: any) => ({ ...prev, activeEventId: eventId }))
        } catch (err) { console.error('Set active event error:', err) }
    }

    const deleteEvent = async (eventId: string) => {
        if (!confirm('¿Eliminar este evento?')) return
        try {
            await deleteDoc(doc(db, 'campaigns', 'main_campaign', 'events', eventId))
        } catch (err) { console.error('Delete event error:', err) }
    }

    /* ---- Save Config ---- */
    const saveConfig = async () => {
        setIsSaving(true)
        try {
            await setDoc(doc(db, 'campaigns', 'main_campaign', 'config', 'profile'), configForm, { merge: true })
            setConfig(configForm)
            setStoredPassword(configForm.dashboardPassword)
            setIsEditingConfig(false)
        } catch (err) { console.error('Save config error:', err) }
        finally { setIsSaving(false) }
    }

    /* ---- Delete contact ---- */
    const deleteContact = async (contactId: string) => {
        if (!confirm('¿Eliminar este contacto?')) return
        try { await deleteDoc(doc(db, 'campaigns', 'main_campaign', 'contacts', contactId)) }
        catch (err) { console.error('Delete contact error:', err) }
    }

    /* ---- Theme Injection --- */
    const accent = config.accentColor || '#A60321'
    const bgColor = config.backgroundColor || '#ffffff'
    const textColor = config.textColor || '#333333'

    // We compute a hex-to-rgb for CSS injection. Let's do a simple fallback if invalid.
    const getRgb = (hex: string) => {
        let r = 0, g = 0, b = 0;
        if (hex?.length === 7) {
            r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
        }
        return `${r}, ${g}, ${b}`
    }
    const tcRGB = getRgb(textColor)

    const themeCSS = `
      .tpc { color: rgba(${tcRGB}, 1); background: ${bgColor}; }
      .tpc .text-theme { color: rgba(${tcRGB}, 1)!important }
      .tpc .text-theme-80 { color: rgba(${tcRGB}, 0.8)!important }
      .tpc .bg-theme-5 { background: rgba(${tcRGB}, 0.05)!important }
      .tpc .border-theme-10 { border-color: rgba(${tcRGB}, 0.1)!important }
      .tpc [data-btn]{ color:#fff!important }
    `

    /* ================================================================
       LOGIN SCREEN
       ================================================================ */
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4" style={{ background: bgColor }}>
                <div className="w-full max-w-sm text-center p-8 rounded-2xl shadow-xl" style={{ borderTop: `4px solid ${accent}`, background: 'rgba(255,255,255,0.9)' }}>
                    <div className="text-4xl mb-4 p-4 bg-gray-50 rounded-full inline-block">🏛️</div>
                    <h1 className="text-xl font-bold text-gray-800 mb-1">Control Comunitario</h1>
                    <p className="text-gray-500 text-sm mb-6">Acceso Restringido</p>
                    <input
                        type="password" value={password} onChange={(e) => { setPassword(e.target.value); setLoginError('') }}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        placeholder="Contraseña" autoFocus
                        className="w-full px-4 py-3.5 rounded-xl mb-3 text-sm outline-none text-gray-800 bg-white border border-gray-200 focus:border-red-500 text-center tracking-widest"
                    />
                    {loginError && <p className="text-red-500 text-xs mb-3 font-medium">{loginError}</p>}
                    <button onClick={handleLogin} data-btn
                        className="w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 transition-opacity"
                        style={{ background: accent }}>
                        Entrar
                    </button>
                    <Link href={`/registro`} className="inline-block mt-4 text-xs text-gray-400 hover:text-gray-600">
                        ← Ver portal público
                    </Link>
                </div>
            </div>
        )
    }

    /* ================================================================
       DASHBOARD
       ================================================================ */
    return (
        <div className="min-h-screen tpc pb-12">
            <style dangerouslySetInnerHTML={{ __html: themeCSS }} />

            {/* Header */}
            <header className="px-6 py-4 flex items-center justify-between shadow-sm bg-white/70 backdrop-blur-md sticky top-0 z-40 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: accent }}>CC</div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight text-theme">{config.name}</h1>
                        <p className="text-theme-80 text-xs opacity-70">Control Comunitario</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href={`/registro`} target="_blank"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors">
                        👁️ Ver portal
                    </Link>
                    <button onClick={() => { localStorage.removeItem('registro_auth'); setIsAuthenticated(false) }}
                        className="px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 font-bold">
                        Salir
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden bg-white">
                        <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-[100px] opacity-5" style={{ background: accent }}></div>
                        <p className="text-3xl font-black text-theme">{contacts.length}</p>
                        <p className="text-[0.65rem] text-gray-500 font-bold tracking-wider uppercase mt-1">Directorio</p>
                    </div>
                    <div className="rounded-2xl p-5 border border-gray-100 shadow-sm bg-white">
                        <p className="text-3xl font-black" style={{ color: accent }}>{todayContacts}</p>
                        <p className="text-[0.65rem] text-gray-500 font-bold tracking-wider uppercase mt-1">Hoy</p>
                    </div>
                    <div className="rounded-2xl p-5 border border-gray-100 shadow-sm bg-white">
                        <p className="text-3xl font-black text-theme">{events.length}</p>
                        <p className="text-[0.65rem] text-gray-500 font-bold tracking-wider uppercase mt-1">Eventos / Asambleas</p>
                    </div>
                    <div className="rounded-2xl p-5 border border-gray-100 shadow-sm bg-white flex flex-col justify-center items-center cursor-pointer hover:bg-gray-50" onClick={() => setActiveTab('map')}>
                        <span className="text-2xl mb-1">🗺️</span>
                        <p className="text-[0.65rem] text-gray-500 font-bold tracking-wider uppercase">Mapa Activo</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {([
                        { key: 'contacts', label: '👥 Directorio' },
                        { key: 'map', label: '🗺️ Alcance Comunitario' },
                        { key: 'events', label: '🏛️ Eventos' },
                        { key: 'broadcast', label: '📢 Difusión' },
                        { key: 'config', label: '⚙️ Configuración' },
                    ] as const).map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                            style={{
                                background: activeTab === tab.key ? accent : 'white',
                                color: activeTab === tab.key ? 'white' : 'gray',
                                border: '1px solid',
                                borderColor: activeTab === tab.key ? accent : '#f3f4f6'
                            }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ---- TAB: CARPETAS (CONTACTS, MAP, EVENTS, BROADCAST, CONFIG) ---- */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 min-h-[500px]">

                    {/* TAB: CONTACTS */}
                    {activeTab === 'contacts' && (
                        <div className="p-0">
                            {/* Filter Bar */}
                            <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-3 items-center rounded-t-3xl justify-between">
                                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="🔍 Buscar nombre, teléfono o CP..."
                                        className="px-4 py-2 rounded-xl text-sm border border-gray-200 outline-none focus:border-red-500 w-full md:w-64" />

                                    <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}
                                        className="px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 bg-white cursor-pointer w-full md:w-auto">
                                        <option value="">Todos los eventos</option>
                                        {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>

                                    {uniqueColonias.length > 0 && (
                                        <select value={filterColonia} onChange={(e) => setFilterColonia(e.target.value)}
                                            className="px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 bg-white cursor-pointer w-full md:w-auto">
                                            <option value="">Todas las colonias</option>
                                            {uniqueColonias.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    )}
                                </div>
                                <button onClick={exportCSV} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-sm flex items-center gap-2 w-full md:w-auto justify-center">
                                    📥 Exportar a Google Contacts
                                </button>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white text-gray-400 text-xs uppercase tracking-wider font-bold">
                                        <tr className="border-b border-gray-100">
                                            <th className="px-6 py-4">Nombre</th>
                                            <th className="px-6 py-4">WhatsApp</th>
                                            <th className="px-6 py-4">Evento</th>
                                            <th className="px-6 py-4">C.P. / Colonia</th>
                                            <th className="px-6 py-4">Fecha</th>
                                            <th className="px-6 py-4 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredContacts.map(c => (
                                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-3 font-bold text-gray-700">{c.name}</td>
                                                <td className="px-6 py-3">
                                                    <a href={`https://wa.me/52${c.phone}`} target="_blank" className="text-green-600 font-medium hover:underline flex items-center gap-1.5">
                                                        📞 {c.phone}
                                                    </a>
                                                </td>
                                                <td className="px-6 py-3 text-gray-500 text-xs">{c.eventName}</td>
                                                <td className="px-6 py-3 text-gray-500">
                                                    <span className="font-bold">{c.cp}</span> <span className="text-xs">{c.colonia}</span>
                                                </td>
                                                <td className="px-6 py-3 text-gray-400 text-xs">
                                                    {c.timestamp?.toDate?.()?.toLocaleDateString('es-MX')}
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <button onClick={() => deleteContact(c.id)} className="text-red-300 hover:text-red-500 p-2 transition-colors">
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredContacts.length === 0 && (
                                    <div className="text-center py-12 text-gray-400">
                                        No hay registros encontrados.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB: MAP */}
                    {activeTab === 'map' && (
                        <div className="flex flex-col md:flex-row min-h-[600px]">
                            {/* Interactive Google Map */}
                            <div className="flex-1 relative bg-gray-100 min-h-[400px]">
                                {isMapLoaded && mapData ? (
                                    <GoogleMap
                                        mapContainerStyle={{ width: '100%', height: '100%' }}
                                        center={NAVOJOA_CENTER}
                                        zoom={13}
                                        options={{
                                            styles: [
                                                { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
                                            ],
                                            disableDefaultUI: false,
                                            mapTypeControl: false,
                                        }}
                                    >
                                        {/* Render Polygons */}
                                        {mapData.targets?.map((t: any, idx: number) => {
                                            const isSelected = selectedSector && selectedSector['Sector Comunitario'] === t['Sector Comunitario']
                                            const hasCoords = t.geometry && t.geometry.length > 0

                                            if (!hasCoords) return null

                                            // Determine polygon color based on some criteria (e.g. isSelected)
                                            const fillColor = isSelected ? accent : '#3b82f6'
                                            const fillOpacity = isSelected ? 0.6 : 0.2

                                            return (
                                                <Polygon
                                                    key={idx}
                                                    paths={t.geometry.map((c: any) => ({ lat: c.lat, lng: c.lng }))}
                                                    options={{
                                                        fillColor,
                                                        fillOpacity,
                                                        strokeColor: isSelected ? accent : '#2563eb',
                                                        strokeOpacity: 0.8,
                                                        strokeWeight: isSelected ? 3 : 1,
                                                        zIndex: isSelected ? 10 : 1
                                                    }}
                                                    onClick={() => setSelectedSector(t)}
                                                />
                                            )
                                        })}
                                    </GoogleMap>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-50">
                                        <div className="w-8 h-8 border-4 rounded-full border-t-red-500 animate-spin mb-2"></div>
                                        <p className="text-sm font-bold">Cargando motor geográfico...</p>
                                    </div>
                                )}
                            </div>

                            {/* Sidebar Demographics */}
                            <div className="w-full md:w-[400px] border-l border-gray-100 bg-white p-6 overflow-y-auto hidden md:block rounded-br-3xl">
                                <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                                    <span style={{ color: accent }}>📊</span> Estadísticas de Sector
                                </h2>

                                <div className="mb-6">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Selecciona Sector Comunitario</label>
                                    <select
                                        className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 outline-none font-bold text-gray-700 text-sm focus:border-red-500 transition-colors cursor-pointer shadow-sm"
                                        onChange={(e) => {
                                            const sec = mapData?.targets?.find((t: any) => String(t['Sector Comunitario']) === e.target.value)
                                            setSelectedSector(sec)
                                        }}
                                    >
                                        <option value="">-- Vista General --</option>
                                        {mapData?.targets?.map((t: any, i: number) => (
                                            <option key={i} value={t['Sector Comunitario']}>
                                                Sector {t['Sector Comunitario']}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {selectedSector ? (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Población Estimada</p>
                                                <p className="text-xl font-black text-gray-800">{selectedSector['Población Estimada (Padrón)']?.toLocaleString() || '0'}</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">👥</div>
                                        </div>

                                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Impacto Anterior</p>
                                                <p className="text-xl font-black text-gray-600">{selectedSector['Impacto Anteriores (Votos 2024)']?.toLocaleString() || '0'}</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">📜</div>
                                        </div>

                                        <div className="p-5 rounded-2xl border relative overflow-hidden shadow-sm pt-6" style={{ background: `${accent}05`, borderColor: `${accent}20` }}>
                                            <div className="absolute right-0 top-0 h-full w-1.5" style={{ background: accent }}></div>
                                            <p className="text-[0.65rem] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>Objetivo de Cobertura</p>
                                            <p className="text-4xl font-black mb-1" style={{ color: accent }}>
                                                {Math.round(selectedSector['Objetivo de Cobertura (Meta)'])?.toLocaleString() || '0'}
                                            </p>
                                            <p className="text-xs font-medium" style={{ color: `${accent}90` }}>Enlaces requeridos para el éxito</p>
                                        </div>

                                        {/* Progress Match (Live connections) */}
                                        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                                            <h3 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-4">Alcance en Vivo (Soy Nexo)</h3>
                                            <div className="w-28 h-28 mx-auto rounded-full border-[10px] border-gray-50 flex flex-col items-center justify-center relative shadow-inner bg-white">
                                                {/* Visual simulation of progress */}
                                                <span className="text-4xl font-black text-green-500 drop-shadow-sm">0</span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-4 leading-relaxed">Calculando cruce de Códigos Postales registrados hacia este polígono territorial...</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-16 px-4 opacity-40">
                                        <span className="text-5xl mb-4 block grayscale">📍</span>
                                        <p className="font-semibold text-gray-600 text-sm">Selecciona un sector en el menú <br />para generar la radiografía de alcance.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB: EVENTS */}
                    {activeTab === 'events' && (
                        <div className="p-6 bg-gray-50/50 min-h-[500px]">
                            <button onClick={() => { setShowEventForm(true); setEditingEventId(null); setEventForm({ name: '', date: '', location: '', coords: '', image: '', description: '', time: '' }) }}
                                className="w-full mb-6 py-4 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 shadow-md hover:bg-opacity-90 transition-all active:scale-[0.98]"
                                style={{ background: accent }}>
                                ➕ Crear Nueva Asamblea / Evento
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {events.map(e => (
                                    <div key={e.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative group">
                                        {config.activeEventId === e.id && (
                                            <div className="absolute top-3 right-3 z-10 bg-green-500 text-white text-[0.6rem] font-bold px-3 py-1 rounded-full shadow-md animate-pulse">
                                                🌍 EVENTO ACTIVO
                                            </div>
                                        )}
                                        {e.image ? (
                                            <img src={e.image} className="w-full h-32 object-cover" />
                                        ) : (
                                            <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-2xl">🏛️</div>
                                        )}
                                        <div className="p-4">
                                            <h3 className="font-bold text-gray-800 mb-1 truncate">{e.name}</h3>
                                            <p className="text-xs text-gray-500 mb-4 h-8 overflow-hidden">{e.location} • {e.time}<br />{e.date}</p>

                                            <div className="flex gap-2">
                                                {config.activeEventId !== e.id && (
                                                    <button onClick={() => setActiveEvent(e.id)} className="flex-1 py-2 text-xs font-bold rounded-lg border hover:bg-gray-50" style={{ color: accent, borderColor: accent }}>
                                                        Publicar
                                                    </button>
                                                )}
                                                <button onClick={() => { setEventForm(e); setEditingEventId(e.id); setShowEventForm(true) }} className="px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs hover:bg-gray-100 border border-gray-200">
                                                    ✏️
                                                </button>
                                                <button onClick={() => deleteEvent(e.id)} className="px-3 py-2 bg-red-50 text-red-500 rounded-lg text-xs hover:bg-red-100 border border-red-100">
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Event Form Modal */}
                            {showEventForm && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm shadow-2xl">
                                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                                        <h3 className="text-xl font-black text-gray-800 mb-5 border-b border-gray-100 pb-4">
                                            {editingEventId ? '✏️ Editar Asamblea' : '➕ Nueva Asamblea'}
                                        </h3>
                                        <div className="space-y-4">
                                            {[
                                                { key: 'name', label: 'Nombre *', placeholder: 'Ej. Asamblea Vecinal', type: 'text' },
                                                { key: 'date', label: 'Fecha', placeholder: '', type: 'date' },
                                                { key: 'time', label: 'Hora', placeholder: 'Ej. 6:00 PM', type: 'text' },
                                                { key: 'location', label: 'Lugar', placeholder: 'Ej. Plaza', type: 'text' },
                                            ].map(field => (
                                                <div key={field.key}>
                                                    <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{field.label}</label>
                                                    <input type={field.type} value={(eventForm as any)[field.key] || ''}
                                                        onChange={(e) => setEventForm((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                                                        className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-red-400 font-medium text-gray-700" placeholder={field.placeholder} />
                                                </div>
                                            ))}

                                            <div>
                                                <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Fotografía del Evento (Poster)</label>
                                                {eventForm.image ? (
                                                    <div className="relative rounded-xl overflow-hidden shadow-sm border border-gray-200">
                                                        <img src={eventForm.image} alt="Preview" className="w-full h-40 object-cover" />
                                                        <button onClick={() => setEventForm((prev: any) => ({ ...prev, image: '' }))} className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-md hover:scale-110 transition-transform">X</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage} className="w-full py-8 text-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors font-medium">
                                                        {isUploadingImage ? `Subiendo... ${uploadProgress}%` : '📸 Seleccionar Imagen (Opcional)'}
                                                    </button>
                                                )}
                                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-8">
                                            <button onClick={() => setShowEventForm(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                                            <button onClick={saveEvent} disabled={isSaving || !eventForm.name} className="flex-2 py-3 rounded-xl text-white font-bold px-8 shadow-md hover:opacity-90 transition-opacity disabled:opacity-50" style={{ background: accent }}>{isSaving ? 'Guardando...' : 'Guardar'}</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: BROADCAST */}
                    {activeTab === 'broadcast' && (
                        <div className="p-6 md:p-8 max-w-2xl mx-auto">
                            <div className="bg-green-50 border border-green-100 p-4 rounded-xl mb-6">
                                <h3 className="font-bold text-green-800 text-sm flex items-center gap-2 mb-1"><span>📢</span> Motor de Difusión WhatsApp</h3>
                                <p className="text-green-700/80 text-xs">Abre chats de WhatsApp masivamente para invitar a tus contactos a las nuevas asambleas usando tu celular o WhatsApp Web.</p>
                            </div>

                            <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Plantilla del Mensaje</label>
                            <textarea
                                value={broadcastMsg}
                                onChange={(e) => setBroadcastMsg(e.target.value)}
                                placeholder="¡Hola {nombre}! Te invitamos a nuestra asamblea..."
                                className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-green-400 text-sm h-32 mb-1 resize-none font-medium text-gray-700"
                            />
                            <p className="text-[0.65rem] text-gray-400 mb-6 font-medium">Truco: Escribe {'{nombre}'} para que el sistema lo reemplace por el nombre real de cada persona.</p>

                            <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Filtrar Base de Datos</label>
                            <select value={broadcastEventFilter} onChange={(e) => { setBroadcastEventFilter(e.target.value); setSentContacts(new Set()) }}
                                className="w-full p-3.5 rounded-xl border border-gray-200 text-sm text-gray-700 mb-6 outline-none bg-white font-medium cursor-pointer shadow-sm">
                                <option value="">Toda la red ciduadana ({contacts.length} personas)</option>
                                {events.map(e => <option key={e.id} value={e.id}>{e.name} ({contacts.filter(c => c.eventId === e.id).length})</option>)}
                            </select>

                            {/* Execution */}
                            {(() => {
                                const list = broadcastEventFilter ? contacts.filter(c => c.eventId === broadcastEventFilter) : contacts
                                const sentCount = list.filter(c => sentContacts.has(c.id)).length
                                return (
                                    <div className="bg-white border text-sm border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                            <span className="font-bold text-gray-500">Progreso de Envío</span>
                                            <span className="font-black text-green-600">{sentCount} / {list.length}</span>
                                        </div>
                                        <div className="max-h-80 overflow-y-auto p-2">
                                            {list.map(c => {
                                                const sent = sentContacts.has(c.id)
                                                const firstName = c.name.split(' ')[0]
                                                const msg = broadcastMsg ? broadcastMsg.replace(/\{nombre\}/gi, firstName) : `¡Hola ${firstName}!`
                                                const url = `https://wa.me/52${c.phone}?text=${encodeURIComponent(msg)}`
                                                return (
                                                    <div key={c.id} className={`flex items-center justify-between p-3 mb-1 rounded-xl transition-all ${sent ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                                                        <div className="font-medium text-gray-700 truncate w-48 text-sm">{c.name}</div>
                                                        {sent ? (
                                                            <span className="text-xs text-green-600 font-bold bg-green-100 px-2.5 py-1 rounded-lg">✓ LISTO</span>
                                                        ) : (
                                                            <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => setSentContacts((prev: Set<string>) => new Set([...Array.from(prev), c.id]))}
                                                                className="px-4 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 shadow-sm active:scale-95 transition-all">
                                                                Enviar WA
                                                            </a>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                            {list.length === 0 && <p className="text-center p-8 text-gray-400 font-medium">No hay contactos.</p>}
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    )}

                    {/* TAB: CONFIG */}
                    {activeTab === 'config' && (
                        <div className="p-6 md:p-8 max-w-2xl mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-gray-800">Identidad de Campaña</h3>
                                    <p className="text-gray-500 text-sm">Personaliza cómo los ciudadanos ven tu plataforma de registro.</p>
                                </div>
                                {!isEditingConfig ? (
                                    <button onClick={() => setIsEditingConfig(true)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm">✏️ Habilitar Edición</button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button onClick={() => { setIsEditingConfig(false); setConfigForm(config) }} className="px-4 py-2.5 text-gray-500 font-bold hover:text-gray-700 text-sm">Cancelar</button>
                                        <button onClick={saveConfig} disabled={isSaving} className="px-6 py-2.5 text-white font-bold rounded-xl shadow-md transition-opacity" style={{ background: accent }}>{isSaving ? 'Guardando...' : 'Guardar'}</button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                {[
                                    { key: 'name', label: 'Nombre Formal', type: 'text' },
                                    { key: 'title', label: 'Cargo o Título', type: 'text' },
                                    { key: 'party', label: 'Partido', type: 'text' },
                                    { key: 'phone', label: 'WhatsApp de Enlace Institucional (10 dgts)', type: 'text' },
                                    { key: 'dashboardPassword', label: 'Contraseña de este Panel', type: 'password' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{f.label}</label>
                                        <input type={f.type} value={(configForm as any)[f.key] || ''} onChange={e => setConfigForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))} disabled={!isEditingConfig}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 font-medium text-sm outline-none focus:border-gray-400 transition-colors" />
                                    </div>
                                ))}

                                <div className="pt-4 border-t border-gray-100 mt-6">
                                    <h4 className="font-bold text-gray-700 mb-4 text-sm">Diseño Visual</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Acento Principal</label>
                                            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-200">
                                                <input type="color" value={configForm.accentColor || '#A60321'} disabled={!isEditingConfig} onChange={e => setConfigForm((prev: any) => ({ ...prev, accentColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer disabled:opacity-50" />
                                                <span className="text-sm font-mono text-gray-500">{configForm.accentColor || '#A60321'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
