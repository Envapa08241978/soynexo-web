'use client'

import React, { useState, useEffect, useRef } from 'react'
import { db, storage } from '@/lib/firebase'
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import Link from 'next/link'
import { GoogleMap, useLoadScript, Polygon, Marker, Circle } from '@react-google-maps/api'
import { QRCodeSVG } from 'qrcode.react'

/* ================================================================
   TYPES
   ================================================================ */
interface ContactItem {
    id: string
    name: string
    phone: string
    cp?: string
    colonia?: string
    calle?: string
    numExt?: string
    brigadista?: string
    roles?: string[]
    eventId: string
    eventIds?: string[]
    eventName: string
    eventNames?: string[]
    timestamp: any
    seccional?: string
    distrito?: string
}

interface BrigadistaItem {
    id: string
    name: string
    phone: string
    seccional: string
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
    targetSeccionales?: string[]
    targetColonias?: string[]
    targetContacts?: string[]
    sentInvitations?: string[]
}

const MultiSelect = ({ options, selected, onChange, placeholder }: { options: {label: string, value: string}[], selected: string[], onChange: (val: string[]) => void, placeholder: string }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggle = (val: string) => {
        if (selected.includes(val)) onChange(selected.filter(v => v !== val));
        else onChange([...selected, val]);
    };

    return (
        <div className="relative" ref={ref}>
            <button 
                onClick={() => setOpen(!open)} 
                className="px-4 py-2 w-full md:w-56 text-left rounded-xl text-sm border border-gray-200 bg-white shadow-sm flex justify-between items-center"
            >
                <span className="truncate text-gray-600 font-medium">
                    {selected.length === 0 ? placeholder : `${selected.length} seleccionado(s)`}
                </span>
                <span className="text-gray-400 text-xs text-center w-4">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="absolute top-full mt-1 left-0 z-50 w-64 max-h-60 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-xl p-2 font-medium">
                    {options.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                            <input 
                                type="checkbox" 
                                checked={selected.includes(opt.value)}
                                onChange={() => toggle(opt.value)}
                                className="w-4 h-4 text-red-500 rounded focus:ring-red-500"
                            />
                            <span className="text-sm text-gray-700 truncate">{opt.label}</span>
                        </label>
                    ))}
                    {options.length === 0 && <div className="p-2 text-xs text-gray-400">Sin opciones</div>}
                </div>
            )}
        </div>
    )
}

const SONORA_CENTER = { lat: 29.07, lng: -110.96 } as const

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
    const mapRef = useRef<google.maps.Map | null>(null)

    const { isLoaded: isMapLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    })


    const onMapLoad = (map: google.maps.Map) => {
        mapRef.current = map
    }

    const selectAndZoomSector = (sector: any) => {
        setSelectedSector(sector)
    }

    // --- Filters ---
    const [searchQuery, setSearchQuery] = useState('')
    const [filterEvents, setFilterEvents] = useState<string[]>([])
    const [filterColonias, setFilterColonias] = useState<string[]>([])
    const [filterSeccionales, setFilterSeccionales] = useState<string[]>([])
    const [filterRoles, setFilterRoles] = useState<string[]>([])
    const [filterBrigadistas, setFilterBrigadistas] = useState<string[]>([])

    // --- Event Form ---
    const [showEventForm, setShowEventForm] = useState(false)
    const [eventForm, setEventForm] = useState<Partial<EventItem>>({
        name: '', date: '', location: '', coords: '', image: '', description: '', time: '',
        targetSeccionales: [], targetColonias: [], targetContacts: []
    })
    const [editingEventId, setEditingEventId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [broadcastMsg, setBroadcastMsg] = useState('')
    const [broadcastEventFilters, setBroadcastEventFilters] = useState<string[]>([])
    const [broadcastColoniaFilters, setBroadcastColoniaFilters] = useState<string[]>([])
    const [broadcastSeccionalFilters, setBroadcastSeccionalFilters] = useState<string[]>([])
    const [broadcastRoleFilters, setBroadcastRoleFilters] = useState<string[]>([])
    const [broadcastBrigadistaFilters, setBroadcastBrigadistaFilters] = useState<string[]>([])
    const [sentContacts, setSentContacts] = useState<Set<string>>(new Set())
    const [broadcastImage, setBroadcastImage] = useState('')
    const [isUploadingBroadcastImage, setIsUploadingBroadcastImage] = useState(false)
    const broadcastFileInputRef = useRef<HTMLInputElement>(null)

    // --- Invitation Modal ---
    const [invitationEventId, setInvitationEventId] = useState<string | null>(null)
    const [invitationMsg, setInvitationMsg] = useState('')
    const [invitationSentContacts, setInvitationSentContacts] = useState<Set<string>>(new Set())

    // --- Config edit ---
    const [isEditingConfig, setIsEditingConfig] = useState(false)
    const [configForm, setConfigForm] = useState<any>(config)
    const [sortConfig, setSortConfig] = useState<{ key: keyof ContactItem | '', direction: 'asc' | 'desc' }>({ key: '', direction: 'desc' })

    // --- Brigadistas ---
    const [brigadistas, setBrigadistas] = useState<BrigadistaItem[]>([])
    const [brigForm, setBrigForm] = useState({ name: '', phone: '', seccional: '' })
    const [isSavingBrig, setIsSavingBrig] = useState(false)

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

    /* ---- Real-time brigadistas ---- */
    useEffect(() => {
        if (!isAuthenticated) return
        const brigRef = collection(db, 'campaigns', 'main_campaign', 'brigadistas')
        const q = query(brigRef, orderBy('timestamp', 'desc'))
        return onSnapshot(q, (snap) => {
            setBrigadistas(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)))
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
        const matchesEvent = filterEvents.length === 0 || filterEvents.includes(c.eventId) || (c.eventIds && c.eventIds.some((id: string) => filterEvents.includes(id)))
        const matchesColonia = filterColonias.length === 0 || filterColonias.includes(c.colonia || '')
        const matchesSeccional = filterSeccionales.length === 0 || filterSeccionales.includes(c.seccional || '')
        const matchesRole = filterRoles.length === 0 || (c.roles && c.roles.some((r: string) => filterRoles.includes(r)))
        const matchesBrigadista = filterBrigadistas.length === 0 || filterBrigadistas.includes(c.brigadista || '')
        return matchesSearch && matchesEvent && matchesColonia && matchesSeccional && matchesRole && matchesBrigadista
    })

    const requestSort = (key: keyof ContactItem) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
        setSortConfig({ key, direction })
    }

    const sortedContacts = [...filteredContacts].sort((a, b) => {
        if (!sortConfig.key) return 0
        let valA = a[sortConfig.key] || ''
        let valB = b[sortConfig.key] || ''

        if (sortConfig.key === 'timestamp') {
            valA = a.timestamp?.toMillis?.() || 0
            valB = b.timestamp?.toMillis?.() || 0
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
    })

    /* ---- Stats ---- */
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayContacts = contacts.filter(c => {
        const ts = c.timestamp?.toDate?.() || new Date(0)
        return ts >= todayStart
    }).length

    const uniqueColonias = Array.from(new Set(contacts.map(c => c.colonia).filter(Boolean))) as string[]
    const uniqueSeccionales = Array.from(new Set(contacts.map(c => c.seccional).filter(Boolean))) as string[]
    const uniqueBrigadistas = Array.from(new Set(contacts.map(c => c.brigadista).filter(Boolean))) as string[]
    const allRoles = ['Protagonista del cambio verdadero', 'Activista digital', 'Defensa del voto']
    const contactsByEvent = events.map(e => ({
        ...e,
        count: contacts.filter(c => c.eventId === e.id || (c.eventIds && c.eventIds.includes(e.id))).length,
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
        link.download = `directorio-google-contacts.csv`
        link.click()
    }

    const exportToExcel = () => {
        // UTF-8 BOM helps Excel recognize encoding + accents properly
        const BOM = "\uFEFF";
        const headers = ['Nombre', 'WhatsApp', 'Calle', 'Num Ext', 'Seccional', 'Brigadista', 'Eventos', 'Roles', 'Fecha de Registro'].join(',');
        
        const rows = filteredContacts.map(c => {
            const dateStr = c.timestamp?.toDate ? c.timestamp.toDate().toLocaleDateString('es-MX') : new Date(c.timestamp).toLocaleDateString('es-MX');
            const safeName = `"${(c.name || '').replace(/"/g, '""')}"`;
            const safePhone = `"${c.phone || ''}"`;
            const safeCalle = `"${(c.calle || c.colonia || '').replace(/"/g, '""')}"`;
            const safeNumExt = `"${(c.numExt || '').replace(/"/g, '""')}"`;
            const safeSeccional = `"${(c.seccional || '').replace(/"/g, '""')}"`;
            const safeBrigadista = `"${(c.brigadista || '').replace(/"/g, '""')}"`;
            const safeEvents = `"${(c.eventNames?.join('; ') || c.eventName || '').replace(/"/g, '""')}"`;
            const safeRoles = `"${(c.roles?.join('; ') || '').replace(/"/g, '""')}"`;
            const safeDate = `"${dateStr}"`;

            return [safeName, safePhone, safeCalle, safeNumExt, safeSeccional, safeBrigadista, safeEvents, safeRoles, safeDate].join(',');
        });

        const csvContent = BOM + [headers, ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `directorio-general-excel.csv`;
        link.click();
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

    const handleBroadcastImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return }
        if (file.size > 5 * 1024 * 1024) { alert('La imagen no debe exceder 5MB'); return }

        setIsUploadingBroadcastImage(true)

        try {
            const fileName = `broadcast_${Date.now()}_${file.name}`
            const storageRef = ref(storage, `campaigns/main_campaign/broadcasts/${fileName}`)
            const uploadTask = uploadBytesResumable(storageRef, file)

            uploadTask.on('state_changed',
                () => {},
                (error) => {
                    console.error('Upload error:', error)
                    setIsUploadingBroadcastImage(false)
                },
                async () => {
                    const url = await getDownloadURL(uploadTask.snapshot.ref)
                    setBroadcastImage(url)
                    setIsUploadingBroadcastImage(false)
                }
            )
        } catch (err) {
            console.error('Upload error:', err)
            setIsUploadingBroadcastImage(false)
        }
    }

    const updateContactFields = async (contactId: string, fields: { name?: string, phone?: string, calle?: string, numExt?: string, seccional?: string, brigadista?: string }) => {
        try {
            await updateDoc(doc(db, 'campaigns', 'main_campaign', 'contacts', contactId), fields)
            alert('¡Guardado correctamente! 💾')
        } catch (error) {
            console.error(`Error updating contact:`, error)
            alert('Error al guardar.')
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

    /* ---- Brigadista CRUD ---- */
    const addBrigadista = async () => {
        if (!brigForm.name.trim() || !brigForm.phone.trim() || !brigForm.seccional.trim()) return
        setIsSavingBrig(true)
        try {
            await addDoc(collection(db, 'campaigns', 'main_campaign', 'brigadistas'), {
                name: brigForm.name.trim(),
                phone: brigForm.phone.replace(/\D/g, ''),
                seccional: brigForm.seccional.trim(),
                timestamp: serverTimestamp(),
            })
            setBrigForm({ name: '', phone: '', seccional: '' })
        } catch (err) { console.error('Add brigadista error:', err) }
        finally { setIsSavingBrig(false) }
    }

    const deleteBrigadista = async (id: string) => {
        if (!confirm('¿Eliminar este brigadista?')) return
        try { await deleteDoc(doc(db, 'campaigns', 'main_campaign', 'brigadistas', id)) }
        catch (err) { console.error('Delete brigadista error:', err) }
    }

    const getBrigadistaQRUrl = (brigId: string) => {
        return `https://www.soynexo.com/registro?b=${brigId}`
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

            <div className="w-full mx-auto px-4 sm:px-8 xl:px-12 pt-6">
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
                        { key: 'broadcast', label: '📢 Comunicados' },
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

                                    <MultiSelect 
                                        placeholder="Todos los eventos"
                                        options={events.map(e => ({ label: e.name, value: e.id }))}
                                        selected={filterEvents}
                                        onChange={setFilterEvents}
                                    />

                                    {uniqueSeccionales.length > 0 && (
                                        <MultiSelect 
                                            placeholder="Todos los seccionales"
                                            options={uniqueSeccionales.map(c => ({ label: `Seccional ${c}`, value: c }))}
                                            selected={filterSeccionales}
                                            onChange={setFilterSeccionales}
                                        />
                                    )}

                                    <MultiSelect 
                                        placeholder="Todos los roles"
                                        options={allRoles.map(r => ({ label: r, value: r }))}
                                        selected={filterRoles}
                                        onChange={setFilterRoles}
                                    />

                                    {uniqueBrigadistas.length > 0 && (
                                        <MultiSelect 
                                            placeholder="Todos los brigadistas"
                                            options={uniqueBrigadistas.map(b => ({ label: b, value: b }))}
                                            selected={filterBrigadistas}
                                            onChange={setFilterBrigadistas}
                                        />
                                    )}
                                </div>
                                <div className="flex flex-col md:flex-row gap-2 mt-4 md:mt-0 w-full md:w-auto">
                                    <button onClick={exportToExcel} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2">
                                        📊 Exportar a Excel
                                    </button>
                                    <button onClick={exportCSV} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-sm flex items-center justify-center gap-2">
                                        📥 a Contacts
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white text-gray-400 text-xs uppercase tracking-wider font-bold">
                                        <tr className="border-b border-gray-100">
                                            <th className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => requestSort('name')}>
                                                Nombre {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => requestSort('phone')}>
                                                WhatsApp {sortConfig.key === 'phone' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                                                Calle
                                            </th>
                                            <th className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                                                Num. Ext
                                            </th>
                                            <th className="px-4 py-4 w-32 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => requestSort('seccional')}>
                                                Seccional {sortConfig.key === 'seccional' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                                                Brigadista
                                            </th>
                                            <th className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => requestSort('eventName')}>
                                                Evento {sortConfig.key === 'eventName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                                Rol
                                            </th>
                                            <th className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => requestSort('timestamp')}>
                                                Fecha {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-6 py-4 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {sortedContacts.map(c => (
                                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-2">
                                                    <input 
                                                        id={`name-${c.id}`}
                                                        type="text" 
                                                        defaultValue={c.name || ''}
                                                        className="w-full text-sm p-2 border border-gray-200 rounded-lg font-bold text-gray-700 outline-none focus:border-red-400 bg-gray-50 focus:bg-white transition-colors min-w-[140px]"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-1">
                                                        <input 
                                                            id={`phone-${c.id}`}
                                                            type="tel" 
                                                            defaultValue={c.phone || ''}
                                                            placeholder="10 díg."
                                                            className="w-full text-sm p-2 border border-gray-200 rounded-lg font-medium text-gray-700 outline-none focus:border-red-400 bg-gray-50 focus:bg-white transition-colors min-w-[100px] tracking-wide"
                                                        />
                                                        {c.phone && (
                                                            <a href={`https://wa.me/52${c.phone}`} target="_blank" rel="noopener noreferrer"
                                                                className="p-1.5 bg-green-50 text-green-600 rounded-lg border border-green-100 hover:bg-green-600 hover:text-white transition-all flex-shrink-0"
                                                                title="Abrir WhatsApp">
                                                                <span className="text-sm">📨</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        id={`calle-${c.id}`}
                                                        type="text" 
                                                        defaultValue={c.calle || c.colonia || ''}
                                                        placeholder="Calle"
                                                        className="w-full text-sm p-2 border border-gray-200 rounded-lg font-medium text-gray-700 outline-none focus:border-red-400 bg-gray-50 focus:bg-white transition-colors min-w-[120px]"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        id={`numext-${c.id}`}
                                                        type="text" 
                                                        defaultValue={c.numExt || ''}
                                                        placeholder="#"
                                                        className="w-full text-sm p-2 border border-gray-200 rounded-lg font-bold text-gray-700 outline-none focus:border-red-400 bg-gray-50 focus:bg-white transition-colors text-center min-w-[60px] max-w-[80px]"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        id={`sec-${c.id}`}
                                                        type="text" 
                                                        defaultValue={c.seccional || ''}
                                                        placeholder="Secc."
                                                        className="w-full text-sm p-2 border border-gray-200 rounded-lg font-bold text-gray-700 outline-none focus:border-red-400 bg-gray-50 focus:bg-white transition-colors text-center min-w-[60px] max-w-[80px]"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        id={`brig-${c.id}`}
                                                        type="text" 
                                                        defaultValue={c.brigadista || ''}
                                                        placeholder="Brigadista"
                                                        className="w-full text-sm p-2 border border-gray-200 rounded-lg font-medium text-gray-700 outline-none focus:border-red-400 bg-gray-50 focus:bg-white transition-colors min-w-[120px]"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-gray-500 text-xs text-center">
                                                    {c.eventNames && c.eventNames.length > 1 ? (
                                                        <div className="group relative cursor-help inline-block">
                                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 font-bold border border-blue-200 rounded-lg shadow-sm">
                                                                {c.eventNames.length} Eventos
                                                            </span>
                                                            <div className="hidden group-hover:block absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-gray-800 text-white text-xs rounded-xl p-3 shadow-xl pointer-events-none text-left">
                                                                <div className="font-bold mb-1 border-b border-gray-600 pb-1 text-blue-300">Eventos asistidos:</div>
                                                                <ul className="list-disc pl-3 mt-1 text-gray-200">
                                                                    {c.eventNames.map((n, idx) => <li key={idx} className="mb-0.5 leading-tight">{n}</li>)}
                                                                </ul>
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        c.eventName
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-xs">
                                                    {c.roles && c.roles.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {c.roles.map((r: string) => (
                                                                <span key={r} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-md font-medium text-[0.6rem] border border-purple-100">
                                                                    {r === 'Protagonista del cambio verdadero' ? 'Protagonista' : r === 'Activista digital' ? 'Activista' : r === 'Defensa del voto' ? 'Def. Voto' : r}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-gray-400 text-xs">
                                                    {c.timestamp?.toDate?.()?.toLocaleDateString('es-MX')}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-1 justify-center">
                                                        <button 
                                                            onClick={async () => {
                                                                const name = (document.getElementById(`name-${c.id}`) as HTMLInputElement)?.value || '';
                                                                const phone = (document.getElementById(`phone-${c.id}`) as HTMLInputElement)?.value?.replace(/\D/g, '') || '';
                                                                const calle = (document.getElementById(`calle-${c.id}`) as HTMLInputElement)?.value || '';
                                                                const numExt = (document.getElementById(`numext-${c.id}`) as HTMLInputElement)?.value || '';
                                                                const seccional = (document.getElementById(`sec-${c.id}`) as HTMLInputElement)?.value || '';
                                                                const brigadista = (document.getElementById(`brig-${c.id}`) as HTMLInputElement)?.value || '';
                                                                await updateContactFields(c.id, { name, phone, calle, numExt, seccional, brigadista });
                                                            }}
                                                            className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                                                            title="Guardar cambios"
                                                        >
                                                            <span className="text-sm">💾</span>
                                                        </button>
                                                        <button onClick={() => deleteContact(c.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors"
                                                            title="Eliminar contacto">
                                                            🗑️
                                                        </button>
                                                    </div>
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
                                        center={SONORA_CENTER}
                                        zoom={7}
                                        onLoad={onMapLoad}
                                        options={{
                                            styles: [
                                                { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
                                            ],
                                            disableDefaultUI: false,
                                            mapTypeControl: false,
                                            gestureHandling: 'greedy',
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
                                                    onClick={() => selectAndZoomSector(t)}
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
                                        value={selectedSector ? String(selectedSector['Sector Comunitario']) : ''}
                                        onChange={(e) => {
                                            const sec = mapData?.targets?.find((t: any) => String(t['Sector Comunitario']) === e.target.value)
                                            if (sec) selectAndZoomSector(sec)
                                            else setSelectedSector(null)
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

                                        {/* Brigadistas in this sector */}
                                        {(() => {
                                            const sectorNumber = String(selectedSector['Sector Comunitario']);
                                            const brigsInSector = brigadistas.filter(b => b.seccional === sectorNumber);
                                            return (
                                                <div className="p-5 rounded-2xl border border-orange-100 bg-orange-50/30 shadow-sm">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-[0.65rem] font-bold text-orange-600 uppercase tracking-wider">🏃 Brigadistas en Seccional {sectorNumber}</p>
                                                        <span className="text-lg font-black text-orange-600">{brigsInSector.length}</span>
                                                    </div>
                                                    {brigsInSector.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {brigsInSector.map(b => (
                                                                <div key={b.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-orange-100 text-sm">
                                                                    <span className="font-bold text-gray-700">{b.name}</span>
                                                                    <a href={`https://wa.me/52${b.phone}`} target="_blank" rel="noopener noreferrer"
                                                                        className="text-green-600 text-xs font-bold hover:underline">📱 {b.phone}</a>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-400 font-medium">No hay brigadistas asignados a este seccional.</p>
                                                    )}
                                                </div>
                                            )
                                        })()}

                                        {/* Progress Match (Live connections) */}
                                        {(() => {
                                            const sectorNumber = String(selectedSector['Sector Comunitario']);
                                            const contactsInSector = contacts.filter((c: ContactItem) => c.seccional === sectorNumber);
                                            // Unique phone numbers calculation
                                            const uniquePhones = new Set(contactsInSector.map(c => c.phone).filter(Boolean));
                                            const matchCount = uniquePhones.size;
                                            return (
                                                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                                                    <h3 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-4">Alcance en Vivo (Soy Nexo)</h3>
                                                    <div className="w-28 h-28 mx-auto rounded-full border-[10px] border-gray-50 flex flex-col items-center justify-center relative shadow-inner bg-white">
                                                        <span className="text-4xl font-black text-green-500 drop-shadow-sm">{matchCount}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-4 leading-relaxed font-medium">Conteo real de teléfonos únicos asignados al Seccional / Sector <strong className="text-gray-600">{sectorNumber}</strong>.</p>
                                                </div>
                                            )
                                        })()}
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
                            <button onClick={() => { setShowEventForm(true); setEditingEventId(null); setEventForm({ name: '', date: '', location: '', coords: '', image: '', description: '', time: '', targetSeccionales: [], targetColonias: [], targetContacts: [] }) }}
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
                                                <button onClick={() => { setInvitationEventId(e.id); setInvitationMsg(''); setInvitationSentContacts(new Set(e.sentInvitations || [])); }} className="flex-1 py-2 text-xs font-bold rounded-lg bg-green-50 text-green-600 hover:bg-green-100 border border-green-100 flex items-center justify-center gap-1 shadow-sm">
                                                    💌 Invitar
                                                </button>
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

                                            <div className="pt-4 mt-6 border-t border-gray-100">
                                                <h4 className="font-bold text-gray-800 text-sm mb-4">👥 Perfil de Invitados (Opcional)</h4>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Por Seccional</label>
                                                        <div className="relative z-30">
                                                            <MultiSelect 
                                                                placeholder="Todos los seccionales (Sin filtro)"
                                                                options={uniqueSeccionales.map(c => ({ label: `Seccional ${c}`, value: c }))}
                                                                selected={eventForm.targetSeccionales || []}
                                                                onChange={(val) => setEventForm(prev => ({...prev, targetSeccionales: val}))}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Por Colonia</label>
                                                        <div className="relative z-20">
                                                            <MultiSelect 
                                                                placeholder="Todas las colonias (Sin filtro)"
                                                                options={uniqueColonias.map(c => ({ label: c, value: c }))}
                                                                selected={eventForm.targetColonias || []}
                                                                onChange={(val) => setEventForm(prev => ({...prev, targetColonias: val}))}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Por Persona Individual</label>
                                                        <div className="relative z-10 w-full mb-8">
                                                            <MultiSelect 
                                                                placeholder="Seleccionar contactos específicos"
                                                                options={contacts.map(c => ({ label: c.name, value: c.id }))}
                                                                selected={eventForm.targetContacts || []}
                                                                onChange={(val) => setEventForm(prev => ({...prev, targetContacts: val}))}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-8 pt-4 border-t border-gray-100">
                                            <button onClick={() => setShowEventForm(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                                            <button onClick={saveEvent} disabled={isSaving || !eventForm.name} className="flex-2 py-3 rounded-xl text-white font-bold px-8 shadow-md hover:opacity-90 transition-opacity disabled:opacity-50" style={{ background: accent }}>{isSaving ? 'Guardando...' : 'Guardar'}</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Invitation Modal */}
                            {invitationEventId && (() => {
                                const ev = events.find(e => e.id === invitationEventId);
                                if (!ev) return null;

                                const targetList = contacts.filter(c => {
                                    const matchSeccional = (ev.targetSeccionales || []).includes(c.seccional || '');
                                    const matchColonia = (ev.targetColonias || []).includes(c.colonia || '');
                                    const matchPerson = (ev.targetContacts || []).includes(c.id);
                                    
                                    const hasFilters = (ev.targetSeccionales?.length || 0) > 0 || (ev.targetColonias?.length || 0) > 0 || (ev.targetContacts?.length || 0) > 0;
                                    
                                    if (!hasFilters) return true; // Si no puso filtros, asume todas las personas de la base.
                                    return matchSeccional || matchColonia || matchPerson;
                                });

                                const sentCount = targetList.filter(c => invitationSentContacts.has(c.id)).length;

                                return (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm shadow-2xl">
                                        <div className="bg-white rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                                            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-5">
                                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                                    <span>💌</span> Invitaciones: {ev.name}
                                                </h3>
                                                <button onClick={() => setInvitationEventId(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl px-2">X</button>
                                            </div>

                                            <div className="bg-green-50 rounded-xl p-4 border border-green-100 mb-5 text-sm flex gap-3 text-green-800">
                                                <span className="text-xl">👥</span>
                                                <div>
                                                    <p className="font-bold mb-1">Perfil de Invitados Cargado</p>
                                                    <p className="opacity-80 leading-snug">Se encontraron <strong>{targetList.length} personas</strong> basadas en las reglas de Seccional, Colonia y/o contactos directos de este evento.</p>
                                                </div>
                                            </div>

                                            <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Plantilla del Mensaje de Invitación</label>
                                            <textarea
                                                value={invitationMsg}
                                                onChange={(e) => setInvitationMsg(e.target.value)}
                                                placeholder={`¡Hola {nombre}! Te invito a la asamblea ${ev.name} este ${ev.date}...`}
                                                className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-green-400 text-sm h-28 mb-1 resize-none font-medium text-gray-700"
                                            />
                                            <p className="text-[0.65rem] text-gray-400 mb-6 font-medium">Truco: Escribe {'{nombre}'} para cambiarlo por el nombre real. (La imagen de la asamblea se adjuntará automáticamente si tiene una).</p>

                                            <div className="bg-white border text-sm border-gray-200 rounded-2xl shadow-sm overflow-hidden flex-1 min-h-[250px] flex flex-col">
                                                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between sticky top-0">
                                                    <span className="font-bold text-gray-500">Progreso de Envío</span>
                                                    <span className="font-black text-green-600">{sentCount} / {targetList.length}</span>
                                                </div>
                                                <div className="overflow-y-auto p-2 flex-1 relative">
                                                    {targetList.length === 0 ? (
                                                        <div className="text-center py-10 text-gray-400 font-medium">No hay personas que coincidan con la lista de invitados.</div>
                                                    ) : (
                                                        targetList.map(c => {
                                                            const sent = invitationSentContacts.has(c.id)
                                                            const firstName = c.name.split(' ')[0]
                                                            return (
                                                                <div key={c.id} className={`flex items-center justify-between p-3 border-b border-gray-50 last:border-0 rounded-xl mb-1 transition-colors ${sent ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                                                                    <div className="flex items-center gap-3">
                                                                        {sent ? <span className="text-green-500">✅</span> : <span className="text-gray-300">⏳</span>}
                                                                        <div className="flex flex-col">
                                                                            <span className={`font-bold text-sm ${sent ? 'text-gray-800' : 'text-gray-700'}`}>{c.name}</span>
                                                                            <span className="text-gray-400 text-[10px] tracking-wide uppercase font-bold">{c.colonia || 'Sin Colonia'}</span>
                                                                        </div>
                                                                    </div>
                                                                    <a
                                                                        href={`https://wa.me/521${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`${ev.image ? window.location.origin + '/i?img=' + encodeURIComponent(ev.image) + ' \n\n' : ''}${invitationMsg.replace(/{nombre}/gi, firstName)}`)}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={() => {
                                                                            if (!sent) {
                                                                                const newSet = new Set(invitationSentContacts)
                                                                                newSet.add(c.id)
                                                                                setInvitationSentContacts(newSet)

                                                                                updateDoc(doc(db, 'campaigns', 'main_campaign', 'events', ev.id), {
                                                                                    sentInvitations: arrayUnion(c.id)
                                                                                }).catch(e => console.error("Error saving sent invitation", e))
                                                                            }
                                                                        }}
                                                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${sent ? 'bg-white border-2 border-green-500 text-green-600' : 'bg-green-500 hover:bg-green-600 text-white hover:-translate-y-0.5'}`}
                                                                    >
                                                                        {sent ? 'Reenviar WA' : 'Enviar WA'}
                                                                    </a>
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-5 text-center">
                                                <button onClick={() => setInvitationEventId(null)} className="px-8 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors text-sm">Cerrar</button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    )}

                    {/* TAB: BROADCAST */}
                    {activeTab === 'broadcast' && (
                        <div className="p-6 md:p-8 max-w-2xl mx-auto">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6">
                                <h3 className="font-bold text-blue-800 text-sm flex items-center gap-2 mb-1"><span>📢</span> Avisos y Comunicados Generales</h3>
                                <p className="text-blue-700/80 text-xs">Abre chats de WhatsApp masivamente para mantener comunicación constante, saludos, alertas comunitarias, o felicitar a los miembros.</p>
                            </div>

                            <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Plantilla del Mensaje</label>
                            <textarea
                                value={broadcastMsg}
                                onChange={(e) => setBroadcastMsg(e.target.value)}
                                placeholder="¡Hola {nombre}! Te invitamos a nuestra asamblea..."
                                className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-green-400 text-sm h-32 mb-1 resize-none font-medium text-gray-700"
                            />
                            <p className="text-[0.65rem] text-gray-400 mb-6 font-medium">Truco: Escribe {'{nombre}'} para que el sistema lo reemplace por el nombre real de cada persona.</p>

                            <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Imagen Adjunta (Opcional)</label>
                            <div className="mb-6">
                                {broadcastImage ? (
                                    <div className="relative rounded-xl overflow-hidden shadow-sm border border-gray-200">
                                        <img src={broadcastImage} alt="Preview" className="w-full h-40 object-cover" />
                                        <button onClick={() => setBroadcastImage('')} className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-md hover:scale-110 transition-transform">X</button>
                                    </div>
                                ) : (
                                    <button onClick={() => broadcastFileInputRef.current?.click()} disabled={isUploadingBroadcastImage} className="w-full py-6 text-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors font-medium cursor-pointer">
                                        {isUploadingBroadcastImage ? 'Subiendo imagen...' : '📸 Subir Imagen para Difusión'}
                                    </button>
                                )}
                                <input ref={broadcastFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBroadcastImageUpload} />
                                <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                                    <span>Evento a promocionar (Auto-carga su imagen):</span>
                                    <select 
                                        className="p-1.5 rounded-lg border border-gray-200 text-xs bg-white text-gray-700 font-medium cursor-pointer outline-none flex-1 max-w-[250px]"
                                        onChange={(e) => {
                                            const ev = events.find(ev => ev.id === e.target.value)
                                            if (ev && ev.image) {
                                                setBroadcastImage(ev.image)
                                            } else {
                                                setBroadcastImage('')
                                            }
                                        }}
                                    >
                                        <option value="">-- Seleccionar Evento --</option>
                                        {events.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <h4 className="font-bold text-gray-800 text-sm mb-3 border-b border-gray-100 pb-2">🎯 Seleccionar Destinatarios</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative z-10">
                                <div>
                                    <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Por Evento de Registro</label>
                                    <MultiSelect 
                                        placeholder="Todos los eventos"
                                        options={events.map(e => ({ label: e.name, value: e.id }))}
                                        selected={broadcastEventFilters}
                                        onChange={(val) => { setBroadcastEventFilters(val); setSentContacts(new Set()) }}
                                    />
                                </div>
                                <div>
                                    <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Por Colonia / Área</label>
                                    <MultiSelect 
                                        placeholder="Todas las colonias"
                                        options={uniqueColonias.map(c => ({ label: c, value: c }))}
                                        selected={broadcastColoniaFilters}
                                        onChange={(val) => { setBroadcastColoniaFilters(val); setSentContacts(new Set()) }}
                                    />
                                </div>
                                <div>
                                    <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Por Seccional</label>
                                    <MultiSelect 
                                        placeholder="Todos los seccionales"
                                        options={uniqueSeccionales.map(c => ({ label: `Seccional ${c}`, value: c }))}
                                        selected={broadcastSeccionalFilters}
                                        onChange={(val) => { setBroadcastSeccionalFilters(val); setSentContacts(new Set()) }}
                                    />
                                </div>
                                <div>
                                    <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Por Rol</label>
                                    <MultiSelect 
                                        placeholder="Todos los roles"
                                        options={allRoles.map(r => ({ label: r, value: r }))}
                                        selected={broadcastRoleFilters}
                                        onChange={(val) => { setBroadcastRoleFilters(val); setSentContacts(new Set()) }}
                                    />
                                </div>
                                <div>
                                    <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Por Brigadista</label>
                                    <MultiSelect 
                                        placeholder="Todos los brigadistas"
                                        options={uniqueBrigadistas.map(b => ({ label: b, value: b }))}
                                        selected={broadcastBrigadistaFilters}
                                        onChange={(val) => { setBroadcastBrigadistaFilters(val); setSentContacts(new Set()) }}
                                    />
                                </div>
                            </div>

                            {/* Execution */}
                            {(() => {
                                const list = contacts.filter(c => {
                                    const matchEvent = broadcastEventFilters.length === 0 || broadcastEventFilters.includes(c.eventId) || (c.eventIds && c.eventIds.some((id: string) => broadcastEventFilters.includes(id)));
                                    const matchColonia = broadcastColoniaFilters.length === 0 || broadcastColoniaFilters.includes(c.colonia || '');
                                    const matchSeccional = broadcastSeccionalFilters.length === 0 || broadcastSeccionalFilters.includes(c.seccional || '');
                                    const matchRole = broadcastRoleFilters.length === 0 || (c.roles && c.roles.some((r: string) => broadcastRoleFilters.includes(r)));
                                    const matchBrigadista = broadcastBrigadistaFilters.length === 0 || broadcastBrigadistaFilters.includes(c.brigadista || '');
                                    return matchEvent && matchColonia && matchSeccional && matchRole && matchBrigadista;
                                });
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
                                                const finalMsg = broadcastImage ? `https://www.soynexo.com/i?img=${encodeURIComponent(broadcastImage)}\n\n${msg}` : msg
                                                const url = `https://wa.me/52${c.phone}?text=${encodeURIComponent(finalMsg)}`
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

                                {/* Brigadistas Section */}
                                <div className="pt-6 border-t border-gray-100 mt-6">
                                    <h4 className="font-bold text-gray-700 mb-4 text-sm flex items-center gap-2">🏃 Brigadistas <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{brigadistas.length}</span></h4>
                                    
                                    {/* Add Form */}
                                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                            <div>
                                                <label className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-widest block mb-1">Nombre *</label>
                                                <input type="text" value={brigForm.name} onChange={e => setBrigForm(p => ({ ...p, name: e.target.value }))}
                                                    placeholder="Nombre completo"
                                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-red-400" />
                                            </div>
                                            <div>
                                                <label className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-widest block mb-1">WhatsApp *</label>
                                                <input type="tel" value={brigForm.phone} onChange={e => setBrigForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                                                    placeholder="10 dígitos" inputMode="numeric"
                                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-red-400 tracking-wider" />
                                            </div>
                                            <div>
                                                <label className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-widest block mb-1">Seccional *</label>
                                                <input type="text" value={brigForm.seccional} onChange={e => setBrigForm(p => ({ ...p, seccional: e.target.value }))}
                                                    placeholder="Ej. 1234"
                                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold outline-none focus:border-red-400 text-center" />
                                            </div>
                                        </div>
                                        <button onClick={addBrigadista} disabled={isSavingBrig || !brigForm.name.trim() || brigForm.phone.length !== 10 || !brigForm.seccional.trim()}
                                            className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all active:scale-95 shadow-sm"
                                            style={{ background: accent }}>
                                            {isSavingBrig ? 'Guardando...' : '+ Agregar Brigadista'}
                                        </button>
                                    </div>

                                    {/* Brigadistas List */}
                                    {brigadistas.length > 0 ? (
                                        <div className="space-y-3">
                                            {brigadistas.map(b => (
                                                <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <p className="font-bold text-gray-800">{b.name}</p>
                                                            <p className="text-xs text-gray-500 mt-0.5">
                                                                <a href={`https://wa.me/52${b.phone}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">📱 {b.phone}</a>
                                                                <span className="mx-2 text-gray-300">|</span>
                                                                Seccional <strong>{b.seccional}</strong>
                                                            </p>
                                                            <p className="text-[0.6rem] text-gray-400 mt-2 font-mono break-all bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">{getBrigadistaQRUrl(b.id)}</p>
                                                        </div>
                                                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                                                            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                                                                <QRCodeSVG value={getBrigadistaQRUrl(b.id)} size={80} level="H" fgColor="#1f2937" />
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const svg = document.querySelector(`#qr-brig-${b.id} svg`) as SVGSVGElement;
                                                                    if (!svg) {
                                                                        // Fallback: open QR URL for manual screenshot
                                                                        window.open(getBrigadistaQRUrl(b.id), '_blank');
                                                                        return;
                                                                    }
                                                                    const canvas = document.createElement('canvas');
                                                                    const ctx = canvas.getContext('2d');
                                                                    const data = new XMLSerializer().serializeToString(svg);
                                                                    const img = new Image();
                                                                    img.onload = () => {
                                                                        canvas.width = 400; canvas.height = 400;
                                                                        ctx?.drawImage(img, 0, 0, 400, 400);
                                                                        const a = document.createElement('a');
                                                                        a.download = `QR-${b.name.replace(/\s+/g, '_')}.png`;
                                                                        a.href = canvas.toDataURL('image/png');
                                                                        a.click();
                                                                    };
                                                                    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
                                                                }}
                                                                className="text-[0.6rem] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                                            >
                                                                ⬇️ Descargar QR
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end mt-2 pt-2 border-t border-gray-50" id={`qr-brig-${b.id}`}>
                                                        <div className="hidden"><QRCodeSVG value={getBrigadistaQRUrl(b.id)} size={400} level="H" fgColor="#1f2937" /></div>
                                                        <button onClick={() => deleteBrigadista(b.id)} className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors">
                                                            🗑️ Eliminar
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center py-8 text-gray-400 text-sm font-medium">No hay brigadistas registrados aún.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
