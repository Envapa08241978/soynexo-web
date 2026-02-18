'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { QRCodeSVG } from 'qrcode.react'
import { analyzeImageContent, validateFileBasics } from '@/lib/contentModeration'
import Link from 'next/link'

/* ================================================================
   TYPES
   ================================================================ */
interface PoliticianConfig {
    name: string
    title: string
    party: string
    phone: string
    photo: string
    dashboardPassword: string
    accentColor: string
    backgroundColor: string
    activeEventId?: string
}

interface EventConfig {
    id: string
    name: string
    date: string
    location: string
    coords: string
    image: string
    description: string
    time: string
}

interface ContactItem {
    id: string
    name: string
    phone: string
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
const DEFAULT_CONFIG: PoliticianConfig = {
    name: 'Lic. Juan Pérez',
    title: 'Candidato',
    party: '',
    phone: '6421600559',
    photo: '',
    dashboardPassword: 'admin123',
    accentColor: '#8B1A2B',
    backgroundColor: '#1a0f14',
}

const DEFAULT_EVENT: EventConfig = {
    id: 'evento-demo',
    name: 'Informe Ciudadano 2026',
    date: '2026-03-15T18:00:00-07:00',
    location: 'Plaza Principal, Navojoa',
    coords: '',
    image: '',
    description: 'Escanea el QR para registrar tu asistencia y compartir fotos del evento.',
    time: '6:00 PM',
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function CitizenEventPage() {
    const params = useParams()
    const slug = params.slug as string

    // --- Config ---
    const [config, setConfig] = useState<PoliticianConfig>(DEFAULT_CONFIG)
    const [event, setEvent] = useState<EventConfig>(DEFAULT_EVENT)
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
    const [rsvpColonia, setRsvpColonia] = useState('')
    const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false)
    const [rsvpSuccess, setRsvpSuccess] = useState(false)
    const [showVCardPrompt, setShowVCardPrompt] = useState(false)
    const [whatsAppMessage, setWhatsAppMessage] = useState('')

    // --- Delete ---
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [deleteError, setDeleteError] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    // --- Countdown ---
    const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

    const [uploadUrl, setUploadUrl] = useState('')
    useEffect(() => {
        if (typeof window !== 'undefined') setUploadUrl(`${window.location.origin}/c/${slug}`)
    }, [slug])

    /* ---- Load politician config + active event from Firebase ---- */
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const configDoc = await getDoc(doc(db, 'politicians', slug, 'config', 'profile'))
                if (configDoc.exists()) {
                    const data = configDoc.data() as Partial<PoliticianConfig>
                    setConfig(prev => ({ ...prev, ...data }))

                    // Load active event
                    if (data.activeEventId) {
                        const eventDoc = await getDoc(doc(db, 'politicians', slug, 'events', data.activeEventId as string))
                        if (eventDoc.exists()) {
                            setEvent({ id: eventDoc.id, ...eventDoc.data() } as EventConfig)
                        }
                    }
                }
            } catch (err) {
                console.log('Using default config (Firebase doc not found)')
            } finally {
                setConfigLoaded(true)
            }
        }
        if (slug) loadConfig()
    }, [slug])

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
        if (!slug) return
        const ref = collection(db, 'politicians', slug, 'contacts')
        const q = query(ref, orderBy('timestamp', 'desc'))
        return onSnapshot(q, (snap) => {
            setContacts(snap.docs.map(d => ({
                id: d.id,
                name: d.data().name,
                phone: d.data().phone,
                colonia: d.data().colonia,
                eventId: d.data().eventId,
                eventName: d.data().eventName,
                timestamp: d.data().timestamp?.toMillis() || Date.now(),
            })))
        })
    }, [slug])

    /* ---- Firebase: Media real-time sync ---- */
    useEffect(() => {
        if (!slug) return
        const mediaRef = collection(db, 'politicians', slug, 'media')
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
    }, [slug])

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
    const accent = config.accentColor || '#8B1A2B'
    const bgColor = config.backgroundColor || '#1a0f14'

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
            a.download = `${slug}-${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`
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
            const storageRef = ref(storage, `politicians/${slug}/${fileName}`)
            await uploadBytes(storageRef, file)
            const downloadURL = await getDownloadURL(storageRef)
            await addDoc(collection(db, 'politicians', slug, 'media'), {
                url: downloadURL, type: isVideo ? 'video' : 'photo', timestamp: serverTimestamp(), fileName, eventId: event.id
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
        if (deletePassword !== config.dashboardPassword) { setDeleteError('Contraseña incorrecta'); return }
        if (!selectedMedia) return
        setIsDeleting(true)
        try {
            await deleteDoc(doc(db, 'politicians', slug, 'media', selectedMedia.id))
            if (selectedMedia.fileName) {
                const sRef = ref(storage, `politicians/${slug}/${selectedMedia.fileName}`)
                await deleteObject(sRef).catch(() => { })
            }
            setSelectedIndex(null); setShowDeleteModal(false); setDeletePassword(''); setDeleteError('')
        } catch { setDeleteError('Error al eliminar') }
        finally { setIsDeleting(false) }
    }

    /* ---- RSVP: Register attendance + open WhatsApp ---- */
    const handleRSVPSubmit = async () => {
        if (!rsvpName.trim() || !rsvpPhone.trim()) return

        // Validate phone: 10 digits
        const cleanPhone = rsvpPhone.replace(/\D/g, '')
        if (cleanPhone.length !== 10) { setUploadError('Ingresa un número de 10 dígitos'); return }

        setIsSubmittingRSVP(true)
        try {
            await addDoc(collection(db, 'politicians', slug, 'contacts'), {
                name: rsvpName.trim(),
                phone: cleanPhone,
                colonia: rsvpColonia.trim() || '',
                eventId: event.id,
                eventName: event.name,
                timestamp: serverTimestamp(),
            })

            const confirmedName = rsvpName.trim()
            setShowRSVP(false)
            setRsvpName('')
            setRsvpPhone('')
            setRsvpColonia('')
            setRsvpSuccess(true)
            setTimeout(() => setRsvpSuccess(false), 5000)

            // Open WhatsApp with pre-filled message
            const politicianPhone = config.phone.replace(/\D/g, '')
            const msg = encodeURIComponent(`¡Ya estoy aquí! 🎉\n📋 ${confirmedName}\n🏛️ ${event.name}`)
            window.open(`https://wa.me/52${politicianPhone}?text=${msg}`, '_blank')
        } catch (err) {
            console.error('RSVP error:', err)
            setUploadError('Error al registrar. Intenta de nuevo.')
        } finally { setIsSubmittingRSVP(false) }
    }

    /* ---- Format phone display ---- */
    const formatPhone = (phone: string) => {
        if (phone.length === 10) return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`
        return phone
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
            <div className="min-h-screen flex items-center justify-center" style={{ background: bgColor }}>
                <div className="text-center">
                    <div className="w-10 h-10 border-3 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
                    <p className="text-white/50 text-sm">Cargando evento...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen" style={{ background: bgColor, fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>

            {/* ==========================================
                SECTION 1: HERO
                ========================================== */}
            <section className="relative text-center overflow-hidden">
                {/* Powered by */}
                <div className="pt-3 pb-2 relative z-10">
                    <Link href="https://soynexo.com" target="_blank"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[0.65rem]"
                        style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        Powered by <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Soy Nexo</strong>
                    </Link>
                </div>

                {/* Event Image or Gradient Hero */}
                {event.image ? (
                    <img src={event.image} alt={event.name} className="w-full max-w-md mx-auto" style={{ display: 'block' }} />
                ) : (
                    <div className="px-4 py-12 relative">
                        {/* Background glow */}
                        <div className="absolute inset-0 opacity-20" style={{
                            background: `radial-gradient(ellipse at center top, ${accent}, transparent 70%)`,
                        }} />

                        {/* Politician name */}
                        <div className="relative z-10">
                            {config.photo && (
                                <img src={config.photo} alt={config.name}
                                    className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
                                    style={{ border: `3px solid ${accent}`, boxShadow: `0 0 30px ${accent}33` }} />
                            )}
                            <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase mb-2">{config.title}</p>
                            <h1 className="text-white text-3xl sm:text-4xl font-black tracking-tight leading-tight">{config.name}</h1>
                            {config.party && <p className="text-white/40 text-sm mt-1">{config.party}</p>}
                        </div>

                        {/* Event name */}
                        <div className="mt-8 relative z-10">
                            <p className="text-xs font-bold tracking-[0.15em] uppercase mb-1" style={{ color: accent }}>Evento</p>
                            <h2 className="text-white text-xl sm:text-2xl font-bold">{event.name}</h2>
                            {event.description && <p className="text-white/50 text-sm mt-2 max-w-sm mx-auto">{event.description}</p>}
                        </div>
                    </div>
                )}

                {/* Event Details Bar */}
                <div className="px-4 py-4 flex flex-wrap justify-center gap-4 text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span className="text-white/70">{new Date(event.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span>🕐</span>
                        <span className="text-white/70">{event.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span>📍</span>
                        <span className="text-white/70">{event.location}</span>
                    </div>
                </div>


                {/* Action Buttons */}
                <div className="px-4 py-5 flex flex-col items-center gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => setShowRSVP(true)}
                        className="w-full max-w-xs px-8 py-4 rounded-xl text-sm font-bold tracking-wider text-white transition-all active:scale-95"
                        style={{ background: accent, boxShadow: `0 8px 25px ${accent}44` }}>
                        📋 YA ESTOY AQUÍ
                    </button>
                    {event.coords && (
                        <a href={`https://www.google.com/maps?q=${event.coords}`} target="_blank" rel="noopener noreferrer"
                            className="w-full max-w-xs px-8 py-3 rounded-xl text-sm font-bold tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2"
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            📍 CÓMO LLEGAR
                        </a>
                    )}
                </div>
            </section>

            {/* ==========================================
                SECTION 2: CONFIRMED COUNT
                ========================================== */}
            {contacts.length > 0 && (
                <section className="px-4 py-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-center text-sm mb-4" style={{ color: accent }}>
                        📋 {contacts.length} {contacts.length === 1 ? 'asistente registrado' : 'asistentes registrados'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                        {contacts.slice(0, 30).map(c => (
                            <div key={c.id} className="flex flex-col items-center gap-0.5">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}33` }}>
                                    {getInitials(c.name)}
                                </div>
                                <span className="text-[0.55rem] text-white/40 max-w-[50px] truncate">{c.name.split(' ')[0]}</span>
                            </div>
                        ))}
                        {contacts.length > 30 && (
                            <div className="flex items-center">
                                <span className="text-xs text-white/30">+{contacts.length - 30} más</span>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ==========================================
                SECTION 3: HOW-TO
                ========================================== */}
            <section className="px-4 py-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto text-center">
                    {[
                        { emoji: '📸', step: '1. Captura', desc: 'Toma fotos y videos' },
                        { emoji: '⬆️', step: '2. Sube', desc: 'Presiona "+" para subir' },
                        { emoji: '🎉', step: '3. Comparte', desc: 'Todo queda en el álbum' },
                    ].map((s, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${accent}15` }}>
                                <span className="text-lg">{s.emoji}</span>
                            </div>
                            <p className="text-xs font-bold" style={{ color: accent }}>{s.step}</p>
                            <p className="text-[0.6rem] leading-tight text-white/30">{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ==========================================
                SECTION 4: ALBUM HEADER
                ========================================== */}
            <section className="sticky top-0 z-40 px-4 py-3"
                style={{ background: 'rgba(15,17,23,0.97)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">📸 Álbum</span>
                        <span className="text-xs text-white/30">
                            {media.filter(m => m.type === 'photo').length} fotos · {media.filter(m => m.type === 'video').length} videos
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowQR(true)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}25` }}>
                            QR
                        </button>
                        <button onClick={downloadAll} disabled={isDownloading || media.length === 0}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-40"
                            style={{ background: accent }}>
                            {isDownloading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                            Descargar
                        </button>
                    </div>
                </div>
                <div className="flex gap-1.5 mt-2 max-w-5xl mx-auto">
                    {(['all', 'photos', 'videos'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{
                                background: filter === f ? `${accent}20` : 'transparent',
                                color: filter === f ? accent : 'rgba(255,255,255,0.3)',
                                border: filter === f ? `1px solid ${accent}30` : '1px solid transparent',
                            }}>
                            {f === 'all' ? 'Todo' : f === 'photos' ? 'Fotos' : 'Videos'}
                        </button>
                    ))}
                </div>
            </section>

            {/* ==========================================
                SECTION 5: GALLERY GRID
                ========================================== */}
            <main className="px-3 py-4 pb-28 max-w-5xl mx-auto">
                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-10 h-10 border-3 rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
                    </div>
                ) : filteredMedia.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-4xl mb-3 opacity-30">📷</div>
                        <p className="text-white/30">No hay fotos aún</p>
                        <p className="text-sm mt-1 text-white/20">¡Sé el primero en subir una foto!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 sm:gap-2">
                        {filteredMedia.map((item, index) => (
                            <div key={item.id} onClick={() => setSelectedIndex(index)}
                                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group">
                                {item.type === 'video' ? (
                                    <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata"
                                        onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.5 }} />
                                ) : (
                                    <img src={item.url} alt="" loading="lazy"
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                )}
                                {item.type === 'video' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${accent}cc` }}>
                                            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
                    <div className="absolute bottom-16 right-0 rounded-xl p-2 mb-1 flex flex-col gap-0.5 min-w-[160px] shadow-xl"
                        style={{ background: '#2a1520', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button onClick={() => { fileInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/5">📸 Foto</button>
                        <button onClick={() => { videoInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/5">🎥 Video</button>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '2px 0' }} />
                        <button onClick={() => { galleryInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/5">🖼️ Galería</button>
                    </div>
                )}

                <button onClick={() => setShowUploadOptions(!showUploadOptions)} disabled={isUploading}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-90 disabled:opacity-50"
                    style={{ background: accent, boxShadow: `0 4px 20px ${accent}66` }}>
                    {isUploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>}
                </button>
            </div>

            {/* ==========================================
                FOOTER
                ========================================== */}
            <footer className="py-4 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Link href="https://soynexo.com" target="_blank"
                    className="text-xs inline-flex items-center gap-1.5 text-white/30">
                    Hecho con ❤️ por <strong className="text-white/50">Soy Nexo</strong>
                </Link>
            </footer>

            {/* ==========================================
                TOASTS
                ========================================== */}
            {uploadSuccess && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-5 py-3 text-sm text-white shadow-lg"
                    style={{ background: 'rgba(22,163,74,0.95)', backdropFilter: 'blur(8px)' }}>
                    ✅ ¡Foto añadida al álbum!
                </div>
            )}
            {rsvpSuccess && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-5 py-3 text-sm text-white shadow-lg"
                    style={{ background: `${accent}ee`, backdropFilter: 'blur(8px)' }}>
                    ✅ ¡Registro exitoso!
                </div>
            )}
            {uploadError && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-white shadow-lg"
                    style={{ background: 'rgba(220,38,38,0.95)', backdropFilter: 'blur(8px)' }}>
                    ⚠️ {uploadError}
                    <button onClick={() => setUploadError(null)} className="ml-1 text-white/70 hover:text-white text-lg">×</button>
                </div>
            )}

            {/* ==========================================
                RSVP MODAL
                ========================================== */}
            {showRSVP && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}
                    onClick={() => setShowRSVP(false)}>
                    <div className="rounded-2xl p-5 w-full max-w-sm" style={{ background: '#2a1520', border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-0.5">📋 Registro de Asistencia</h3>
                        <p className="text-xs text-white/40 mb-5">Registra tu presencia en el evento</p>

                        {/* Name */}
                        <label className="text-[0.65rem] font-bold text-white/40 tracking-wider uppercase mb-1 block">Nombre completo *</label>
                        <input type="text" value={rsvpName} onChange={(e) => setRsvpName(e.target.value)}
                            placeholder="Ej. María García" autoFocus
                            className="w-full px-3.5 py-3 rounded-xl mb-3 text-sm outline-none text-white placeholder-white/20"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />

                        {/* WhatsApp */}
                        <label className="text-[0.65rem] font-bold text-white/40 tracking-wider uppercase mb-1 block">WhatsApp *</label>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-white/40 text-sm flex-shrink-0">🇲🇽 +52</span>
                            <input type="tel" value={rsvpPhone} onChange={(e) => setRsvpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                placeholder="10 dígitos" inputMode="numeric" maxLength={10}
                                className="flex-1 px-3.5 py-3 rounded-xl text-sm outline-none text-white placeholder-white/20"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                        </div>

                        {/* Colonia (optional, subtle) */}
                        <label className="text-[0.65rem] font-bold text-white/20 tracking-wider uppercase mb-1 block">Colonia <span className="text-white/15">(opcional)</span></label>
                        <input type="text" value={rsvpColonia} onChange={(e) => setRsvpColonia(e.target.value)}
                            placeholder="Ej. Centro"
                            className="w-full px-3.5 py-3 rounded-xl mb-5 text-sm outline-none text-white placeholder-white/15"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }} />

                        <div className="flex gap-2">
                            <button onClick={() => setShowRSVP(false)}
                                className="flex-1 py-3 rounded-xl text-xs font-medium text-white/50"
                                style={{ background: 'rgba(255,255,255,0.05)' }}>
                                Cancelar
                            </button>
                            <button onClick={handleRSVPSubmit} disabled={isSubmittingRSVP || !rsvpName.trim() || rsvpPhone.replace(/\D/g, '').length !== 10}
                                className="flex-1 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-30 transition-all"
                                style={{ background: accent }}>
                                {isSubmittingRSVP ? 'Registrando...' : '¡Registrarme! ✅'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* ==========================================
                FULL-SCREEN VIEWER
                ========================================== */}
            {selectedMedia && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.97)' }}
                    onClick={() => setSelectedIndex(null)}>
                    <button onClick={() => setSelectedIndex(null)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
                        style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    {selectedIndex! > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(p => p! - 1) }}
                            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center z-10"
                            style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    {selectedIndex! < filteredMedia.length - 1 && (
                        <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(p => p! + 1) }}
                            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center z-10"
                            style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}
                    <div className="max-w-4xl w-full px-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                        {selectedMedia.type === 'video' ? (
                            <video src={selectedMedia.url} controls autoPlay className="w-full max-h-[75vh] rounded-xl mx-auto" style={{ objectFit: 'contain' }} />
                        ) : (
                            <img src={selectedMedia.url} alt="" className="w-full max-h-[75vh] rounded-xl mx-auto" style={{ objectFit: 'contain' }} />
                        )}
                    </div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full px-4 py-2.5"
                        style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
                        <span className="text-white/40 text-xs">{selectedIndex! + 1}/{filteredMedia.length}</span>
                        <div className="w-px h-3 bg-white/15" />
                        <button onClick={(e) => { e.stopPropagation(); downloadFile(selectedMedia) }}
                            className="text-white/70 text-xs flex items-center gap-1.5 hover:text-white">
                            ⬇️ Descargar
                        </button>
                        <div className="w-px h-3 bg-white/15" />
                        <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true) }}
                            className="text-red-400 text-xs flex items-center gap-1.5 hover:text-red-300">
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            )}

            {/* ==========================================
                DELETE MODAL
                ========================================== */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
                    onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError('') }}>
                    <div className="rounded-2xl p-5 w-full max-w-xs" style={{ background: '#2a1520' }} onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-1">🗑️ Eliminar</h3>
                        <p className="text-xs text-white/40 mb-3">Ingresa la contraseña</p>
                        <input type="password" value={deletePassword}
                            onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                            placeholder="Contraseña" autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                            className="w-full px-3 py-2.5 rounded-lg mb-2 text-sm outline-none text-white placeholder-white/20"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                        {deleteError && <p className="text-red-400 text-xs mb-2">{deleteError}</p>}
                        <div className="flex gap-2">
                            <button onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError('') }}
                                className="flex-1 py-2.5 rounded-lg text-xs text-white/40" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancelar</button>
                            <button onClick={handleDelete} disabled={isDeleting}
                                className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white" style={{ background: '#dc2626' }}>
                                {isDeleting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                QR MODAL
                ========================================== */}
            {showQR && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}
                    onClick={() => setShowQR(false)}>
                    <div className="rounded-2xl p-6 w-full max-w-xs text-center relative" style={{ background: '#2a1520', border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowQR(false)}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/40"
                            style={{ background: 'rgba(255,255,255,0.05)' }}>✕</button>
                        <h2 className="text-lg font-bold text-white mb-1">📸 ¡Comparte!</h2>
                        <p className="text-xs text-white/40 mb-4">Escanea para subir fotos del evento</p>
                        <div className="bg-white p-4 rounded-xl inline-block mb-4">
                            <QRCodeSVG value={uploadUrl} size={180} level="H" fgColor="#2a1520" />
                        </div>
                        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <p className="font-mono text-xs break-all text-white/60">{uploadUrl}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
