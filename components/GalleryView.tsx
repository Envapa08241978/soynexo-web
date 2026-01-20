'use client'

import { useState, useRef, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { QRCodeSVG } from 'qrcode.react'
import { analyzeImageContent, validateFileBasics } from '@/lib/contentModeration'

interface MediaItem {
    id: string
    url: string
    type: 'photo' | 'video'
    thumbnail?: string
    timestamp: number
}

interface GalleryViewProps {
    eventSlug: string
}

// Demo media items (shown while Firebase loads or if no real data)
const DEMO_MEDIA: MediaItem[] = [
    { id: '1', url: 'https://picsum.photos/seed/album1/800/600', type: 'photo', timestamp: Date.now() - 3600000 },
    { id: '2', url: 'https://picsum.photos/seed/album2/800/600', type: 'photo', timestamp: Date.now() - 3200000 },
    { id: '3', url: 'https://picsum.photos/seed/album3/800/600', type: 'photo', timestamp: Date.now() - 2800000 },
    { id: '4', url: 'https://picsum.photos/seed/album4/800/600', type: 'photo', timestamp: Date.now() - 2400000 },
    { id: '5', url: 'https://picsum.photos/seed/album5/800/600', type: 'photo', timestamp: Date.now() - 2000000 },
    { id: '6', url: 'https://picsum.photos/seed/album6/800/600', type: 'photo', timestamp: Date.now() - 1600000 },
    { id: '7', url: 'https://picsum.photos/seed/album7/800/600', type: 'photo', timestamp: Date.now() - 1200000 },
    { id: '8', url: 'https://picsum.photos/seed/album8/800/600', type: 'photo', timestamp: Date.now() - 800000 },
    { id: '9', url: 'https://picsum.photos/seed/album9/800/600', type: 'photo', timestamp: Date.now() - 400000 },
    // Demo video placeholder
    { id: '10', url: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video', thumbnail: 'https://picsum.photos/seed/video1/800/600', timestamp: Date.now() },
]

export default function GalleryView({ eventSlug }: GalleryViewProps) {
    const [media, setMedia] = useState<MediaItem[]>(DEMO_MEDIA)
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

    // Generate upload URL for mobile QR
    const [uploadUrl, setUploadUrl] = useState('')
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUploadUrl(`${window.location.origin}/${eventSlug}`)
        }
    }, [eventSlug])

    // Real-time sync with Firebase
    useEffect(() => {
        const mediaRef = collection(db, 'events', eventSlug, 'media')
        const q = query(mediaRef, orderBy('timestamp', 'desc'))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                // No Firebase data yet, keep demo media
                setIsLoading(false)
                return
            }

            const firebaseMedia: MediaItem[] = snapshot.docs.map(doc => ({
                id: doc.id,
                url: doc.data().url,
                type: doc.data().type as 'photo' | 'video',
                thumbnail: doc.data().thumbnail,
                timestamp: doc.data().timestamp?.toMillis() || Date.now()
            }))

            // Show only Firebase media
            setMedia(firebaseMedia)
            setIsLoading(false)
        }, (error) => {
            console.error('Firebase sync error:', error)
            setIsLoading(false)
        })

        return () => unsubscribe()
    }, [eventSlug])

    const filteredMedia = media.filter(item => {
        if (filter === 'all') return true
        if (filter === 'photos') return item.type === 'photo'
        if (filter === 'videos') return item.type === 'video'
        return true
    })

    const selectedMedia = selectedIndex !== null ? filteredMedia[selectedIndex] : null

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedIndex === null) return

            if (e.key === 'Escape') {
                setSelectedIndex(null)
            } else if (e.key === 'ArrowRight') {
                setSelectedIndex(prev =>
                    prev !== null && prev < filteredMedia.length - 1 ? prev + 1 : prev
                )
            } else if (e.key === 'ArrowLeft') {
                setSelectedIndex(prev =>
                    prev !== null && prev > 0 ? prev - 1 : prev
                )
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedIndex, filteredMedia.length])

    // Download single file
    const downloadFile = async (item: MediaItem) => {
        try {
            const response = await fetch(item.url)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `soy-nexo-${eventSlug}-${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Download failed:', error)
        }
    }

    // Download all files
    const downloadAll = async () => {
        setIsDownloading(true)
        try {
            for (const item of media) {
                await downloadFile(item)
                await new Promise(resolve => setTimeout(resolve, 500)) // Small delay between downloads
            }
        } finally {
            setIsDownloading(false)
        }
    }

    // Handle file upload from mobile/desktop
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setUploadError(null)

        // Basic validation
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
            // Content moderation check for images
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
            const storageRef = ref(storage, `events/${eventSlug}/${fileName}`)
            await uploadBytes(storageRef, file)
            const downloadURL = await getDownloadURL(storageRef)

            await addDoc(collection(db, 'events', eventSlug, 'media'), {
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

    return (
        <div className="min-h-screen min-h-[100dvh] bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 overflow-x-hidden">
            {/* Header */}
            <header className="sticky top-0 z-40 glass border-b border-white/10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            {/* TODO: REEMPLAZAR CON SVG DEL LOGO FINAL AQUÍ */}
                            <svg className="w-8 h-8 text-accent-500" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="3" fill="currentColor" />
                                <circle cx="4" cy="8" r="2" fill="currentColor" opacity="0.7" />
                                <circle cx="20" cy="8" r="2" fill="currentColor" opacity="0.7" />
                                <circle cx="4" cy="16" r="2" fill="currentColor" opacity="0.7" />
                                <circle cx="20" cy="16" r="2" fill="currentColor" opacity="0.7" />
                                <path d="M12 12L4 8M12 12L20 8M12 12L4 16M12 12L20 16" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
                            </svg>
                            <div>
                                <span className="text-lg font-bold gradient-text">Soy Nexo</span>
                                <p className="text-white/50 text-xs">{eventSlug}</p>
                            </div>
                        </div>

                        {/* Stats & Download */}
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex items-center gap-2 text-white/60 text-sm">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{media.filter(m => m.type === 'photo').length} fotos</span>
                                <span className="text-white/30">•</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>{media.filter(m => m.type === 'video').length} videos</span>
                            </div>

                            {/* QR Code button */}
                            <button
                                onClick={() => setShowQR(true)}
                                className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
                                title="Mostrar QR para invitados"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                                QR
                            </button>

                            <button
                                onClick={downloadAll}
                                disabled={isDownloading}
                                className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
                            >
                                {isDownloading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Descargando...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Descargar Todo
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex gap-2 mt-4">
                        {(['all', 'photos', 'videos'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f
                                    ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                                    : 'text-white/60 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {f === 'all' ? 'Todo' : f === 'photos' ? 'Fotos' : 'Videos'}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Gallery Grid */}
            <main className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredMedia.map((item, index) => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedIndex(index)}
                            className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
                        >
                            {/* Thumbnail - for videos, show first frame or placeholder */}
                            {item.type === 'video' ? (
                                <video
                                    src={item.url}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                    preload="metadata"
                                    onLoadedData={(e) => {
                                        const video = e.target as HTMLVideoElement;
                                        video.currentTime = 0.5; // Seek to 0.5s for thumbnail
                                    }}
                                />
                            ) : (
                                <img
                                    src={item.url}
                                    alt={`Media ${item.id}`}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                />
                            )}

                            {/* Video indicator */}
                            {item.type === 'video' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                        <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>
                                </div>
                            )}

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                                    <span className="text-white text-xs bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
                                        {new Date(item.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            downloadFile(item)
                                        }}
                                        className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 backdrop-blur-sm transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredMedia.length === 0 && (
                    <div className="text-center py-20">
                        <svg className="w-16 h-16 text-white/20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-white/40 text-lg">No hay {filter === 'videos' ? 'videos' : 'fotos'} aún</p>
                    </div>
                )}
            </main>

            {/* Floating Upload Button */}
            <div className="fixed bottom-24 right-6 z-40">
                {/* Hidden file inputs */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                />
                <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                />

                {/* Upload options popup */}
                {showUploadOptions && (
                    <div className="absolute bottom-20 right-0 glass-strong rounded-xl p-3 mb-2 flex flex-col gap-2 min-w-[160px]">
                        <button
                            onClick={() => {
                                fileInputRef.current?.click();
                                setShowUploadOptions(false);
                            }}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-white"
                        >
                            <svg className="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Foto</span>
                        </button>
                        <button
                            onClick={() => {
                                videoInputRef.current?.click();
                                setShowUploadOptions(false);
                            }}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-white"
                        >
                            <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Video</span>
                        </button>
                    </div>
                )}

                {/* Main upload button */}
                <button
                    onClick={() => setShowUploadOptions(!showUploadOptions)}
                    disabled={isUploading}
                    className="w-16 h-16 rounded-full bg-gradient-to-r from-accent-500 to-primary-500 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform disabled:opacity-50"
                >
                    {isUploading ? (
                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    )}
                </button>
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-xs whitespace-nowrap">
                    Subir
                </span>
            </div>

            {/* Upload success toast */}
            {uploadSuccess && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 glass-strong rounded-xl px-6 py-3 flex items-center gap-3 animate-fade-in">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <span className="text-white font-medium">¡Foto añadida al álbum!</span>
                </div>
            )}

            {/* Upload error toast */}
            {uploadError && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 glass-strong rounded-xl px-6 py-3 flex items-center gap-3 animate-fade-in bg-red-900/80">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <span className="text-white font-medium">{uploadError}</span>
                    <button onClick={() => setUploadError(null)} className="text-white/70 hover:text-white ml-2">✕</button>
                </div>
            )}

            {/* Full-screen viewer */}
            {selectedMedia && (
                <div
                    ref={viewerRef}
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                    onClick={() => setSelectedIndex(null)}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setSelectedIndex(null)}
                        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                    >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Navigation arrows */}
                    {selectedIndex !== null && selectedIndex > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setSelectedIndex(prev => prev !== null ? prev - 1 : null)
                            }}
                            className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                        >
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}

                    {selectedIndex !== null && selectedIndex < filteredMedia.length - 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setSelectedIndex(prev => prev !== null ? prev + 1 : null)
                            }}
                            className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                        >
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}

                    {/* Media content */}
                    <div className="max-w-5xl max-h-[85vh] p-4" onClick={(e) => e.stopPropagation()}>
                        {selectedMedia.type === 'video' ? (
                            <video
                                src={selectedMedia.url}
                                controls
                                autoPlay
                                className="max-w-full max-h-[80vh] rounded-xl"
                            />
                        ) : (
                            <img
                                src={selectedMedia.url}
                                alt={`Full size ${selectedMedia.id}`}
                                className="max-w-full max-h-[80vh] rounded-xl object-contain"
                            />
                        )}
                    </div>

                    {/* Bottom bar */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 glass rounded-full px-6 py-3">
                        <span className="text-white/60 text-sm">
                            {(selectedIndex ?? 0) + 1} / {filteredMedia.length}
                        </span>
                        <div className="w-px h-4 bg-white/20" />
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                downloadFile(selectedMedia)
                            }}
                            className="flex items-center gap-2 text-white hover:text-accent-400 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-sm font-medium">Descargar</span>
                        </button>
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            {showQR && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setShowQR(false)}
                >
                    <div
                        className="glass-strong rounded-3xl p-8 max-w-md w-full text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setShowQR(false)}
                            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                        >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Header */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">📸 ¡Escanea y Comparte!</h2>
                            <p className="text-white/60">Los invitados pueden subir fotos y videos</p>
                        </div>

                        {/* QR Code */}
                        <div className="bg-white p-6 rounded-2xl inline-block mb-6">
                            <QRCodeSVG
                                value={uploadUrl}
                                size={220}
                                level="H"
                                includeMargin={false}
                            />
                        </div>

                        {/* URL Display */}
                        <div className="glass rounded-xl p-4 mb-6">
                            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">URL del evento</p>
                            <p className="text-accent-400 font-mono text-sm break-all">{uploadUrl}</p>
                        </div>

                        {/* Instructions */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-3">
                                <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-2">
                                    <span className="text-lg">📱</span>
                                </div>
                                <p className="text-white/60 text-xs">Escanear con el móvil</p>
                            </div>
                            <div className="p-3">
                                <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-2">
                                    <span className="text-lg">📸</span>
                                </div>
                                <p className="text-white/60 text-xs">Tomar foto o video</p>
                            </div>
                            <div className="p-3">
                                <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-2">
                                    <span className="text-lg">🚀</span>
                                </div>
                                <p className="text-white/60 text-xs">Se añade al álbum</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
