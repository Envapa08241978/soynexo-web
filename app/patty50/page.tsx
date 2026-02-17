'use client'

import { useState, useRef, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { QRCodeSVG } from 'qrcode.react'
import { analyzeImageContent, validateFileBasics } from '@/lib/contentModeration'
import Link from 'next/link'

/* ================================================================
   TYPES
   ================================================================ */
interface MediaItem {
    id: string
    url: string
    type: 'photo' | 'video'
    timestamp: number
    fileName?: string
}

interface RSVPItem {
    id: string
    name: string
    photoUrl: string
    timestamp: number
}

/* ================================================================
   CONSTANTS
   ================================================================ */
const EVENT_SLUG = 'patty50'
const DELETE_PASSWORD = 'patty50'

/* ================================================================
   MAIN COMPONENT — SINGLE CONTINUOUS PAGE
   Like yoselyn-ariosto-boda but with custom Patty design
   ================================================================ */
export default function Patty50Page() {
    // --- Media state ---
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

    // --- Delete state ---
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [deleteError, setDeleteError] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    // --- RSVP state ---
    const [rsvpList, setRsvpList] = useState<RSVPItem[]>([])
    const [showRSVP, setShowRSVP] = useState(false)
    const [rsvpName, setRsvpName] = useState('')
    const [rsvpPhoto, setRsvpPhoto] = useState<File | null>(null)
    const [rsvpPhotoPreview, setRsvpPhotoPreview] = useState<string | null>(null)
    const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false)
    const [rsvpSuccess, setRsvpSuccess] = useState(false)
    const rsvpFileRef = useRef<HTMLInputElement>(null)

    const [uploadUrl, setUploadUrl] = useState('')
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUploadUrl(`${window.location.origin}/${EVENT_SLUG}`)
        }
    }, [])

    /* ---- Firebase: Media real-time sync ---- */
    useEffect(() => {
        const mediaRef = collection(db, 'events', EVENT_SLUG, 'media')
        const q = query(mediaRef, orderBy('timestamp', 'desc'))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: MediaItem[] = snapshot.docs.map(d => ({
                id: d.id,
                url: d.data().url,
                type: d.data().type as 'photo' | 'video',
                timestamp: d.data().timestamp?.toMillis() || Date.now(),
                fileName: d.data().fileName
            }))
            setMedia(items)
            setIsLoading(false)
        }, (err) => {
            console.error('Firebase sync error:', err)
            setIsLoading(false)
        })
        return () => unsubscribe()
    }, [])

    /* ---- Firebase: RSVP real-time sync ---- */
    useEffect(() => {
        const rsvpRef = collection(db, 'events', EVENT_SLUG, 'rsvp')
        const q = query(rsvpRef, orderBy('timestamp', 'desc'))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRsvpList(snapshot.docs.map(d => ({
                id: d.id,
                name: d.data().name,
                photoUrl: d.data().photoUrl,
                timestamp: d.data().timestamp?.toMillis() || Date.now()
            })))
        })
        return () => unsubscribe()
    }, [])

    /* ---- Filtered media ---- */
    const filteredMedia = media.filter(item => {
        if (filter === 'all') return true
        if (filter === 'photos') return item.type === 'photo'
        if (filter === 'videos') return item.type === 'video'
        return true
    })
    const selectedMedia = selectedIndex !== null ? filteredMedia[selectedIndex] : null

    /* ---- Keyboard nav for viewer ---- */
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
            a.download = `patty50-${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`
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
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        setUploadError(null)
        setShowUploadOptions(false)

        const basicVal = validateFileBasics(file)
        if (!basicVal.valid) { setUploadError(basicVal.error || 'Error de validación'); return }

        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')
        if (!isImage && !isVideo) { setUploadError('Solo se permiten fotos y videos'); return }

        setIsUploading(true)
        try {
            if (isImage) {
                const mod = await analyzeImageContent(file)
                if (!mod.isAppropriate) {
                    setUploadError(mod.reason || 'Contenido no permitido')
                    setIsUploading(false)
                    resetFileInputs()
                    return
                }
            }
            const fileName = `${Date.now()}-${file.name}`
            const storageRef = ref(storage, `events/${EVENT_SLUG}/${fileName}`)
            await uploadBytes(storageRef, file)
            const downloadURL = await getDownloadURL(storageRef)
            await addDoc(collection(db, 'events', EVENT_SLUG, 'media'), {
                url: downloadURL, type: isVideo ? 'video' : 'photo', timestamp: serverTimestamp(), fileName
            })
            setUploadSuccess(true)
            setTimeout(() => setUploadSuccess(false), 3000)
        } catch (err) {
            console.error('Upload error:', err)
            setUploadError('Error al subir. Intenta de nuevo.')
        } finally {
            setIsUploading(false)
            resetFileInputs()
        }
    }

    const resetFileInputs = () => {
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (videoInputRef.current) videoInputRef.current.value = ''
        if (galleryInputRef.current) galleryInputRef.current.value = ''
    }

    /* ---- Delete with password ---- */
    const handleDelete = async () => {
        if (deletePassword !== DELETE_PASSWORD) { setDeleteError('Contraseña incorrecta'); return }
        if (!selectedMedia) return
        setIsDeleting(true)
        try {
            await deleteDoc(doc(db, 'events', EVENT_SLUG, 'media', selectedMedia.id))
            if (selectedMedia.fileName) {
                const sRef = ref(storage, `events/${EVENT_SLUG}/${selectedMedia.fileName}`)
                await deleteObject(sRef).catch(() => { })
            }
            setSelectedIndex(null)
            setShowDeleteModal(false)
            setDeletePassword('')
            setDeleteError('')
        } catch { setDeleteError('Error al eliminar') }
        finally { setIsDeleting(false) }
    }

    /* ---- RSVP: photo goes to BOTH rsvp collection AND media album ---- */
    const handleRSVPSubmit = async () => {
        if (!rsvpName.trim() || !rsvpPhoto) return
        setIsSubmittingRSVP(true)
        try {
            const mod = await analyzeImageContent(rsvpPhoto)
            if (!mod.isAppropriate) {
                setUploadError(mod.reason || 'Foto no permitida')
                setIsSubmittingRSVP(false)
                return
            }
            const fileName = `rsvp-${Date.now()}-${rsvpPhoto.name}`
            const storageRef = ref(storage, `events/${EVENT_SLUG}/rsvp/${fileName}`)
            await uploadBytes(storageRef, rsvpPhoto)
            const photoUrl = await getDownloadURL(storageRef)

            // Save to RSVP collection
            await addDoc(collection(db, 'events', EVENT_SLUG, 'rsvp'), {
                name: rsvpName.trim(), photoUrl, timestamp: serverTimestamp(), confirmed: true
            })
            // ALSO save to media album so the selfie appears in the gallery
            await addDoc(collection(db, 'events', EVENT_SLUG, 'media'), {
                url: photoUrl, type: 'photo', timestamp: serverTimestamp(), fileName, rsvpName: rsvpName.trim()
            })

            setRsvpSuccess(true)
            setShowRSVP(false)
            setRsvpName('')
            setRsvpPhoto(null)
            setRsvpPhotoPreview(null)
            setTimeout(() => setRsvpSuccess(false), 4000)
        } catch (err) {
            console.error('RSVP error:', err)
            setUploadError('Error al confirmar. Intenta de nuevo.')
        } finally { setIsSubmittingRSVP(false) }
    }

    const handleRSVPPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setRsvpPhoto(file)
        const reader = new FileReader()
        reader.onload = (ev) => setRsvpPhotoPreview(ev.target?.result as string)
        reader.readAsDataURL(file)
    }

    /* ================================================================
       RENDER — SINGLE CONTINUOUS PAGE (like yoselyn-ariosto-boda)
       Hero Invitation → RSVP Confirmed → Instructions → Album
       ================================================================ */
    return (
        <div className="min-h-screen" style={{ background: '#F5F0E8', fontFamily: "'Georgia', 'Times New Roman', serif" }}>

            {/* ==========================================
                SECTION 1: HERO / INVITATION
                ========================================== */}
            <section className="relative px-4 pt-10 pb-8 text-center overflow-hidden">
                {/* Powered by */}
                <Link href="https://soynexo.com" target="_blank"
                    className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full text-xs"
                    style={{ color: '#8B7332', background: 'rgba(197,165,90,0.12)', border: '1px solid rgba(197,165,90,0.2)' }}>
                    Powered by <strong>Soy Nexo</strong>
                </Link>

                {/* Title Block */}
                <div className="max-w-sm mx-auto">
                    <p className="text-lg italic mb-2" style={{ color: '#777' }}>Celebra con nosotros</p>

                    <h1 className="leading-none" style={{
                        fontSize: 'clamp(3rem, 12vw, 5rem)', fontWeight: 900, letterSpacing: '0.06em',
                        background: 'linear-gradient(180deg, #D4AF37 0%, #8B7332 50%, #D4AF37 100%)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>PATTY</h1>

                    <h2 className="leading-none my-1" style={{
                        fontSize: 'clamp(3.5rem, 15vw, 6.5rem)', fontWeight: 900, letterSpacing: '0.04em',
                        background: 'linear-gradient(180deg, #C5A55A 0%, #8B7332 40%, #C5A55A 100%)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>50TH</h2>

                    <h3 className="leading-none" style={{
                        fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: 900, letterSpacing: '0.1em',
                        background: 'linear-gradient(180deg, #D4AF37 0%, #8B7332 50%, #D4AF37 100%)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>BIRTHDAY</h3>
                </div>

                {/* Decorative sparkles */}
                <div className="absolute top-12 left-4 text-xl opacity-30" style={{ color: '#8B7332' }}>✦</div>
                <div className="absolute top-20 right-6 text-sm opacity-25" style={{ color: '#8B7332' }}>✦</div>
                <div className="absolute top-40 left-8 text-base opacity-20" style={{ color: '#8B7332' }}>✦</div>
                <div className="absolute bottom-20 right-10 text-lg opacity-25" style={{ color: '#8B7332' }}>✦</div>
                <div className="absolute bottom-32 left-6 text-sm opacity-20" style={{ color: '#8B7332' }}>✦</div>

                {/* Disco Ball decorations - CSS */}
                <div className="absolute top-6 right-3 w-16 h-16 md:w-24 md:h-24 rounded-full opacity-60"
                    style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(200,200,200,0.3) 60%, rgba(180,180,180,0.5))', boxShadow: '0 0 20px rgba(255,255,255,0.15)' }} />
                <div className="absolute bottom-10 left-2 w-12 h-12 md:w-20 md:h-20 rounded-full opacity-50"
                    style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(200,200,200,0.3) 60%, rgba(180,180,180,0.5))', boxShadow: '0 0 15px rgba(255,255,255,0.1)' }} />

                {/* Event Details */}
                <div className="mt-8 space-y-1" style={{ color: '#444' }}>
                    <p className="text-sm font-bold tracking-[0.2em] uppercase">Sábado 28 de Febrero</p>
                    <p className="text-sm font-bold tracking-[0.2em] uppercase">Calle Corregidora</p>
                    <p className="text-lg font-black tracking-wider">7PM</p>
                    <p className="text-xs font-bold tracking-[0.2em] uppercase mt-2" style={{ color: '#8B7332' }}>Lleva tu bebida</p>
                </div>

                {/* RSVP Button */}
                <button onClick={() => setShowRSVP(true)}
                    className="mt-8 px-8 py-3.5 rounded-full text-sm font-bold tracking-wider transition-all active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #C5A55A, #8B7332)', color: '#FFF', boxShadow: '0 6px 20px rgba(139,115,50,0.3)' }}>
                    ✅ CONFIRMAR ASISTENCIA
                </button>
            </section>

            {/* ==========================================
                SECTION 2: CONFIRMED GUESTS (RSVP)
                ========================================== */}
            {rsvpList.length > 0 && (
                <section className="px-4 py-6">
                    <p className="text-center text-sm mb-4" style={{ color: '#8B7332', letterSpacing: '0.1em' }}>
                        🎉 {rsvpList.length} {rsvpList.length === 1 ? 'confirmado' : 'confirmados'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
                        {rsvpList.map(r => (
                            <div key={r.id} className="flex flex-col items-center gap-1">
                                <img src={r.photoUrl} alt={r.name}
                                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover"
                                    style={{ border: '2px solid #C5A55A', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                                <span className="text-[0.65rem] font-semibold max-w-[60px] truncate" style={{ color: '#555' }}>{r.name}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ==========================================
                SECTION 3: HOW-TO INSTRUCTIONS
                ========================================== */}
            <section className="px-4 py-6 border-t border-b" style={{ borderColor: 'rgba(139,115,50,0.12)' }}>
                <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto text-center">
                    {[
                        { emoji: '📸', step: '1. Captura', desc: 'Toma fotos y videos increíbles' },
                        { emoji: '⬆️', step: '2. Sube', desc: 'Presiona "+" y elige tus recuerdos' },
                        { emoji: '🥳', step: '3. Disfruta', desc: 'Todo se guarda en el álbum' },
                    ].map((s, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(197,165,90,0.12)' }}>
                                <span className="text-lg">{s.emoji}</span>
                            </div>
                            <p className="text-xs font-bold" style={{ color: '#8B7332' }}>{s.step}</p>
                            <p className="text-[0.6rem] leading-tight" style={{ color: '#888' }}>{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ==========================================
                SECTION 4: ALBUM HEADER
                ========================================== */}
            <section className="sticky top-0 z-40 border-b px-4 py-3"
                style={{ background: 'rgba(245,240,232,0.97)', backdropFilter: 'blur(10px)', borderColor: 'rgba(139,115,50,0.12)' }}>
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: '#333' }}>📸 Álbum</span>
                        <span className="text-xs" style={{ color: '#999' }}>
                            {media.filter(m => m.type === 'photo').length} fotos · {media.filter(m => m.type === 'video').length} videos
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowQR(true)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: 'rgba(139,115,50,0.1)', color: '#8B7332', border: '1px solid rgba(139,115,50,0.2)' }}>
                            QR
                        </button>
                        <button onClick={downloadAll} disabled={isDownloading || media.length === 0}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg, #C5A55A, #8B7332)' }}>
                            {isDownloading ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            )}
                            Descargar
                        </button>
                    </div>
                </div>
                {/* Filter tabs */}
                <div className="flex gap-1.5 mt-2 max-w-5xl mx-auto">
                    {(['all', 'photos', 'videos'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{
                                background: filter === f ? 'rgba(139,115,50,0.15)' : 'transparent',
                                color: filter === f ? '#8B7332' : '#999',
                                border: filter === f ? '1px solid rgba(139,115,50,0.25)' : '1px solid transparent',
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
                        <div className="w-10 h-10 border-3 rounded-full animate-spin" style={{ borderColor: '#C5A55A', borderTopColor: 'transparent' }} />
                    </div>
                ) : filteredMedia.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-4xl mb-3 opacity-30">📷</div>
                        <p style={{ color: '#999' }}>El álbum está vacío.</p>
                        <p className="text-sm mt-1" style={{ color: '#bbb' }}>¡Sé el primero en subir una foto!</p>
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
                                    <img src={item.url} alt="Foto" loading="lazy"
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                )}
                                {item.type === 'video' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,115,50,0.75)' }}>
                                            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="absolute bottom-2 right-2">
                                        <button onClick={(e) => { e.stopPropagation(); downloadFile(item) }}
                                            className="w-7 h-7 rounded-full flex items-center justify-center"
                                            style={{ background: 'rgba(197,165,90,0.8)' }}>
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
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
                        style={{ background: '#F5F0E8', border: '1px solid rgba(139,115,50,0.2)' }}>
                        <button onClick={() => { fileInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-black/5" style={{ color: '#333' }}>
                            📸 Foto
                        </button>
                        <button onClick={() => { videoInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-black/5" style={{ color: '#333' }}>
                            🎥 Video
                        </button>
                        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', margin: '2px 0' }} />
                        <button onClick={() => { galleryInputRef.current?.click(); setShowUploadOptions(false) }}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-black/5" style={{ color: '#333' }}>
                            🖼️ Galería
                        </button>
                    </div>
                )}

                <button onClick={() => setShowUploadOptions(!showUploadOptions)} disabled={isUploading}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-90 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #C5A55A, #8B7332)', boxShadow: '0 4px 20px rgba(139,115,50,0.4)' }}>
                    {isUploading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                    )}
                </button>
            </div>

            {/* ==========================================
                FOOTER
                ========================================== */}
            <footer className="py-4 text-center" style={{ background: 'rgba(139,115,50,0.04)' }}>
                <Link href="https://soynexo.com" target="_blank"
                    className="text-xs inline-flex items-center gap-1.5" style={{ color: '#8B7332' }}>
                    Hecho con ❤️ por <strong>Soy Nexo</strong>
                </Link>
            </footer>

            {/* ==========================================
                TOASTS
                ========================================== */}
            {uploadSuccess && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-white shadow-lg"
                    style={{ background: 'rgba(46,125,50,0.95)', backdropFilter: 'blur(8px)' }}>
                    ✅ ¡Foto añadida al álbum!
                </div>
            )}
            {rsvpSuccess && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-white shadow-lg"
                    style={{ background: 'rgba(139,115,50,0.95)', backdropFilter: 'blur(8px)' }}>
                    🎉 ¡Asistencia confirmada!
                </div>
            )}
            {uploadError && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-white shadow-lg"
                    style={{ background: 'rgba(183,28,28,0.95)', backdropFilter: 'blur(8px)' }}>
                    ⚠️ {uploadError}
                    <button onClick={() => setUploadError(null)} className="ml-1 text-white/70 hover:text-white text-lg leading-none">×</button>
                </div>
            )}

            {/* ==========================================
                FULL-SCREEN VIEWER
                ========================================== */}
            {selectedMedia && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(30,25,15,0.97)' }} onClick={() => setSelectedIndex(null)}>

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
                            <img src={selectedMedia.url} alt="Foto" className="w-full max-h-[75vh] rounded-xl mx-auto" style={{ objectFit: 'contain' }} />
                        )}
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full px-4 py-2.5"
                        style={{ background: 'rgba(245,240,232,0.12)', backdropFilter: 'blur(10px)' }}>
                        <span className="text-white/50 text-xs">{selectedIndex! + 1}/{filteredMedia.length}</span>
                        <div className="w-px h-3 bg-white/20" />
                        <button onClick={(e) => { e.stopPropagation(); downloadFile(selectedMedia) }}
                            className="text-white text-xs flex items-center gap-1.5 hover:text-yellow-300 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Descargar
                        </button>
                        <div className="w-px h-3 bg-white/20" />
                        <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true) }}
                            className="text-red-400 text-xs flex items-center gap-1.5 hover:text-red-300 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Eliminar
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
                    <div className="rounded-2xl p-5 w-full max-w-xs" style={{ background: '#F5F0E8' }} onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-1" style={{ color: '#333' }}>🗑️ Eliminar</h3>
                        <p className="text-xs mb-3" style={{ color: '#666' }}>Ingresa la contraseña</p>
                        <input type="password" value={deletePassword}
                            onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                            placeholder="Contraseña" autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                            className="w-full px-3 py-2.5 rounded-lg mb-2 text-sm outline-none"
                            style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(139,115,50,0.2)', color: '#333' }} />
                        {deleteError && <p className="text-red-500 text-xs mb-2">{deleteError}</p>}
                        <div className="flex gap-2">
                            <button onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError('') }}
                                className="flex-1 py-2.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(0,0,0,0.05)', color: '#666' }}>
                                Cancelar
                            </button>
                            <button onClick={handleDelete} disabled={isDeleting}
                                className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white" style={{ background: '#d32f2f' }}>
                                {isDeleting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                RSVP MODAL
                ========================================== */}
            {showRSVP && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
                    onClick={() => setShowRSVP(false)}>
                    <div className="rounded-2xl p-5 w-full max-w-xs" style={{ background: '#F5F0E8' }} onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-0.5" style={{ color: '#333' }}>✅ Confirmar Asistencia</h3>
                        <p className="text-xs mb-4" style={{ color: '#666' }}>Tu nombre y una selfie</p>

                        <input type="text" value={rsvpName} onChange={(e) => setRsvpName(e.target.value)}
                            placeholder="Tu nombre" autoFocus
                            className="w-full px-3 py-2.5 rounded-lg mb-3 text-sm outline-none"
                            style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(139,115,50,0.2)', color: '#333' }} />

                        <input ref={rsvpFileRef} type="file" accept="image/*" capture="user" onChange={handleRSVPPhotoSelect} className="hidden" />

                        {rsvpPhotoPreview ? (
                            <div className="relative mb-3">
                                <img src={rsvpPhotoPreview} alt="Selfie" className="w-full h-40 object-cover rounded-xl" />
                                <button onClick={() => { setRsvpPhoto(null); setRsvpPhotoPreview(null); if (rsvpFileRef.current) rsvpFileRef.current.value = '' }}
                                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white text-sm">×</button>
                            </div>
                        ) : (
                            <button onClick={() => rsvpFileRef.current?.click()}
                                className="w-full py-6 rounded-xl mb-3 flex flex-col items-center gap-1.5"
                                style={{ border: '2px dashed rgba(139,115,50,0.25)', color: '#8B7332' }}>
                                <span className="text-2xl">📸</span>
                                <span className="text-xs font-medium">Tomar Selfie</span>
                            </button>
                        )}

                        <div className="flex gap-2">
                            <button onClick={() => setShowRSVP(false)}
                                className="flex-1 py-2.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(0,0,0,0.05)', color: '#666' }}>
                                Cancelar
                            </button>
                            <button onClick={handleRSVPSubmit} disabled={isSubmittingRSVP || !rsvpName.trim() || !rsvpPhoto}
                                className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg, #C5A55A, #8B7332)' }}>
                                {isSubmittingRSVP ? 'Confirmando...' : '¡Confirmo! 🎉'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                QR MODAL
                ========================================== */}
            {showQR && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
                    onClick={() => setShowQR(false)}>
                    <div className="rounded-2xl p-6 w-full max-w-xs text-center relative" style={{ background: '#F5F0E8' }}
                        onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowQR(false)}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(139,115,50,0.1)', color: '#8B7332' }}>✕</button>
                        <h2 className="text-lg font-bold mb-1" style={{ color: '#333' }}>📸 ¡Comparte!</h2>
                        <p className="text-xs mb-4" style={{ color: '#666' }}>Sube fotos y videos de la fiesta</p>
                        <div className="bg-white p-4 rounded-xl inline-block mb-4">
                            <QRCodeSVG value={uploadUrl} size={180} level="H" fgColor="#333" />
                        </div>
                        <div className="rounded-lg p-3" style={{ background: 'rgba(139,115,50,0.08)' }}>
                            <p className="font-mono text-xs break-all" style={{ color: '#333' }}>{uploadUrl}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
