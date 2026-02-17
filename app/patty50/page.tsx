'use client'

import { useState, useRef, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { QRCodeSVG } from 'qrcode.react'
import { analyzeImageContent, validateFileBasics } from '@/lib/contentModeration'
import Link from 'next/link'

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

const EVENT_SLUG = 'patty50'
const EVENT_NAME = 'Patty 50th Birthday'
const EVENT_DATE = 'Sábado 28 de Febrero'
const EVENT_LOCATION = 'Calle Corregidora'
const EVENT_TIME = '7PM'
const DELETE_PASSWORD = 'patty50'

// ============================================
// DISCO BALL CSS COMPONENT
// ============================================
function DiscoBall({ className = '', size = 120 }: { className?: string; size?: number }) {
    return (
        <div className={className} style={{ width: size, height: size }}>
            <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 40%),
                    radial-gradient(circle at 70% 60%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 30%),
                    linear-gradient(135deg, #d4d4d4 0%, #a0a0a0 25%, #e8e8e8 50%, #b0b0b0 75%, #c8c8c8 100%)
                `,
                boxShadow: `
                    0 0 30px rgba(255,255,255,0.3),
                    inset 0 0 20px rgba(0,0,0,0.1),
                    0 8px 32px rgba(0,0,0,0.15)
                `,
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Mirror tiles effect */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    backgroundImage: `
                        repeating-conic-gradient(from 0deg, transparent 0deg, transparent 8deg, rgba(255,255,255,0.15) 8deg, rgba(255,255,255,0.15) 10deg),
                        repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(0,0,0,0.05) 8px, rgba(0,0,0,0.05) 9px),
                        repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(0,0,0,0.05) 8px, rgba(0,0,0,0.05) 9px)
                    `,
                }} />
            </div>
        </div>
    )
}

// ============================================
// SPARKLE DECORATIONS
// ============================================
function Sparkle({ style }: { style: React.CSSProperties }) {
    return (
        <span style={{
            position: 'absolute',
            color: '#333',
            fontSize: '1.2rem',
            opacity: 0.4,
            ...style,
        }}>✦</span>
    )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function Patty50Page() {
    // ---- State: Media ----
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
    const viewerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const videoInputRef = useRef<HTMLInputElement>(null)

    // ---- State: Delete ----
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [deleteError, setDeleteError] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    // ---- State: RSVP ----
    const [rsvpList, setRsvpList] = useState<RSVPItem[]>([])
    const [showRSVP, setShowRSVP] = useState(false)
    const [rsvpName, setRsvpName] = useState('')
    const [rsvpPhoto, setRsvpPhoto] = useState<File | null>(null)
    const [rsvpPhotoPreview, setRsvpPhotoPreview] = useState<string | null>(null)
    const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false)
    const [rsvpSuccess, setRsvpSuccess] = useState(false)
    const rsvpFileRef = useRef<HTMLInputElement>(null)

    // ---- State: Section ----
    const [activeSection, setActiveSection] = useState<'invitation' | 'album'>('invitation')

    const [uploadUrl, setUploadUrl] = useState('')
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUploadUrl(`${window.location.origin}/${EVENT_SLUG}`)
        }
    }, [])

    // ---- Firebase: Media sync ----
    useEffect(() => {
        const mediaRef = collection(db, 'events', EVENT_SLUG, 'media')
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
    }, [])

    // ---- Firebase: RSVP sync ----
    useEffect(() => {
        const rsvpRef = collection(db, 'events', EVENT_SLUG, 'rsvp')
        const q = query(rsvpRef, orderBy('timestamp', 'desc'))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rsvps: RSVPItem[] = snapshot.docs.map(d => ({
                id: d.id,
                name: d.data().name,
                photoUrl: d.data().photoUrl,
                timestamp: d.data().timestamp?.toMillis() || Date.now()
            }))
            setRsvpList(rsvps)
        })
        return () => unsubscribe()
    }, [])

    // ---- Filtered media ----
    const filteredMedia = media.filter(item => {
        if (filter === 'all') return true
        if (filter === 'photos') return item.type === 'photo'
        if (filter === 'videos') return item.type === 'video'
        return true
    })
    const selectedMedia = selectedIndex !== null ? filteredMedia[selectedIndex] : null

    // ---- Keyboard nav ----
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedIndex === null) return
            if (e.key === 'Escape') setSelectedIndex(null)
            else if (e.key === 'ArrowRight') {
                setSelectedIndex(prev => prev !== null && prev < filteredMedia.length - 1 ? prev + 1 : prev)
            } else if (e.key === 'ArrowLeft') {
                setSelectedIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedIndex, filteredMedia.length])

    // ---- Download ----
    const downloadFile = async (item: MediaItem) => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        if (isIOS) {
            window.open(item.url, '_blank')
        } else {
            try {
                const response = await fetch(item.url)
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `patty50-${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                window.URL.revokeObjectURL(url)
            } catch {
                window.open(item.url, '_blank')
            }
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

    // ---- Upload with content moderation ----
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        setUploadError(null)

        const basicValidation = validateFileBasics(file)
        if (!basicValidation.valid) {
            setUploadError(basicValidation.error || 'Error de validación')
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
                const moderationResult = await analyzeImageContent(file)
                if (!moderationResult.isAppropriate) {
                    setUploadError(moderationResult.reason || 'Contenido no permitido')
                    setIsUploading(false)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                    if (videoInputRef.current) videoInputRef.current.value = ''
                    return
                }
            }

            const fileName = `${Date.now()}-${file.name}`
            const storageRef = ref(storage, `events/${EVENT_SLUG}/${fileName}`)
            await uploadBytes(storageRef, file)
            const downloadURL = await getDownloadURL(storageRef)

            await addDoc(collection(db, 'events', EVENT_SLUG, 'media'), {
                url: downloadURL,
                type: isVideo ? 'video' : 'photo',
                timestamp: serverTimestamp(),
                fileName: fileName
            })

            setUploadSuccess(true)
            setTimeout(() => setUploadSuccess(false), 3000)
        } catch (err) {
            console.error('Upload error:', err)
            setUploadError('Error al subir. Intenta de nuevo.')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
            if (videoInputRef.current) videoInputRef.current.value = ''
        }
    }

    // ---- Delete with password ----
    const handleDelete = async () => {
        if (deletePassword !== DELETE_PASSWORD) {
            setDeleteError('Contraseña incorrecta')
            return
        }
        if (!selectedMedia) return

        setIsDeleting(true)
        try {
            // Delete from Firestore
            await deleteDoc(doc(db, 'events', EVENT_SLUG, 'media', selectedMedia.id))
            // Delete from Storage
            if (selectedMedia.fileName) {
                const storageRef = ref(storage, `events/${EVENT_SLUG}/${selectedMedia.fileName}`)
                await deleteObject(storageRef).catch(() => { })
            }
            setSelectedIndex(null)
            setShowDeleteModal(false)
            setDeletePassword('')
            setDeleteError('')
        } catch (err) {
            console.error('Delete error:', err)
            setDeleteError('Error al eliminar')
        } finally {
            setIsDeleting(false)
        }
    }

    // ---- RSVP Submit ----
    const handleRSVPSubmit = async () => {
        if (!rsvpName.trim()) return
        if (!rsvpPhoto) return

        setIsSubmittingRSVP(true)
        try {
            // Content moderation on selfie
            const moderationResult = await analyzeImageContent(rsvpPhoto)
            if (!moderationResult.isAppropriate) {
                setUploadError(moderationResult.reason || 'Foto no permitida')
                setIsSubmittingRSVP(false)
                return
            }

            const fileName = `rsvp-${Date.now()}-${rsvpPhoto.name}`
            const storageRef = ref(storage, `events/${EVENT_SLUG}/rsvp/${fileName}`)
            await uploadBytes(storageRef, rsvpPhoto)
            const photoUrl = await getDownloadURL(storageRef)

            await addDoc(collection(db, 'events', EVENT_SLUG, 'rsvp'), {
                name: rsvpName.trim(),
                photoUrl,
                timestamp: serverTimestamp(),
                confirmed: true
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
        } finally {
            setIsSubmittingRSVP(false)
        }
    }

    const handleRSVPPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setRsvpPhoto(file)
        const reader = new FileReader()
        reader.onload = (ev) => {
            setRsvpPhotoPreview(ev.target?.result as string)
        }
        reader.readAsDataURL(file)
    }

    // ==================================================
    // RENDER
    // ==================================================
    return (
        <div className="min-h-screen min-h-[100dvh] overflow-x-hidden" style={{ background: '#F5F0E8' }}>

            {/* ============ INVITATION HERO ============ */}
            {activeSection === 'invitation' && (
                <div className="relative px-6 py-12 md:py-20 flex flex-col items-center text-center overflow-hidden" style={{ minHeight: '100dvh' }}>

                    {/* Disco balls */}
                    <DiscoBall className="absolute top-8 left-4 md:left-16 opacity-80" size={90} />
                    <DiscoBall className="absolute top-20 right-4 md:right-12 opacity-70" size={110} />
                    <DiscoBall className="absolute bottom-32 left-8 md:left-20 opacity-60" size={70} />
                    <DiscoBall className="absolute bottom-16 right-6 md:right-16 opacity-75" size={95} />

                    {/* Sparkles */}
                    <Sparkle style={{ top: '15%', left: '20%' }} />
                    <Sparkle style={{ top: '10%', right: '30%', fontSize: '0.8rem' }} />
                    <Sparkle style={{ top: '25%', right: '15%' }} />
                    <Sparkle style={{ top: '40%', left: '10%', fontSize: '1.5rem' }} />
                    <Sparkle style={{ bottom: '40%', right: '8%' }} />
                    <Sparkle style={{ bottom: '25%', left: '25%', fontSize: '0.9rem' }} />
                    <Sparkle style={{ top: '55%', right: '25%', fontSize: '1.3rem' }} />
                    <Sparkle style={{ bottom: '15%', right: '35%', fontSize: '0.7rem' }} />

                    {/* Main content */}
                    <div className="relative z-10 max-w-lg mx-auto flex flex-col items-center gap-4 mt-12 md:mt-20">
                        {/* Script text */}
                        <p style={{
                            fontFamily: "'Georgia', 'Times New Roman', serif",
                            fontStyle: 'italic',
                            fontSize: '1.6rem',
                            color: '#555',
                            letterSpacing: '0.02em',
                        }}>Celebra con nosotros</p>

                        {/* PATTY */}
                        <h1 style={{
                            fontFamily: "'Georgia', 'Times New Roman', serif",
                            fontSize: '5rem',
                            fontWeight: 900,
                            letterSpacing: '0.08em',
                            lineHeight: 1,
                            background: 'linear-gradient(180deg, #C5A55A 0%, #8B7332 50%, #C5A55A 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>PATTY</h1>

                        {/* 50TH */}
                        <h2 style={{
                            fontFamily: "'Georgia', 'Times New Roman', serif",
                            fontSize: '6.5rem',
                            fontWeight: 900,
                            letterSpacing: '0.05em',
                            lineHeight: 0.9,
                            background: 'linear-gradient(180deg, #D4AF37 0%, #8B7332 40%, #D4AF37 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>50TH</h2>

                        {/* BIRTHDAY */}
                        <h3 style={{
                            fontFamily: "'Georgia', 'Times New Roman', serif",
                            fontSize: '3.5rem',
                            fontWeight: 900,
                            letterSpacing: '0.12em',
                            lineHeight: 1,
                            background: 'linear-gradient(180deg, #C5A55A 0%, #8B7332 50%, #C5A55A 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>BIRTHDAY</h3>

                        {/* Event details */}
                        <div className="mt-8 flex flex-col items-center gap-2" style={{ color: '#333', fontFamily: "'Georgia', serif" }}>
                            <p style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{EVENT_DATE}</p>
                            <p style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{EVENT_LOCATION}</p>
                            <p style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '0.1em' }}>{EVENT_TIME}</p>
                            <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '4px' }}>Lleva tu bebida</p>
                        </div>

                        {/* RSVP Button */}
                        <button
                            onClick={() => setShowRSVP(true)}
                            className="mt-10 px-10 py-4 rounded-full text-lg font-bold transition-all hover:scale-105 active:scale-95"
                            style={{
                                background: 'linear-gradient(135deg, #C5A55A, #8B7332)',
                                color: '#FFF',
                                boxShadow: '0 8px 24px rgba(139, 115, 50, 0.3)',
                                letterSpacing: '0.1em',
                            }}
                        >
                            ✅ CONFIRMAR ASISTENCIA
                        </button>

                        {/* Navigate to Album */}
                        <button
                            onClick={() => setActiveSection('album')}
                            className="mt-4 px-8 py-3 rounded-full text-sm font-medium transition-all hover:scale-105"
                            style={{
                                background: 'rgba(51,51,51,0.08)',
                                color: '#555',
                                border: '1px solid rgba(51,51,51,0.2)',
                            }}
                        >
                            📸 Ver Álbum de Fotos
                        </button>
                    </div>

                    {/* RSVP Confirmed Section */}
                    {rsvpList.length > 0 && (
                        <div className="relative z-10 mt-16 w-full max-w-2xl">
                            <h4 className="text-center mb-6" style={{
                                fontFamily: "'Georgia', serif",
                                fontSize: '1.3rem',
                                color: '#8B7332',
                                letterSpacing: '0.1em',
                            }}>
                                🎉 {rsvpList.length} {rsvpList.length === 1 ? 'invitado confirmado' : 'invitados confirmados'}
                            </h4>
                            <div className="flex flex-wrap justify-center gap-4">
                                {rsvpList.map(rsvp => (
                                    <div key={rsvp.id} className="flex flex-col items-center gap-2">
                                        <img
                                            src={rsvp.photoUrl}
                                            alt={rsvp.name}
                                            className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover"
                                            style={{
                                                border: '3px solid #C5A55A',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                            }}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: '#555', fontWeight: 600 }}>{rsvp.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* How to Use Instructions */}
                    <div className="relative z-10 mt-16 w-full max-w-md">
                        <p className="text-center mb-4" style={{ fontFamily: "'Georgia', serif", color: '#8B7332', fontSize: '1rem' }}>
                            ¿Cómo compartir tus fotos?
                        </p>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(197,165,90,0.15)' }}>
                                    <span className="text-xl">📸</span>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: '#666' }}>Toma fotos y videos</p>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(197,165,90,0.15)' }}>
                                    <span className="text-xl">⬆️</span>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: '#666' }}>Sube al álbum</p>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(197,165,90,0.15)' }}>
                                    <span className="text-xl">🥳</span>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: '#666' }}>¡Disfruta!</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer branding */}
                    <div className="relative z-10 mt-12">
                        <Link
                            href="https://soynexo.com"
                            target="_blank"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs transition-all hover:scale-105"
                            style={{ color: '#8B7332', background: 'rgba(197,165,90,0.1)', border: '1px solid rgba(197,165,90,0.2)' }}
                        >
                            Hecho con amor por Soy Nexo
                        </Link>
                    </div>
                </div>
            )}

            {/* ============ ALBUM SECTION ============ */}
            {activeSection === 'album' && (
                <>
                    {/* Header */}
                    <header className="sticky top-0 z-40 border-b" style={{
                        background: 'rgba(245, 240, 232, 0.95)',
                        backdropFilter: 'blur(10px)',
                        borderColor: 'rgba(139, 115, 50, 0.15)',
                    }}>
                        <div className="container mx-auto px-4 py-4">
                            <div className="flex items-center justify-between">
                                {/* Back + Event Info */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setActiveSection('invitation')}
                                        className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                                        style={{ background: 'rgba(139, 115, 50, 0.1)' }}
                                    >
                                        <svg className="w-5 h-5" style={{ color: '#8B7332' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <div>
                                        <h1 className="text-lg font-bold" style={{ color: '#333' }}>Álbum de Patty</h1>
                                        <p className="text-xs" style={{ color: '#8B7332' }}>50th Birthday • Fotos y Videos</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3">
                                    <div className="hidden sm:flex items-center gap-2 text-sm" style={{ color: '#666' }}>
                                        <span>{media.filter(m => m.type === 'photo').length} fotos</span>
                                        <span style={{ color: '#ccc' }}>•</span>
                                        <span>{media.filter(m => m.type === 'video').length} videos</span>
                                    </div>

                                    <button
                                        onClick={() => setShowQR(true)}
                                        className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                                        style={{ background: 'rgba(139, 115, 50, 0.1)', color: '#8B7332', border: '1px solid rgba(139, 115, 50, 0.2)' }}
                                    >QR</button>

                                    <button
                                        onClick={downloadAll}
                                        disabled={isDownloading || media.length === 0}
                                        className="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                                        style={{ background: 'linear-gradient(135deg, #C5A55A, #8B7332)', color: '#FFF' }}
                                    >
                                        {isDownloading ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        )}
                                        Descargar
                                    </button>
                                </div>
                            </div>

                            {/* Filter */}
                            <div className="flex gap-2 mt-4">
                                {(['all', 'photos', 'videos'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                        style={{
                                            background: filter === f ? 'rgba(139, 115, 50, 0.15)' : 'transparent',
                                            color: filter === f ? '#8B7332' : '#888',
                                            border: filter === f ? '1px solid rgba(139, 115, 50, 0.3)' : '1px solid transparent',
                                        }}
                                    >
                                        {f === 'all' ? 'Todo' : f === 'photos' ? 'Fotos' : 'Videos'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </header>

                    {/* Gallery Grid */}
                    <main className="container mx-auto px-4 py-6 pb-40">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center">
                                    <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#C5A55A', borderTopColor: 'transparent' }} />
                                    <p style={{ color: '#8B7332' }}>Cargando álbum...</p>
                                </div>
                            </div>
                        ) : filteredMedia.length === 0 ? (
                            <div className="text-center py-16">
                                <p className="text-xl mb-6" style={{ color: '#888' }}>
                                    El álbum está vacío. ¡Sé el primero en subir una foto!
                                </p>
                                <button
                                    onClick={() => setShowUploadOptions(true)}
                                    className="px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
                                    style={{ background: 'linear-gradient(135deg, #C5A55A, #8B7332)', color: '#FFF' }}
                                >
                                    Subir Foto o Video
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {filteredMedia.map((item, index) => (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedIndex(index)}
                                        className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
                                        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    >
                                        {item.type === 'video' ? (
                                            <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata"
                                                onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.5 }} />
                                        ) : (
                                            <img src={item.url} alt="Foto del evento" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                        )}

                                        {item.type === 'video' && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,115,50,0.7)', backdropFilter: 'blur(4px)' }}>
                                                    <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                </div>
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                                                <span className="text-white text-xs px-2 py-1 rounded" style={{ background: 'rgba(139,115,50,0.7)' }}>
                                                    {new Date(item.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <button onClick={(e) => { e.stopPropagation(); downloadFile(item) }}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                                                    style={{ background: 'rgba(139,115,50,0.7)' }}>
                                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                    {/* Floating Upload Button */}
                    <div className="fixed bottom-24 right-6 z-40">
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
                        <input ref={videoInputRef} type="file" accept="video/*" capture="environment" onChange={handleFileUpload} className="hidden" />
                        <input id="galleryInput" type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />

                        {showUploadOptions && (
                            <div className="absolute bottom-20 right-0 rounded-xl p-3 mb-2 flex flex-col gap-1 min-w-[180px]" style={{
                                background: 'rgba(245, 240, 232, 0.98)',
                                border: '1px solid rgba(139, 115, 50, 0.2)',
                                backdropFilter: 'blur(10px)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            }}>
                                <button onClick={() => { fileInputRef.current?.click(); setShowUploadOptions(false); }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-black/5" style={{ color: '#333' }}>
                                    <span>📸</span><span>Tomar Foto</span>
                                </button>
                                <button onClick={() => { videoInputRef.current?.click(); setShowUploadOptions(false); }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-black/5" style={{ color: '#333' }}>
                                    <span>🎥</span><span>Grabar Video</span>
                                </button>
                                <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', margin: '4px 0' }} />
                                <button onClick={() => { document.getElementById('galleryInput')?.click(); setShowUploadOptions(false); }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-black/5" style={{ color: '#333' }}>
                                    <span>🖼️</span><span>Elegir Archivo</span>
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => setShowUploadOptions(!showUploadOptions)}
                            disabled={isUploading}
                            className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #C5A55A, #8B7332)', boxShadow: '0 8px 24px rgba(139, 115, 50, 0.4)' }}
                        >
                            {isUploading ? (
                                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            )}
                        </button>
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap" style={{ color: '#8B7332' }}>Subir</span>
                    </div>

                    {/* Footer */}
                    <footer className="fixed bottom-0 left-0 right-0 z-30 py-3 text-center" style={{
                        background: 'linear-gradient(to top, rgba(245, 240, 232, 0.95), transparent)'
                    }}>
                        <Link href="https://soynexo.com" target="_blank"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs transition-all hover:scale-105"
                            style={{ color: '#8B7332', background: 'rgba(197,165,90,0.1)', border: '1px solid rgba(197,165,90,0.2)' }}>
                            Creado con Soy Nexo
                        </Link>
                    </footer>
                </>
            )}

            {/* ============ TOAST NOTIFICATIONS ============ */}
            {uploadSuccess && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-6 py-3 flex items-center gap-3"
                    style={{ background: 'rgba(46, 125, 50, 0.95)', backdropFilter: 'blur(10px)', color: '#FFF' }}>
                    ✅ <span className="font-medium">¡Foto añadida al álbum!</span>
                </div>
            )}
            {rsvpSuccess && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-6 py-3 flex items-center gap-3"
                    style={{ background: 'rgba(139, 115, 50, 0.95)', backdropFilter: 'blur(10px)', color: '#FFF' }}>
                    🎉 <span className="font-medium">¡Asistencia confirmada!</span>
                </div>
            )}
            {uploadError && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-6 py-3 flex items-center gap-3"
                    style={{ background: 'rgba(183, 28, 28, 0.95)', backdropFilter: 'blur(10px)', color: '#FFF' }}>
                    ⚠️ <span className="font-medium">{uploadError}</span>
                    <button onClick={() => setUploadError(null)} className="ml-2 text-white/70 hover:text-white">×</button>
                </div>
            )}

            {/* ============ FULL-SCREEN VIEWER ============ */}
            {selectedMedia && (
                <div ref={viewerRef} className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(51, 40, 20, 0.95)' }} onClick={() => setSelectedIndex(null)}>

                    {/* Close */}
                    <button onClick={() => setSelectedIndex(null)}
                        className="absolute top-6 right-6 w-12 h-12 rounded-full flex items-center justify-center z-10"
                        style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Nav arrows */}
                    {selectedIndex !== null && selectedIndex > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(prev => prev !== null ? prev - 1 : null) }}
                            className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center z-10"
                            style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    {selectedIndex !== null && selectedIndex < filteredMedia.length - 1 && (
                        <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(prev => prev !== null ? prev + 1 : null) }}
                            className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center z-10"
                            style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}

                    {/* Media */}
                    <div className="max-w-5xl max-h-[85vh] p-4" onClick={(e) => e.stopPropagation()}>
                        {selectedMedia.type === 'video' ? (
                            <video src={selectedMedia.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-xl" />
                        ) : (
                            <img src={selectedMedia.url} alt="Foto del evento" className="max-w-full max-h-[80vh] rounded-xl object-contain" />
                        )}
                    </div>

                    {/* Bottom bar */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full px-6 py-3"
                        style={{ background: 'rgba(245, 240, 232, 0.15)', backdropFilter: 'blur(10px)' }}>
                        <span className="text-white/60 text-sm">{(selectedIndex ?? 0) + 1} / {filteredMedia.length}</span>
                        <div className="w-px h-4 bg-white/20" />
                        <button onClick={(e) => { e.stopPropagation(); downloadFile(selectedMedia) }}
                            className="flex items-center gap-2 text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-sm font-medium">Descargar</span>
                        </button>
                        <div className="w-px h-4 bg-white/20" />
                        <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true) }}
                            className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span className="text-sm font-medium">Eliminar</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ============ DELETE MODAL ============ */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
                    onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError('') }}>
                    <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: '#F5F0E8' }}
                        onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-2" style={{ color: '#333' }}>🗑️ Eliminar</h3>
                        <p className="text-sm mb-4" style={{ color: '#666' }}>Ingresa la contraseña para eliminar este archivo.</p>
                        <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                            placeholder="Contraseña"
                            className="w-full px-4 py-3 rounded-lg mb-3 text-sm outline-none"
                            style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(139,115,50,0.2)', color: '#333' }}
                            onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                            autoFocus
                        />
                        {deleteError && <p className="text-red-500 text-xs mb-3">{deleteError}</p>}
                        <div className="flex gap-3">
                            <button onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError('') }}
                                className="flex-1 py-3 rounded-lg text-sm font-medium"
                                style={{ background: 'rgba(0,0,0,0.05)', color: '#666' }}>
                                Cancelar
                            </button>
                            <button onClick={handleDelete} disabled={isDeleting}
                                className="flex-1 py-3 rounded-lg text-sm font-bold text-white"
                                style={{ background: '#d32f2f' }}>
                                {isDeleting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ RSVP MODAL ============ */}
            {showRSVP && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
                    onClick={() => setShowRSVP(false)}>
                    <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: '#F5F0E8' }}
                        onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-1" style={{ color: '#333' }}>✅ Confirmar Asistencia</h3>
                        <p className="text-sm mb-5" style={{ color: '#666' }}>¡Confirma con tu nombre y una selfie!</p>

                        {/* Name */}
                        <input
                            type="text"
                            value={rsvpName}
                            onChange={(e) => setRsvpName(e.target.value)}
                            placeholder="Tu nombre"
                            className="w-full px-4 py-3 rounded-lg mb-3 text-sm outline-none"
                            style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(139,115,50,0.2)', color: '#333' }}
                            autoFocus
                        />

                        {/* Photo */}
                        <input ref={rsvpFileRef} type="file" accept="image/*" capture="user" onChange={handleRSVPPhotoSelect} className="hidden" />

                        {rsvpPhotoPreview ? (
                            <div className="relative mb-4">
                                <img src={rsvpPhotoPreview} alt="Tu selfie" className="w-full h-48 object-cover rounded-xl" />
                                <button onClick={() => { setRsvpPhoto(null); setRsvpPhotoPreview(null); if (rsvpFileRef.current) rsvpFileRef.current.value = '' }}
                                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white text-sm">×</button>
                            </div>
                        ) : (
                            <button onClick={() => rsvpFileRef.current?.click()}
                                className="w-full py-8 rounded-xl mb-4 flex flex-col items-center gap-2 transition-colors"
                                style={{ border: '2px dashed rgba(139,115,50,0.3)', color: '#8B7332' }}>
                                <span className="text-3xl">📸</span>
                                <span className="text-sm font-medium">Tomar Selfie</span>
                            </button>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setShowRSVP(false)}
                                className="flex-1 py-3 rounded-lg text-sm font-medium"
                                style={{ background: 'rgba(0,0,0,0.05)', color: '#666' }}>
                                Cancelar
                            </button>
                            <button onClick={handleRSVPSubmit} disabled={isSubmittingRSVP || !rsvpName.trim() || !rsvpPhoto}
                                className="flex-1 py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #C5A55A, #8B7332)' }}>
                                {isSubmittingRSVP ? 'Confirmando...' : '¡Confirmo! 🎉'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ QR MODAL ============ */}
            {showQR && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
                    onClick={() => setShowQR(false)}>
                    <div className="rounded-3xl p-8 max-w-md w-full text-center relative" style={{ background: '#F5F0E8', border: '2px solid rgba(139,115,50,0.2)' }}
                        onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowQR(false)}
                            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(139,115,50,0.1)' }}>
                            <svg className="w-5 h-5" style={{ color: '#8B7332' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold" style={{ color: '#333' }}>📸 ¡Escanea y Comparte!</h2>
                            <p style={{ color: '#666' }}>Sube tus fotos y videos de la fiesta</p>
                        </div>

                        <div className="p-6 rounded-2xl inline-block mb-6" style={{ background: '#FFF' }}>
                            <QRCodeSVG value={uploadUrl} size={200} level="H" includeMargin={false} fgColor="#333" />
                        </div>

                        <div className="rounded-xl p-4" style={{ background: 'rgba(139,115,50,0.08)' }}>
                            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#8B7332' }}>URL del evento</p>
                            <p className="font-mono text-sm break-all" style={{ color: '#333' }}>{uploadUrl}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
