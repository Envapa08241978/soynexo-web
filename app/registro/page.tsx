'use client'

import { useState, useRef, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { QRCodeSVG } from 'qrcode.react'
import { analyzeImageContent, validateFileBasics } from '@/lib/contentModeration'
import Link from 'next/link'

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
    timestamp: number
}

interface MediaItem {
    id: string
    url: string
    type: 'photo' | 'video'
    timestamp: number
    fileName?: string
}

/* ================================================================
   DEFAULT TEST DATA
   ================================================================ */
const DEFAULT_CONFIG = {
    name: 'Registro Ciudadano',
    title: 'Atención Comunitaria',
    party: 'Morena',
    phone: '',
    photo: '',
    dashboardPassword: '123',
    accentColor: '#A60321', // Guinda
    backgroundColor: '#ffffff',
    textColor: '#333333',
    activeEventId: null
}

const DEFAULT_EVENT = {
    id: 'evento-demo',
    name: 'Atención Comunitaria Permanante',
    date: new Date().toISOString(),
    location: 'Sede Principal',
    coords: '',
    image: '',
    description: 'Regístrate como Enlace y sube tus evidencias.',
    time: 'Todo el día',
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function CitizenEventPage() {
    // --- Config ---
    const [config, setConfig] = useState<any>(DEFAULT_CONFIG)
    const [event, setEvent] = useState<any>(DEFAULT_EVENT)
    const [configLoaded, setConfigLoaded] = useState(false)

    // --- Contacts ---
    const [contacts, setContacts] = useState<ContactItem[]>([])

    // --- Media ---
    const [media, setMedia] = useState<MediaItem[]>([])
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [isDownloading, setIsDownloading] = useState(false)
    const [filter, setFilter] = useState<'all' | 'photos' | 'videos'>('all')
    const [isLoading, setIsLoading] = useState(true)
    const [showQR, setShowQR] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadSuccess, setUploadSuccess] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [showUploadOptions, setShowUploadOptions] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const videoInputRef = useRef<HTMLInputElement>(null)
    const galleryInputRef = useRef<HTMLInputElement>(null)

    // --- RSVP ---
    const [showRSVP, setShowRSVP] = useState(false)
    const [rsvpName, setRsvpName] = useState('')
    const [rsvpPhone, setRsvpPhone] = useState('')
    const [rsvpCP, setRsvpCP] = useState('')
    const [rsvpColonia, setRsvpColonia] = useState('')
    const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false)
    const [rsvpSuccess, setRsvpSuccess] = useState(false)

    // --- Delete ---
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [deleteError, setDeleteError] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    // --- Countdown ---
    const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

    const [uploadUrl, setUploadUrl] = useState('')
    useEffect(() => {
        if (typeof window !== 'undefined') setUploadUrl(`${window.location.origin}/registro`)
    }, [])

    /* ---- Load config + active event from Firebase ---- */
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const configDoc = await getDoc(doc(db, 'campaigns', 'main_campaign', 'config', 'profile'))
                if (configDoc.exists()) {
                    const data = configDoc.data()
                    setConfig((prev: any) => ({ ...prev, ...data }))

                    // Load active event
                    if (data.activeEventId) {
                        const eventDoc = await getDoc(doc(db, 'campaigns', 'main_campaign', 'events', data.activeEventId))
                        if (eventDoc.exists()) {
                            setEvent({ id: eventDoc.id, ...eventDoc.data() })
                        }
                    }
                }
            } catch (err) {
                console.log('Using default config (Firebase doc not found)')
            } finally {
                setConfigLoaded(true)
            }
        }
        loadConfig()
    }, [])

    /* ---- Countdown timer ---- */
    useEffect(() => {
        if (!event.date) return
        const eventDate = new Date(event.date).getTime()
        const tick = () => {
            const diff = Math.max(0, eventDate - Date.now())
            setCountdown({
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((diff / (1000 * 60)) % 60),
                seconds: Math.floor((diff / 1000) % 60),
            })
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [event.date])

    /* ---- Firebase: Contacts real-time sync ---- */
    useEffect(() => {
        const ref = collection(db, 'campaigns', 'main_campaign', 'contacts')
        const q = query(ref, orderBy('timestamp', 'desc'))
        return onSnapshot(q, (snap) => {
            setContacts(snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                timestamp: d.data().timestamp?.toMillis() || Date.now(),
            } as ContactItem)))
        })
    }, [])

    /* ---- Firebase: Media real-time sync ---- */
    useEffect(() => {
        const mediaRef = collection(db, 'campaigns', 'main_campaign', 'media')
        const q = query(mediaRef, orderBy('timestamp', 'desc'))
        return onSnapshot(q, (snap) => {
            setMedia(snap.docs.map(d => ({
                id: d.id,
                url: d.data().url,
                type: d.data().type as 'photo' | 'video',
                timestamp: d.data().timestamp?.toMillis() || Date.now(),
                fileName: d.data().fileName,
            })))
            setIsLoading(false)
        }, () => setIsLoading(false))
    }, [])

    /* ---- Filtered media ---- */
    const filteredMedia = media.filter(item => {
        if (filter === 'photos') return item.type === 'photo'
        if (filter === 'videos') return item.type === 'video'
        return true
    })
    const selectedMedia = selectedIndex !== null ? filteredMedia[selectedIndex] : null

    /* ---- Keyboard nav ---- */
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (selectedIndex === null) return
            if (e.key === 'Escape') setSelectedIndex(null)
            else if (e.key === 'ArrowRight') setSelectedIndex(p => p !== null && p < filteredMedia.length - 1 ? p + 1 : p)
            else if (e.key === 'ArrowLeft') setSelectedIndex(p => p !== null && p > 0 ? p - 1 : p)
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [selectedIndex, filteredMedia.length])

    /* ---- Color shorthands ---- */
    const accent = config.accentColor || '#A60321'
    const bgColor = config.backgroundColor || '#ffffff'
    const textColor = config.textColor || '#333333'

    // Convert hex to rgb for theme injection
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
      .tpc .text-theme-60 { color: rgba(${tcRGB}, 0.6)!important }
      .tpc .bg-theme-5 { background: rgba(${tcRGB}, 0.05)!important }
      .tpc .border-theme-10 { border-color: rgba(${tcRGB}, 0.1)!important }
      .tpc [data-btn]{ color:#fff!important }
    `

    /* ---- Download ---- */
    const downloadFile = async (item: MediaItem) => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        if (isIOS) { window.open(item.url, '_blank'); return }
        try {
            const res = await fetch(item.url)
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `directorio-${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch { window.open(item.url, '_blank') }
    }

    const downloadAll = async () => {
        setIsDownloading(true)
        for (const item of media) { await downloadFile(item); await new Promise(r => setTimeout(r, 500)) }
        setIsDownloading(false)
    }

    /* ---- Upload with content moderation ---- */
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadError(null)
        setShowUploadOptions(false)

        const basicVal = validateFileBasics(file)
        if (!basicVal.valid) { setUploadError(basicVal.error || 'Error'); return }

        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')
        if (!isImage && !isVideo) { setUploadError('Solo fotos y videos'); return }

        setIsUploading(true)
        try {
            if (isImage) {
                const mod = await analyzeImageContent(file)
                if (!mod.isAppropriate) { setUploadError(mod.reason || 'Contenido no permitido'); setIsUploading(false); resetInputs(); return }
            }

            const fileName = `${Date.now()}-${file.name}`
            const storageRef = ref(storage, `campaigns/main_campaign/media/${fileName}`)
            await uploadBytes(storageRef, file)
            const downloadURL = await getDownloadURL(storageRef)
            await addDoc(collection(db, 'campaigns', 'main_campaign', 'media'), {
                url: downloadURL, type: isVideo ? 'video' : 'photo', timestamp: serverTimestamp(), fileName, eventId: event.id || ''
            })
            setUploadSuccess(true)
            setTimeout(() => setUploadSuccess(false), 3000)
        } catch (err) {
            console.error('Upload error:', err)
            setUploadError('Error al subir. Intenta de nuevo.')
        } finally { setIsUploading(false); resetInputs() }
    }

    const resetInputs = () => {
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (videoInputRef.current) videoInputRef.current.value = ''
        if (galleryInputRef.current) galleryInputRef.current.value = ''
    }

    /* ---- Delete with password ---- */
    const handleDelete = async () => {
        if (deletePassword !== config.dashboardPassword && deletePassword !== 'soynexoadmin') { setDeleteError('Contraseña incorrecta'); return }
        if (!selectedMedia) return
        setIsDeleting(true)
        try {
            await deleteDoc(doc(db, 'campaigns', 'main_campaign', 'media', selectedMedia.id))
            if (selectedMedia.fileName) {
                const sRef = ref(storage, `campaigns/main_campaign/media/${selectedMedia.fileName}`)
                await deleteObject(sRef).catch(() => { })
            }
            setSelectedIndex(null); setShowDeleteModal(false); setDeletePassword(''); setDeleteError('')
        } catch { setDeleteError('Error al eliminar') }
        finally { setIsDeleting(false) }
    }

    /* ---- Download vCard ---- */
    const downloadVCard = () => {
        const vcardData = `BEGIN:VCARD
VERSION:3.0
FN: ${config.name}
TITLE:${config.title}
ORG:${config.party}
TEL;TYPE=WORK,VOICE:+${config.phone}
URL:https://soynexo.com/registro
END:VCARD`;

        const blob = new Blob([vcardData], { type: 'text/vcard' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${config.name.replace(/s+/g, '_')}.vcf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    /* ---- RSVP: Register attendance + open WhatsApp ---- */
    const handleRSVPSubmit = async () => {
        if (!rsvpName.trim() || !rsvpPhone.trim()) return

        // Validate phone: 10 digits
        const cleanPhone = rsvpPhone.replace(/D/g, '')
        if (cleanPhone.length !== 10) { setUploadError('Ingresa un número de 10 dígitos'); return }

        // Require CP
        if (!rsvpCP.trim() || rsvpCP.trim().length !== 5) { setUploadError('Ingresa un Código Postal de 5 dígitos'); return }

        setIsSubmittingRSVP(true)
        try {
            await addDoc(collection(db, 'campaigns', 'main_campaign', 'contacts'), {
                name: rsvpName.trim(),
                phone: cleanPhone,
                cp: rsvpCP.trim(),
                colonia: rsvpColonia.trim() || '',
                eventId: event.id || '',
                eventName: event.name || '',
                timestamp: serverTimestamp(),
            })

            const confirmedName = rsvpName.trim()
            
            // Auto download contact to their phone
            setTimeout(() => downloadVCard(), 500);

            setShowRSVP(false)
            setRsvpName('')
            setRsvpPhone('')
            setRsvpCP('')
            setRsvpColonia('')
            setRsvpSuccess(true)
            setTimeout(() => setRsvpSuccess(false), 5000)

            // Open WhatsApp with pre-filled message
            const politicianPhone = config.phone?.replace(/D/g, '') || ''
            if (politicianPhone) {
                const msg = encodeURIComponent(`¡Hola! Me acabo de registrar como Enlace de ${config.name}. 🎉n📋 ${confirmedName}n🏛️ ${event.name || ''}`)
                window.location.href = `https://wa.me/52${politicianPhone}?text=${msg}`
            }
        } catch (err) {
            console.error('RSVP error:', err)
            setUploadError('Error al registrar. Intenta de nuevo.')
        } finally { setIsSubmittingRSVP(false) }
    }

    /* ---- Get initials ---- */
    const getInitials = (name: string) => {
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    }

    /* ================================================================
       RENDER
       ================================================================ */
    if (!configLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
                    <p className="text-gray-500 font-bold text-sm">Validando registro...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen tpc" style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>
            <style dangerouslySetInnerHTML={{ __html: themeCSS }} />

            {/* ==========================================
                SECTION 1: HERO
                ========================================== */}
            <section className="relative text-center overflow-hidden border-b border-gray-100">
                {/* Powered by */}
                <div className="pt-3 pb-2 relative z-10">
                    <Link href="https://soynexo.com" target="_blank"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[0.65rem]"
                        style={{ color: 'rgba(0,0,0,0.4)', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
                        Gestión Comunitaria Segura <strong style={{ color: 'rgba(0,0,0,0.6)' }}>Soy Nexo</strong>
                    </Link>
                </div>

                {/* Event Image or Gradient Hero */}
                {event.image ? (
                    <img src={event.image} alt={event.name} className="w-full max-w-md mx-auto rounded-t-3xl shadow-lg mt-4" style={{ display: 'block' }} />
                ) : (
                    <div className="px-4 py-12 relative bg-white">
                        {/* Background glow */}
                        <div className="absolute inset-0 opacity-10" style={{
                            background: `radial-gradient(ellipse at center top, ${accent}, transparent 70%)`,
                        }} />

                        {/* Politician name */}
                        <div className="relative z-10">
                            {config.photo && (
                                <img src={config.photo} alt={config.name}
                                    className="w-24 h-24 rounded-full mx-auto mb-4 object-cover shadow-xl"
                                    style={{ border: `4px solid ${accent}` }} />
                            )}
                            <p className="text-theme-60 text-xs font-bold tracking-[0.2em] uppercase mb-1">{config.title}</p>
                            <h1 className="text-theme text-3xl md:text-5xl font-black tracking-tight leading-tight">{config.name}</h1>
                            {config.party && <p className="text-theme-80 font-medium text-sm mt-2 bg-gray-100 inline-block px-4 py-1 rounded-full border border-gray-200">{config.party}</p>}
                        </div>

                        {/* Event name */}
                        <div className="mt-8 relative z-10 max-w-lg mx-auto bg-gray-50/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <p className="text-xs font-black tracking-[0.15em] uppercase mb-1" style={{ color: accent }}>📍 {event.id === 'evento-demo' ? 'Atención Permanente' : 'Convocatoria General'}</p>
                            <h2 className="text-theme text-xl md:text-2xl font-bold">{event.name}</h2>
                            {event.description && <p className="text-gray-600 text-sm mt-3 font-medium">{event.description}</p>}
                        </div>
                    </div>
                )}

                {/* Event Details Bar */}
                <div className="px-4 py-4 flex flex-wrap justify-center gap-6 text-sm bg-gray-50 border-t border-gray-100 font-bold">
                    <div className="flex items-center gap-1.5 text-gray-600">
                        <span>📅</span>
                        <span>{new Date(event.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                        <span>🕐</span>
                        <span>{event.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                        <span>📍</span>
                        <span>{event.location}</span>
                    </div>
                </div>


                {/* Action Buttons */}
                <div className="px-4 py-8 flex flex-col items-center gap-3 bg-white">
                    <button onClick={() => setShowRSVP(true)} data-btn
                        className="w-full max-w-sm px-8 py-4 rounded-xl text-sm font-black tracking-wider text-white transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
                        style={{ background: accent }}>
                        📋 REGISTRAR ASISTENCIA / ENLACE
                    </button>
                    {event.coords && (
                        <a href={`https://www.google.com/maps?q=${event.coords}`} target="_blank" rel="noopener noreferrer"
                            className="w-full max-w-sm px-8 py-3 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 border shadow-sm hover:bg-gray-50"
                            style={{ color: accent, borderColor: accent }}>
                            📍 CÓMO LLEGAR
                        </a>
                    )}
                </div>
            </section>

            {/* ==========================================
                SECTION 2: CONFIRMED COUNT
                ========================================== */}
            {contacts.length > 0 && (
                <section className="px-4 py-8 bg-gray-50 border-b border-gray-100 shadow-inner">
                    <p className="text-center text-sm mb-5 font-black uppercase tracking-widest" style={{ color: accent }}>
                        🤝 La Comunidad Respalda ({contacts.length})
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
                        {contacts.slice(0, 40).map(c => (
                            <div key={c.id} className="flex flex-col items-center gap-1">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black shadow-md bg-white border-2"
                                    style={{ color: accent, borderColor: `${accent}22` }}>
                                    {getInitials(c.name)}
                                </div>
                                <span className="text-[0.6rem] font-bold text-gray-500 max-w-[60px] truncate">{c.name.split(' ')[0]}</span>
                            </div>
                        ))}
                        {contacts.length > 40 && (
                            <div className="flex items-center">
                                <span className="text-xs font-bold text-gray-400">+{contacts.length - 40} más</span>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ==========================================
                SECTION 4: ALBUM HEADER
                ========================================== */}
            <section className="sticky top-0 z-40 px-4 py-4 bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-theme">📸 Evidencias</span>
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {media.length} archivos
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowQR(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border shadow-sm hover:bg-gray-50"
                            style={{ color: accent, borderColor: accent }}>
                            QR
                        </button>
                        <button onClick={downloadAll} disabled={isDownloading || media.length === 0}
                            className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-40 shadow-md transition-opacity"
                            style={{ background: accent }}>
                            {isDownloading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                            Descargar
                        </button>
                    </div>
                </div>
                <div className="flex gap-2 mt-3 max-w-5xl mx-auto">
                    {(['all', 'photos', 'videos'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className="px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm border"
                            style={{
                                background: filter === f ? accent : 'white',
                                color: filter === f ? 'white' : 'gray',
                                borderColor: filter === f ? accent : '#e5e7eb',
                            }}>
                            {f === 'all' ? 'Ver Todo' : f === 'photos' ? 'Solo Fotos' : 'Solo Videos'}
                        </button>
                    ))}
                </div>
            </section>

            {/* ==========================================
                SECTION 5: GALLERY GRID
                ========================================== */}
            <main className="px-3 py-6 pb-28 max-w-5xl mx-auto bg-gray-50 min-h-screen">
                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
                    </div>
                ) : filteredMedia.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <div className="text-5xl mb-4 grayscale opacity-50 block">📷</div>
                        <p className="text-gray-800 font-bold text-lg">Álbum Comunitario</p>
                        <p className="text-sm mt-2 text-gray-500 font-medium max-w-xs mx-auto">Toma una foto de la reunión, marcha o asamblea para dejar evidencia del movimiento.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                        {filteredMedia.map((item, index) => (
                            <div key={item.id} onClick={() => setSelectedIndex(index)}
                                className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group shadow-sm border border-gray-100 bg-white">
                                {item.type === 'video' ? (
                                    <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata"
                                        onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.5 }} />
                                ) : (
                                    <img src={item.url} alt="" loading="lazy"
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                )}
                                {item.type === 'video' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm bg-black/40">
                                            <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* ==========================================
                FLOATING UPLOAD BUTTON
                ========================================== */}
            <div className="fixed bottom-6 right-4 z-40">
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
                <input ref={videoInputRef} type="file" accept="video/*" capture="environment" onChange={handleFileUpload} className="hidden" />
                <input ref={galleryInputRef} type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />

                {showUploadOptions && (
                    <div className="absolute bottom-20 right-0 rounded-2xl p-2 mb-2 flex flex-col gap-1 min-w-[180px] shadow-2xl bg-white border border-gray-100">
                        <button onClick={() => { fileInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 focus:bg-gray-100 active:bg-gray-200 transition-colors">
                            <span className="text-xl">📸</span> Cámara (Foto)
                        </button>
                        <button onClick={() => { videoInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 focus:bg-gray-100 active:bg-gray-200 transition-colors">
                            <span className="text-xl">🎥</span> Cámara (Video)
                        </button>
                        <div className="border-t border-gray-100 my-1"></div>
                        <button onClick={() => { galleryInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 focus:bg-gray-100 active:bg-gray-200 transition-colors">
                            <span className="text-xl">🖼️</span> Elegir de Galería
                        </button>
                    </div>
                )}

                <button onClick={() => setShowUploadOptions(!showUploadOptions)} disabled={isUploading}
                    className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-90 disabled:opacity-50"
                    style={{ background: accent, border: '4px solid white' }}>
                    {isUploading ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        : <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>}
                </button>
            </div>

            {/* ==========================================
                FOOTER
                ========================================== */}
            <footer className="py-6 text-center bg-gray-900 border-t border-gray-800">
                <Link href="https://soynexo.com" target="_blank"
                    className="text-xs font-bold text-gray-400 hover:text-white transition-colors">
                    Sistema protegido por SOY NEXO
                </Link>
            </footer>

            {/* ==========================================
                TOASTS
                ========================================== */}
            {uploadSuccess && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-full px-6 py-3 text-sm font-bold text-white shadow-xl animate-in fade-in slide-in-from-top-4"
                    style={{ background: '#22c55e' }}>
                    ✅ ¡Evidencia subida correctamente!
                </div>
            )}
            {rsvpSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 text-center max-w-sm w-full mx-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2" style={{ background: accent }}></div>
                        <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl mb-4 bg-green-50 text-green-500 shadow-inner">✅</div>
                        <h2 className="text-2xl font-black text-gray-800 mb-2">¡Registro Exitoso!</h2>
                        <p className="text-gray-500 font-medium mb-6">Tu registro como Enlace Comunitario ha sido validado. Abriendo WhatsApp para confirmar...</p>
                        <p className="text-xs text-gray-400 font-bold bg-gray-50 py-2 rounded-lg">Se descargó una tarjeta de contacto (VCF) a tu teléfono de forma automática.</p>
                    </div>
                </div>
            )}
            {uploadError && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-5 py-3 flex items-center gap-2 text-sm font-bold text-white shadow-xl"
                    style={{ background: '#ef4444' }}>
                    ⚠️ {uploadError}
                    <button onClick={() => setUploadError(null)} className="ml-2 text-white bg-red-600 rounded-full w-6 h-6 flex items-center justify-center">✕</button>
                </div>
            )}

            {/* ==========================================
                RSVP MODAL
                ========================================== */}
            {showRSVP && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                    onClick={() => setShowRSVP(false)}>
                    <div className="rounded-3xl p-6 w-full max-w-sm bg-white shadow-2xl relative overflow-hidden"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-1.5" style={{ background: accent }}></div>
                        
                        <div className="flex justify-between items-start mb-4 mt-2">
                           <h3 className="text-xl font-black text-gray-800 tracking-tight">Registro de Enlace</h3>
                           <button onClick={() => setShowRSVP(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
                        </div>
                        
                        <p className="text-sm text-gray-500 font-medium mb-6">Ingresa tus datos reales para habilitar el cruce demográfico de la zona.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-widest block mb-1">Nombre completo *</label>
                                <input type="text" value={rsvpName} onChange={(e) => setRsvpName(e.target.value)}
                                    placeholder="Ej. María García" autoFocus
                                    className="w-full px-4 py-3.5 rounded-xl text-sm font-medium border border-gray-200 bg-gray-50 outline-none focus:border-red-400 focus:bg-white transition-colors text-gray-800" />
                            </div>

                            <div>
                                <label className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-widest block mb-1">WhatsApp Institucional *</label>
                                <div className="flex items-center gap-2">
                                    <span className="bg-gray-100 text-gray-500 font-bold px-3 py-3.5 rounded-xl border border-gray-200 text-sm flex-shrink-0">🇲🇽 +52</span>
                                    <input type="tel" value={rsvpPhone} onChange={(e) => setRsvpPhone(e.target.value.replace(/D/g, '').slice(0, 10))}
                                        placeholder="10 dígitos" inputMode="numeric" maxLength={10}
                                        className="flex-1 px-4 py-3.5 rounded-xl text-sm font-bold border border-gray-200 bg-gray-50 outline-none focus:border-red-400 focus:bg-white transition-colors text-gray-800 tracking-wider" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-widest block mb-1">Código Postal *</label>
                                    <input type="text" value={rsvpCP} onChange={(e) => setRsvpCP(e.target.value.replace(/D/g, '').slice(0, 5))}
                                        placeholder="5 dígitos" inputMode="numeric" maxLength={5}
                                        className="w-full px-4 py-3.5 rounded-xl text-sm font-bold border border-gray-200 bg-gray-50 outline-none focus:border-red-400 text-center tracking-widest text-gray-800 focus:bg-white" />
                                </div>
                                <div>
                                    <label className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-widest block mb-1">Colonia</label>
                                    <input type="text" value={rsvpColonia} onChange={(e) => setRsvpColonia(e.target.value)}
                                        placeholder="Opcional"
                                        className="w-full px-4 py-3.5 rounded-xl text-sm font-medium border border-gray-200 bg-gray-50 outline-none focus:border-red-400 text-gray-800 focus:bg-white transition-colors" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button onClick={handleRSVPSubmit} disabled={isSubmittingRSVP || !rsvpName.trim() || rsvpPhone.replace(/D/g, '').length !== 10 || rsvpCP.length !== 5} data-btn
                                className="w-full py-4 rounded-xl text-sm font-black text-white shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                                style={{ background: accent }}>
                                {isSubmittingRSVP ? 'VERIFICANDO...' : 'REGISTRAR MI ASISTENCIA ✅'}
                            </button>
                            <p className="text-[0.6rem] text-center text-gray-400 font-bold mt-4 uppercase tracking-widest">Al registrarte descargas automáticamente contacto VCARD.</p>
                        </div>
                    </div>
                </div>
            )}


            {/* ==========================================
                FULL-SCREEN VIEWER
                ========================================== */}
            {selectedMedia && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
                    onClick={() => setSelectedIndex(null)}>
                    <button onClick={() => setSelectedIndex(null)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10 bg-white/10 hover:bg-white/20 transition-colors text-white">✕</button>
                    {selectedIndex! > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(p => p! - 1) }}
                            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center z-10 bg-white/10 hover:bg-white/20 transition-colors">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    )}
                    {selectedIndex! < filteredMedia.length - 1 && (
                        <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(p => p! + 1) }}
                            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center z-10 bg-white/10 hover:bg-white/20 transition-colors">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    )}
                    <div className="max-w-4xl w-full px-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                        {selectedMedia.type === 'video' ? (
                            <video src={selectedMedia.url} controls autoPlay className="w-full max-h-[80vh] rounded-2xl mx-auto shadow-2xl" style={{ objectFit: 'contain' }} />
                        ) : (
                            <img src={selectedMedia.url} alt="" className="w-full max-h-[80vh] rounded-2xl mx-auto shadow-2xl" style={{ objectFit: 'contain' }} />
                        )}
                    </div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full px-6 py-3 bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl">
                        <span className="text-white font-bold text-xs bg-white/20 px-3 py-1 rounded-full">{selectedIndex! + 1} de {filteredMedia.length}</span>
                        <div className="w-px h-4 bg-white/20" />
                        <button onClick={(e) => { e.stopPropagation(); downloadFile(selectedMedia) }}
                            className="text-white font-bold text-xs flex items-center gap-2 hover:opacity-70 transition-opacity">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Descargar
                        </button>
                        <div className="w-px h-4 bg-white/20" />
                        <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true) }}
                            className="text-red-400 font-bold text-xs flex items-center gap-2 hover:text-red-300 transition-colors">
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            )}

            {/* ==========================================
                DELETE MODAL
                ========================================== */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError('') }}>
                    <div className="rounded-3xl p-6 w-full max-w-xs bg-white shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-xl mb-4 mx-auto">🗑️</div>
                        <h3 className="text-xl font-black text-gray-800 mb-1 text-center">Eliminar Evidencia</h3>
                        <p className="text-sm text-gray-500 mb-6 text-center font-medium">Ingresa la super-contraseña para borrar este medio.</p>
                        
                        <input type="password" value={deletePassword}
                            onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                            placeholder="Contraseña Maestra" autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                            className="w-full px-4 py-3.5 rounded-xl mb-2 text-sm outline-none bg-gray-50 border border-gray-200 text-center font-bold text-gray-800 tracking-widest focus:border-red-500 transition-colors" />
                        
                        {deleteError && <p className="text-red-500 text-xs font-bold mb-4 text-center">{deleteError}</p>}
                        
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError('') }}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
                            <button onClick={handleDelete} disabled={isDeleting}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-md transition-colors disabled:opacity-50">
                                {isDeleting ? 'Borrando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                QR MODAL
                ========================================== */}
            {showQR && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                    onClick={() => setShowQR(false)}>
                    <div className="rounded-3xl p-8 w-full max-w-sm text-center relative bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
                        
                        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl mb-4 shadow-sm" style={{ background: `${accent}20`, color: accent }}>📱</div>
                        
                        <h2 className="text-2xl font-black text-gray-800 mb-2 tracking-tight">Cámara Ciudadana</h2>
                        <p className="text-sm text-gray-500 font-medium mb-8">Escanea el QR para subir evidencias del evento directamente a este portal.</p>
                        
                        <div className="bg-gray-50 p-6 rounded-3xl inline-block mb-8 border border-gray-200 shadow-inner">
                            <QRCodeSVG value={uploadUrl} size={200} level="H" fgColor="#1f2937" />
                        </div>
                        
                        <div className="rounded-xl p-3 bg-gray-100 border border-gray-200">
                            <p className="font-mono text-xs break-all font-bold text-gray-600">{uploadUrl}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
