'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, getDocs, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { QRCodeSVG } from 'qrcode.react'
import { analyzeImageContent, validateFileBasics } from '@/lib/contentModeration'
import Link from 'next/link'

// ==========================================
// TYPES
// ==========================================
interface EventConfig {
    id: string
    title: string
    date: string
    location: string
    coords?: string
    coverImage?: string
    theme?: {
        accentColor: string
        backgroundColor: string
        textColor: string
    }
}

interface MediaItem {
    id: string
    url: string
    type: 'photo' | 'video'
    timestamp: number
    fileName?: string
    senderName?: string
}

const DEFAULT_CONFIG: EventConfig = {
    id: 'demo-evento',
    title: 'Experiencia Soy Nexo',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    location: 'Salón Premium Soy Nexo, CDMX',
    coords: '19.432608,-99.133209', // CDMX Zocalo
    coverImage: '/demo-hero.png',
    theme: {
        accentColor: '#BCA872', // Gold
        backgroundColor: '#0F0F12', // Rich black
        textColor: '#FFFFFF'
    }
}

export default function PremiumEventPage() {
    const params = useParams()
    const rawSlug = params['slug-evento']
    const slug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) || 'demo'

    // Configure the delete password for this route
    const DELETE_PASSWORD = "admin123"

    const [config, setConfig] = useState<EventConfig>(DEFAULT_CONFIG)
    const [media, setMedia] = useState<MediaItem[]>([])
    const [isConfigLoaded, setIsConfigLoaded] = useState(false)

    // UI State
    const [filter, setFilter] = useState<'all' | 'photos' | 'videos'>('all')
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [showQR, setShowQR] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadSuccess, setUploadSuccess] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [showUploadOptions, setShowUploadOptions] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)

    // Delete State
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [deleteError, setDeleteError] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    // RSVP Chatbot State
    const [showRSVP, setShowRSVP] = useState(false)
    const [chatStep, setChatStep] = useState(0)
    const [rsvpData, setRsvpData] = useState({ name: '', guests: '', phone: '' })
    const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Countdown State
    const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

    const fileInputRef = useRef<HTMLInputElement>(null)
    const videoInputRef = useRef<HTMLInputElement>(null)
    const galleryInputRef = useRef<HTMLInputElement>(null)

    // Generate Upload URL
    const [uploadUrl, setUploadUrl] = useState('')
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUploadUrl(`${window.location.origin}/${slug}`)
        }
    }, [slug])

    // Load Event Data from Firebase
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const q = query(collection(db, 'events', slug, 'config'))
                const snapshot = await getDocs(q)
                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data() as Partial<EventConfig>
                    setConfig(prev => ({ ...prev, ...data }))
                }
            } catch (error) {
                console.error("Config load error", error)
            } finally {
                setIsConfigLoaded(true)
            }
        }
        loadConfig()
    }, [slug])

    // Countdown Timer Logic
    useEffect(() => {
        if (!config.date) return
        const eventDate = new Date(config.date).getTime()

        const tick = () => {
            const now = new Date().getTime()
            const diff = eventDate - now
            if (diff <= 0) {
                setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 })
                return
            }
            setCountdown({
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((diff / 1000 / 60) % 60),
                seconds: Math.floor((diff / 1000) % 60)
            })
        }
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [config.date])

    // Real-time Media Sync
    useEffect(() => {
        const mediaRef = collection(db, 'events', slug, 'media')
        const q = query(mediaRef, orderBy('timestamp', 'desc'))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const firebaseMedia: MediaItem[] = snapshot.docs.map(doc => ({
                id: doc.id,
                url: doc.data().url,
                type: doc.data().type as 'photo' | 'video',
                timestamp: doc.data().timestamp?.toMillis() || Date.now(),
                fileName: doc.data().fileName
            }))
            setMedia(firebaseMedia)
            setIsLoading(false)
        }, (error) => {
            console.error('Firebase sync error:', error)
            setIsLoading(false)
        })
        return () => unsubscribe()
    }, [slug])

    // Auto-scroll chat
    useEffect(() => {
        if (showRSVP) {
            setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
        }
    }, [chatStep, showRSVP])

    const filteredMedia = media.filter(item => {
        if (filter === 'all') return true
        if (filter === 'photos') return item.type === 'photo'
        if (filter === 'videos') return item.type === 'video'
        return true
    })

    const selectedMedia = selectedIndex !== null ? filteredMedia[selectedIndex] : null

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedIndex === null) return
            if (e.key === 'Escape') setSelectedIndex(null)
            else if (e.key === 'ArrowRight') setSelectedIndex(p => p !== null && p < filteredMedia.length - 1 ? p + 1 : p)
            else if (e.key === 'ArrowLeft') setSelectedIndex(p => p !== null && p > 0 ? p - 1 : p)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedIndex, filteredMedia.length])

    // Download functionality
    const downloadFile = async (item: MediaItem) => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        if (isIOS) { window.open(item.url, '_blank'); return }

        try {
            const response = await fetch(item.url)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `soynexo-${slug}-${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Download failed:', error)
            window.open(item.url, '_blank')
        }
    }

    const downloadAll = async () => {
        setIsDownloading(true)
        try {
            for (const item of media) {
                await downloadFile(item)
                await new Promise(resolve => setTimeout(resolve, 500))
            }
        } finally {
            setIsDownloading(false)
        }
    }

    // Upload functionality
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setUploadError(null)
        setShowUploadOptions(false)

        const basicVal = validateFileBasics(file)
        if (!basicVal.valid) {
            setUploadError(basicVal.error || 'Error al validar archivo')
            return
        }

        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')
        if (!isImage && !isVideo) {
            setUploadError('Solo se permiten fotos y videos')
            return
        }

        setIsUploading(true)
        try {
            if (isImage) {
                const moderation = await analyzeImageContent(file)
                if (!moderation.isAppropriate) {
                    setUploadError(moderation.reason || '⚠️ Contenido no permitido')
                    setIsUploading(false)
                    resetInputs()
                    return
                }
            }

            const fileName = `${Date.now()}-${file.name}`
            const storageRef = ref(storage, `events/${slug}/${fileName}`)
            await uploadBytes(storageRef, file)
            const downloadURL = await getDownloadURL(storageRef)

            await addDoc(collection(db, 'events', slug, 'media'), {
                url: downloadURL,
                type: isVideo ? 'video' : 'photo',
                timestamp: serverTimestamp(),
                fileName: fileName
            })

            setUploadSuccess(true)
            setTimeout(() => setUploadSuccess(false), 3000)
        } catch (err) {
            console.error('Upload API error:', err)
            setUploadError('Ocurrió un error al subir el archivo.')
        } finally {
            setIsUploading(false)
            resetInputs()
        }
    }

    const resetInputs = () => {
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (videoInputRef.current) videoInputRef.current.value = ''
        if (galleryInputRef.current) galleryInputRef.current.value = ''
    }

    // Delete Media
    const handleDeleteMedia = async () => {
        if (deletePassword !== DELETE_PASSWORD) {
            setDeleteError('Contraseña incorrecta')
            return
        }
        if (!selectedMedia) return

        setIsDeleting(true)
        try {
            await deleteDoc(doc(db, 'events', slug, 'media', selectedMedia.id))
            if (selectedMedia.fileName) {
                const sRef = ref(storage, `events/${slug}/${selectedMedia.fileName}`)
                await deleteObject(sRef).catch(() => { })
            }
            setSelectedIndex(null)
            setShowDeleteModal(false)
            setDeletePassword('')
            setDeleteError('')
        } catch (err) {
            console.error("Error deleting doc", err)
            setDeleteError('No se pudo eliminar de la base de datos.')
        } finally {
            setIsDeleting(false)
        }
    }

    // RSVP Logic
    const submitRsvpToFirebase = async () => {
        setIsSubmittingRSVP(true)
        try {
            await addDoc(collection(db, 'events', slug, 'rsvps'), {
                name: rsvpData.name,
                guests: parseInt(rsvpData.guests) || 1,
                phone: rsvpData.phone,
                status: 'confirmed',
                timestamp: serverTimestamp()
            })
            setChatStep(5) // Move to Ticket View
        } catch (error) {
            console.error(error)
            alert("Error al confirmar asistencia. Intenta de nuevo.")
        } finally {
            setIsSubmittingRSVP(false)
        }
    }

    const accent = config.theme?.accentColor || '#BCA872'

    // ==========================================
    // RENDER
    // ==========================================
    if (!isConfigLoaded) return (
        <div className="min-h-screen flex items-center justify-center bg-[#0F0F12]">
            <div className="w-10 h-10 border-4 rounded-full animate-spin border-t-transparent" style={{ borderColor: accent }} />
        </div>
    )

    return (
        <div className="min-h-screen text-white pb-28" style={{ background: config.theme?.backgroundColor || '#0F0F12' }}>

            {/* --- HERO SECTION --- */}
            <section className="relative w-full aspect-[4/5] sm:aspect-video md:aspect-[21/9] overflow-hidden">
                <div className="absolute top-4 left-4 z-20">
                    <img src="/logo.png" alt="Soy Nexo" className="h-8 drop-shadow-lg opacity-90" />
                </div>

                {config.coverImage ? (
                    <img src={config.coverImage} alt={config.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1a1c22] to-[#0A0A0C] flex flex-col items-center justify-center p-6 text-center">
                        <h1 className="text-4xl sm:text-6xl font-black mb-4 tracking-tighter" style={{ color: accent }}>
                            {config.title}
                        </h1>
                        <p className="text-white/60 tracking-widest uppercase text-sm font-bold">Únete a la experiencia</p>
                    </div>
                )}

                <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0F0F12] via-[#0F0F12]/40 to-transparent" />

                <div className="absolute bottom-6 left-0 w-full z-20 px-6 text-center">
                    <p className="text-sm tracking-widest uppercase font-bold text-white/60 mb-1">Evento Exclusivo</p>
                    <h2 className="text-3xl font-bold mb-4">{config.title}</h2>

                    {/* RSVP & Directions Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
                        <button onClick={() => { setChatStep(0); setShowRSVP(true) }}
                            className="w-full py-4 rounded-full font-bold text-black text-sm uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 shadow-xl"
                            style={{ background: accent, boxShadow: `0 8px 25px ${accent}44` }}>
                            Mí Boleto VIP
                        </button>

                        {config.coords && (
                            <a href={`https://www.google.com/maps?q=${config.coords}`} target="_blank" rel="noopener noreferrer"
                                className="w-full py-4 rounded-full font-bold text-white text-sm uppercase tracking-widest transition-all hover:bg-white/10 active:scale-95 border border-white/20 backdrop-blur-md flex items-center justify-center gap-2">
                                📍 Cómo Llegar
                            </a>
                        )}
                    </div>
                </div>
            </section>

            {/* --- EVENT DETAILS & COUNTDOWN --- */}
            <section className="px-6 py-8 border-b border-white/5 bg-white/[0.02]">
                <div className="max-w-xl mx-auto flex flex-col items-center text-center">

                    {/* Date & Location */}
                    <div className="text-sm font-medium text-white/60 mb-6 space-y-2">
                        <p className="flex items-center justify-center gap-2">📅 {new Date(config.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p className="flex items-center justify-center gap-2">📍 {config.location}</p>
                    </div>

                    {/* Countdown */}
                    <div className="flex items-center justify-center gap-4 sm:gap-6">
                        {[
                            { label: 'DÍAS', value: countdown.days },
                            { label: 'HRS', value: countdown.hours },
                            { label: 'MIN', value: countdown.minutes },
                            { label: 'SEG', value: countdown.seconds },
                        ].map((time, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <div className="text-2xl sm:text-4xl font-light tabular-nums" style={{ color: accent }}>
                                    {time.value.toString().padStart(2, '0')}
                                </div>
                                <div className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-white/30 mt-1">
                                    {time.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- INSTRUCTIONS SECTION --- */}
            <section className="px-6 py-8 border-b border-white/5">
                <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
                    {[
                        { emoji: '📸', step: 'Captura', desc: 'Sube tus fotos' },
                        { emoji: '🪄', step: 'Magia', desc: 'Galería en vivo' },
                        { emoji: '🎉', step: 'Recuerda', desc: 'Descarga todo' }
                    ].map((s, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-white/5 border border-white/10"
                                style={{ boxShadow: `0 4px 15px ${accent}11` }}>
                                {s.emoji}
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider text-white/80">{s.step}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* --- ALBUM HEADER --- */}
            <section className="sticky top-0 z-30 px-4 py-4 backdrop-blur-xl bg-[#0F0F12]/80 border-b border-white/5">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-bold">Álbum</span>
                        <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded">
                            {media.length} archivos
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowQR(true)} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition">
                            📱
                        </button>
                        <button onClick={downloadAll} disabled={isDownloading || media.length === 0}
                            className="px-4 py-2 rounded-full text-xs font-bold text-black transition-transform active:scale-95 disabled:opacity-50"
                            style={{ background: accent }}>
                            {isDownloading ? 'Descargando...' : 'Descargar Todo'}
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 mt-4 max-w-5xl mx-auto overflow-x-auto pb-1 clip-scrollbar">
                    {(['all', 'photos', 'videos'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${filter === f ? `text-black border-transparent` : 'text-white/50 border-white/10 hover:border-white/30'
                                }`}
                            style={{ background: filter === f ? accent : 'transparent' }}>
                            {f === 'all' ? 'Ver Todo' : f === 'photos' ? 'Fotos📸' : 'Videos🎬'}
                        </button>
                    ))}
                </div>
            </section>

            {/* --- GALLERY GRID --- */}
            <main className="p-2 sm:p-4 max-w-6xl mx-auto">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 rounded-full animate-spin border-t-transparent" style={{ borderColor: accent }} />
                    </div>
                ) : filteredMedia.length === 0 ? (
                    <div className="text-center py-24 px-4 bg-white/5 rounded-3xl mx-2 border border-white/10 border-dashed">
                        <span className="text-5xl opacity-40 mb-4 block">😔</span>
                        <h3 className="text-xl font-bold mb-2">Aún no hay recuerdos</h3>
                        <p className="text-white/40 text-sm">Sé el primero en subir la magia del evento.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1 sm:gap-2">
                        {filteredMedia.map((item, index) => (
                            <div key={item.id} onClick={() => setSelectedIndex(index)}
                                className="relative aspect-[3/4] sm:aspect-square rounded-lg overflow-hidden cursor-pointer group bg-white/5">
                                {item.type === 'video' ? (
                                    <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata"
                                        onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.5 }} />
                                ) : (
                                    <img src={item.url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                )}
                                {item.type === 'video' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md bg-white/20 border border-white/30">
                                            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* --- FLOATING UPLOAD BUTTON --- */}
            <div className="fixed bottom-6 right-6 z-40">
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
                <input ref={videoInputRef} type="file" accept="video/*" capture="environment" onChange={handleFileUpload} className="hidden" />
                <input ref={galleryInputRef} type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />

                {showUploadOptions && (
                    <div className="absolute bottom-20 right-0 glass-strong rounded-2xl p-2 mb-2 flex flex-col gap-1 min-w-[160px] shadow-2xl bg-[#1A1A1F] border border-white/10 animate-fade-in origin-bottom-right">
                        <button onClick={() => { fileInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-white/10">
                            <span className="text-xl">📸</span> Tomar Foto
                        </button>
                        <button onClick={() => { videoInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-white/10">
                            <span className="text-xl">🎥</span> Grabar Video
                        </button>
                        <div className="border-t border-white/5 my-1" />
                        <button onClick={() => { galleryInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-white/10">
                            <span className="text-xl">🖼️</span> Subir de Galería
                        </button>
                    </div>
                )}

                <button onClick={() => setShowUploadOptions(!showUploadOptions)} disabled={isUploading}
                    className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-90 disabled:opacity-50"
                    style={{ background: accent, boxShadow: `0 10px 30px ${accent}66` }}>
                    {isUploading ? <div className="w-6 h-6 border-3 border-black/20 border-t-black rounded-full animate-spin" />
                        : <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>}
                </button>
            </div>

            {/* --- FULLSCREEN VIEWER --- */}
            {selectedMedia && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={() => setSelectedIndex(null)}>
                    <button onClick={() => setSelectedIndex(null)} className="absolute top-6 right-6 w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 z-10 transition">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {selectedIndex! > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(p => p! - 1) }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 z-10 transition">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    )}
                    {selectedIndex! < filteredMedia.length - 1 && (
                        <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(p => p! + 1) }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 z-10 transition">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    )}

                    <div className="max-w-4xl w-full px-4" onClick={(e) => e.stopPropagation()}>
                        {selectedMedia.type === 'video' ? (
                            <video src={selectedMedia.url} controls autoPlay className="w-full max-h-[85vh] rounded-2xl mx-auto shadow-2xl" style={{ objectFit: 'contain' }} />
                        ) : (
                            <img src={selectedMedia.url} alt="" className="w-full max-h-[85vh] rounded-2xl mx-auto shadow-2xl" style={{ objectFit: 'contain' }} />
                        )}
                    </div>

                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full px-6 py-3 bg-[#1A1A1F]/90 backdrop-blur-lg border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <span className="text-white/40 text-sm font-medium">{selectedIndex! + 1} de {filteredMedia.length}</span>
                        <div className="w-px h-4 bg-white/15" />
                        <button onClick={(e) => { e.stopPropagation(); downloadFile(selectedMedia) }}
                            className="text-white text-sm font-bold flex items-center gap-2 hover:opacity-70 transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Descargar
                        </button>
                        <div className="w-px h-4 bg-white/15" />
                        <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true) }}
                            className="text-red-400 text-sm font-bold flex items-center gap-2 hover:text-red-300 transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* --- DELETE MODAL --- */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError('') }}>
                    <div className="rounded-3xl p-6 w-full max-w-sm bg-[#1A1A1F] border border-white/10 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-2">Eliminar Archivo</h3>
                        <p className="text-sm text-white/50 mb-6">Ingresa la contraseña maestra.</p>
                        <input type="password" value={deletePassword}
                            onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                            placeholder="Contraseña..." autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleDeleteMedia()}
                            className="w-full px-4 py-3 rounded-xl mb-3 text-sm outline-none bg-white/5 border border-white/10 text-white" />
                        {deleteError && <p className="text-red-400 text-xs text-left mb-3 pl-1">{deleteError}</p>}
                        <div className="flex gap-3">
                            <button onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError('') }}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white/50 bg-white/5">Cancelar</button>
                            <button onClick={handleDeleteMedia} disabled={isDeleting}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500">
                                {isDeleting ? 'Borrando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- AI CONCIERGE RSVP MODAL --- */}
            {showRSVP && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowRSVP(false)}>
                    <div className="rounded-3xl p-6 max-w-sm w-full bg-[#1A1A1F] border border-white/10 shadow-2xl relative overflow-hidden flex flex-col min-h-[400px]" onClick={(e) => e.stopPropagation()}>

                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-white/5">💎</div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Conserje VIP</h3>
                                <p className="text-xs text-green-400">En línea</p>
                            </div>
                            <button onClick={() => setShowRSVP(false)} className="absolute top-6 right-6 text-white/30 hover:text-white/70">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 pb-4 clip-scrollbar flex flex-col gap-4">
                            <div className="mt-auto"></div>

                            {/* Step 0: Welcome */}
                            <div className="flex flex-col gap-1 w-[85%]">
                                <span className="text-[10px] text-white/30 ml-3">Conserje</span>
                                <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90">
                                    ¡Hola! Qué emoción verte por aquí. ¿Nos acompañarás este evento? 🎉
                                </div>
                            </div>

                            {chatStep === 0 && (
                                <div className="flex flex-col gap-2 mt-4 animate-fade-in-up">
                                    <button onClick={() => setChatStep(2)} className="py-3 px-4 rounded-xl text-sm font-bold text-black border border-transparent hover:scale-[1.02] transition-transform" style={{ background: accent }}>
                                        ¡Claro que sí! 🥳
                                    </button>
                                    <button onClick={() => setChatStep(1)} className="py-3 px-4 rounded-xl text-sm font-bold text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                        Lamentablemente no 😔
                                    </button>
                                </div>
                            )}

                            {/* Step 1: Denied */}
                            {chatStep === 1 && (
                                <div className="flex flex-col gap-1 w-[85%] mt-2 animate-fade-in">
                                    <span className="text-[10px] text-white/30 ml-3">Conserje</span>
                                    <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90">
                                        No te preocupes, ¡te extrañaremos mucho! Brindaremos por ti. 🥂
                                    </div>
                                    <button onClick={() => setShowRSVP(false)} className="mt-4 text-xs text-white/40 underline">Cerrar ventana</button>
                                </div>
                            )}

                            {/* Step 2: Name */}
                            {chatStep >= 2 && (
                                <div className="flex flex-col gap-1 w-[85%] self-end items-end animate-fade-in">
                                    <span className="text-[10px] text-white/30 mr-3">Tú</span>
                                    <div className="bg-accent-500/20 border border-accent-500/30 rounded-2xl rounded-tr-sm px-4 py-3 text-sm" style={{ color: accent }}>
                                        ¡Claro que sí! 🥳
                                    </div>
                                </div>
                            )}

                            {chatStep >= 2 && (
                                <div className="flex flex-col gap-1 w-[85%] mt-2 animate-fade-in">
                                    <span className="text-[10px] text-white/30 ml-3">Conserje</span>
                                    <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90">
                                        ¡Excelente! Para anotarte en la lista VIP, ¿me podrías dar tu nombre y apellido?
                                    </div>
                                </div>
                            )}

                            {chatStep === 2 && (
                                <form onSubmit={(e) => { e.preventDefault(); if (rsvpData.name.trim()) setChatStep(3) }} className="flex gap-2 mt-2 animate-fade-in-up">
                                    <input type="text" autoFocus placeholder="Escribe tu nombre..." value={rsvpData.name} onChange={e => setRsvpData({ ...rsvpData, name: e.target.value })}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white outline-none focus:border-white/30" />
                                    <button type="submit" disabled={!rsvpData.name.trim()} className="w-10 h-10 rounded-full flex items-center justify-center text-black disabled:opacity-50" style={{ background: accent }}>↑</button>
                                </form>
                            )}

                            {/* Step 3: Guests */}
                            {chatStep >= 3 && (
                                <div className="flex flex-col gap-1 w-[85%] self-end items-end animate-fade-in">
                                    <div className="bg-accent-500/20 border border-accent-500/30 rounded-2xl rounded-tr-sm px-4 py-3 text-sm" style={{ color: accent }}>
                                        {rsvpData.name}
                                    </div>
                                </div>
                            )}

                            {chatStep >= 3 && (
                                <div className="flex flex-col gap-1 w-[85%] mt-2 animate-fade-in">
                                    <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90">
                                        ¡Anotado! Y dime, ¿cuántos adultos te acompañan en total (incluyéndote a ti)?
                                    </div>
                                </div>
                            )}

                            {chatStep === 3 && (
                                <div className="grid grid-cols-4 gap-2 mt-2 animate-fade-in-up">
                                    {[1, 2, 3, 4].map(num => (
                                        <button key={num} onClick={() => { setRsvpData({ ...rsvpData, guests: num.toString() }); setChatStep(4) }}
                                            className="bg-white/5 border border-white/10 rounded-xl py-3 text-sm font-bold hover:bg-white/10 transition-colors">
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Step 4: Phone */}
                            {chatStep >= 4 && (
                                <div className="flex flex-col gap-1 w-[85%] self-end items-end animate-fade-in">
                                    <div className="bg-accent-500/20 border border-accent-500/30 rounded-2xl rounded-tr-sm px-4 py-3 text-sm" style={{ color: accent }}>
                                        {rsvpData.guests} personas
                                    </div>
                                </div>
                            )}

                            {chatStep >= 4 && (
                                <div className="flex flex-col gap-1 w-[85%] mt-2 animate-fade-in">
                                    <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90">
                                        Perfecto. Por último, regálame tu número de WhatsApp (10 dígitos) para mandarte detalles si es necesario.
                                    </div>
                                </div>
                            )}

                            {chatStep === 4 && (
                                <form onSubmit={(e) => { e.preventDefault(); if (rsvpData.phone.length === 10 && !isSubmittingRSVP) submitRsvpToFirebase() }} className="flex gap-2 mt-2 animate-fade-in-up">
                                    <input type="tel" autoFocus placeholder="10 dígitos numéricos..." maxLength={10} value={rsvpData.phone} onChange={e => setRsvpData({ ...rsvpData, phone: e.target.value.replace(/\D/g, '') })}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white outline-none focus:border-white/30" />
                                    <button type="submit" disabled={rsvpData.phone.length !== 10 || isSubmittingRSVP} className="w-10 h-10 rounded-full flex items-center justify-center text-black disabled:opacity-50" style={{ background: accent }}>
                                        {isSubmittingRSVP ? '...' : '↑'}
                                    </button>
                                </form>
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Step 5: The Ticket View */}
                        {chatStep === 5 && (
                            <div className="absolute inset-0 z-10 bg-[#1A1A1F] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                                <button onClick={() => setShowRSVP(false)} className="absolute top-4 right-4 text-white/30">✕</button>

                                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Acceso Confirmado</p>
                                <h3 className="text-2xl font-bold mb-8" style={{ color: accent }}>¡Nos vemos en la fiesta!</h3>

                                <div className="bg-white p-4 rounded-3xl shadow-[0_0_40px_rgba(188,168,114,0.15)] mb-8">
                                    <QRCodeSVG value={`VIP-${rsvpData.phone}`} size={160} level="M" includeMargin={false} />
                                </div>

                                <div className="w-full space-y-3">
                                    <div className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 flex justify-between text-sm">
                                        <span className="text-white/40">Nombre</span>
                                        <span className="font-bold">{rsvpData.name}</span>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 flex justify-between text-sm">
                                        <span className="text-white/40">Estatus</span>
                                        <span className="font-bold text-green-400">VIP Listo</span>
                                    </div>

                                    <button onClick={() => setShowRSVP(false)} className="w-full mt-4 py-3 rounded-full font-bold text-black shadow-lg" style={{ background: accent }}>
                                        Volver al Evento
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* --- QR SHARING MODAL --- */}
            {showQR && (
                <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
                    <div className="rounded-3xl p-8 max-w-sm w-full text-center bg-[#1A1A1F] border border-white/10 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 text-white/30">✕</button>
                        <h2 className="text-2xl font-bold text-white mb-2">Escanea y Sube</h2>
                        <div className="bg-white p-6 rounded-2xl inline-block mb-8 mt-4"><QRCodeSVG value={uploadUrl} size={180} level="H" includeMargin={false} /></div>
                    </div>
                </div>
            )}

            <footer className="text-center py-6 border-t border-white/5 opacity-50 text-xs">
                Generado con 🖤 por <strong className="text-white">Soy Nexo</strong>
            </footer>
        </div>
    )
}
