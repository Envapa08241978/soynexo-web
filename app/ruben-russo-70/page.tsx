'use client'

import { useState, useRef, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { QRCodeSVG } from 'qrcode.react'
import { analyzeImageContent, validateFileBasics } from '@/lib/contentModeration'
import Link from 'next/link'

interface MediaItem {
    id: string
    url: string
    type: 'photo' | 'video'
    timestamp: number
}

const EVENT_SLUG = 'ruben-russo-70'
const EVENT_NAME = '70 Cumpleaños de Ruben Russo'
const EVENT_DATE = 'Sábado 17 de Enero • 4:00 PM'
const EVENT_LOCATION = 'Rancho San Juan, San Ignacio Cohuirimpo'

export default function RubenRusso70Page() {
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

    const [uploadUrl, setUploadUrl] = useState('')
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUploadUrl(`${window.location.origin}/${EVENT_SLUG}`)
        }
    }, [])

    // Real-time sync with Firebase
    useEffect(() => {
        const mediaRef = collection(db, 'events', EVENT_SLUG, 'media')
        const q = query(mediaRef, orderBy('timestamp', 'desc'))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const firebaseMedia: MediaItem[] = snapshot.docs.map(doc => ({
                id: doc.id,
                url: doc.data().url,
                type: doc.data().type as 'photo' | 'video',
                timestamp: doc.data().timestamp?.toMillis() || Date.now()
            }))
            setMedia(firebaseMedia)
            setIsLoading(false)
        }, (error) => {
            console.error('Firebase sync error:', error)
            setIsLoading(false)
        })

        return () => unsubscribe()
    }, [])

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

    const downloadFile = async (item: MediaItem) => {
        try {
            const response = await fetch(item.url)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `ruben-russo-70-${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Download failed:', error)
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

    // Handle file upload with content moderation
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

    return (
        <div className="min-h-screen min-h-[100dvh] overflow-x-hidden" style={{
            background: 'linear-gradient(to bottom, #3E2723 0%, #5D4037 30%, #8D6E63 70%, #D7CCC8 100%)'
        }}>
            {/* Header with Western Theme */}
            <header className="sticky top-0 z-40 border-b border-[#6D2C00]/30" style={{
                background: 'linear-gradient(to bottom, rgba(62, 39, 35, 0.95), rgba(93, 64, 55, 0.9))',
                backdropFilter: 'blur(10px)'
            }}>
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        {/* Event Info - Large Photo */}
                        <div className="flex items-center gap-4">
                            <img
                                src="/ruben-russo.jpg"
                                alt="Ruben Russo"
                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover object-top"
                                style={{
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                    border: '3px solid rgba(239, 235, 233, 0.7)'
                                }}
                            />
                            <div className="hidden sm:block">
                                <h1 className="text-lg font-bold" style={{ color: '#EFEBE9' }}>Ruben Russo</h1>
                                <p className="text-sm" style={{ color: '#D7CCC8' }}>70 Aniversario</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2 text-sm" style={{ color: '#D7CCC8' }}>
                                <span>{media.filter(m => m.type === 'photo').length} fotos</span>
                                <span style={{ color: '#8D6E63' }}>•</span>
                                <span>{media.filter(m => m.type === 'video').length} videos</span>
                            </div>

                            <button
                                onClick={() => setShowQR(true)}
                                className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                                style={{
                                    background: 'rgba(141, 110, 99, 0.3)',
                                    color: '#EFEBE9',
                                    border: '1px solid rgba(141, 110, 99, 0.5)'
                                }}
                            >
                                QR
                            </button>

                            <button
                                onClick={downloadAll}
                                disabled={isDownloading || media.length === 0}
                                className="px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                                style={{
                                    background: 'linear-gradient(135deg, #6D2C00, #8D4510)',
                                    color: '#EFEBE9'
                                }}
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

                    {/* Filter tabs */}
                    <div className="flex gap-2 mt-4">
                        {(['all', 'photos', 'videos'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                style={{
                                    background: filter === f ? 'rgba(109, 44, 0, 0.4)' : 'transparent',
                                    color: filter === f ? '#EFEBE9' : '#D7CCC8',
                                    border: filter === f ? '1px solid rgba(109, 44, 0, 0.6)' : '1px solid transparent'
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
                            <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4" style={{
                                borderColor: '#6D2C00',
                                borderTopColor: 'transparent'
                            }} />
                            <p style={{ color: '#EFEBE9' }}>Cargando álbum...</p>
                        </div>
                    </div>
                ) : filteredMedia.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-xl mb-6" style={{ color: '#D7CCC8' }}>
                            Sube la primera foto o video del evento
                        </p>
                        <button
                            onClick={() => setShowUploadOptions(true)}
                            className="px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
                            style={{
                                background: 'linear-gradient(135deg, #6D2C00, #8D4510)',
                                color: '#EFEBE9'
                            }}
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
                                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                            >
                                {item.type === 'video' ? (
                                    <video
                                        src={item.url}
                                        className="w-full h-full object-cover"
                                        muted
                                        playsInline
                                        preload="metadata"
                                        onLoadedData={(e) => {
                                            const video = e.target as HTMLVideoElement
                                            video.currentTime = 0.5
                                        }}
                                    />
                                ) : (
                                    <img
                                        src={item.url}
                                        alt={`Foto del evento`}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                    />
                                )}

                                {item.type === 'video' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{
                                            background: 'rgba(62, 39, 35, 0.7)',
                                            backdropFilter: 'blur(4px)'
                                        }}>
                                            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                        </div>
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                                        <span className="text-white text-xs px-2 py-1 rounded" style={{ background: 'rgba(62, 39, 35, 0.7)' }}>
                                            {new Date(item.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                downloadFile(item)
                                            }}
                                            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                                            style={{ background: 'rgba(109, 44, 0, 0.7)' }}
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
                )}
            </main>

            {/* Floating Upload Button */}
            <div className="fixed bottom-24 right-6 z-40">
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
                {/* Gallery input - no capture, allows file picker */}
                <input
                    id="galleryInput"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                />

                {showUploadOptions && (
                    <div className="absolute bottom-20 right-0 rounded-xl p-3 mb-2 flex flex-col gap-1 min-w-[180px]" style={{
                        background: 'linear-gradient(135deg, rgba(62, 39, 35, 0.95), rgba(93, 64, 55, 0.95))',
                        border: '1px solid rgba(141, 110, 99, 0.3)',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <button
                            onClick={() => {
                                fileInputRef.current?.click()
                                setShowUploadOptions(false)
                            }}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-white/10"
                            style={{ color: '#EFEBE9' }}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Tomar Foto</span>
                        </button>
                        <button
                            onClick={() => {
                                videoInputRef.current?.click()
                                setShowUploadOptions(false)
                            }}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-white/10"
                            style={{ color: '#EFEBE9' }}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Grabar Video</span>
                        </button>
                        <div className="border-t border-white/10 my-1" />
                        <button
                            onClick={() => {
                                document.getElementById('galleryInput')?.click()
                                setShowUploadOptions(false)
                            }}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-white/10"
                            style={{ color: '#EFEBE9' }}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Elegir Archivo</span>
                        </button>
                    </div>
                )}

                <button
                    onClick={() => setShowUploadOptions(!showUploadOptions)}
                    disabled={isUploading}
                    className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110 disabled:opacity-50"
                    style={{
                        background: 'linear-gradient(135deg, #6D2C00, #8D4510)',
                        boxShadow: '0 8px 24px rgba(109, 44, 0, 0.4)'
                    }}
                >
                    {isUploading ? (
                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    )}
                </button>
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap" style={{ color: '#EFEBE9' }}>
                    Subir
                </span>
            </div>

            {/* Upload feedback toasts */}
            {uploadSuccess && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 rounded-xl px-6 py-3 flex items-center gap-3" style={{
                    background: 'linear-gradient(135deg, rgba(46, 125, 50, 0.9), rgba(56, 142, 60, 0.9))',
                    backdropFilter: 'blur(10px)'
                }}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white font-medium">Foto añadida al álbum</span>
                </div>
            )}

            {uploadError && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 rounded-xl px-6 py-3 flex items-center gap-3" style={{
                    background: 'linear-gradient(135deg, rgba(183, 28, 28, 0.9), rgba(211, 47, 47, 0.9))',
                    backdropFilter: 'blur(10px)'
                }}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-white font-medium">{uploadError}</span>
                    <button onClick={() => setUploadError(null)} className="text-white/70 hover:text-white ml-2">×</button>
                </div>
            )}

            {/* Full-screen viewer */}
            {selectedMedia && (
                <div
                    ref={viewerRef}
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(62, 39, 35, 0.95)' }}
                    onClick={() => setSelectedIndex(null)}
                >
                    <button
                        onClick={() => setSelectedIndex(null)}
                        className="absolute top-6 right-6 w-12 h-12 rounded-full flex items-center justify-center transition-colors z-10"
                        style={{ background: 'rgba(141, 110, 99, 0.3)' }}
                    >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {selectedIndex !== null && selectedIndex > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setSelectedIndex(prev => prev !== null ? prev - 1 : null)
                            }}
                            className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center transition-colors z-10"
                            style={{ background: 'rgba(141, 110, 99, 0.3)' }}
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
                            className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center transition-colors z-10"
                            style={{ background: 'rgba(141, 110, 99, 0.3)' }}
                        >
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}

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
                                alt="Foto del evento"
                                className="max-w-full max-h-[80vh] rounded-xl object-contain"
                            />
                        )}
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full px-6 py-3" style={{
                        background: 'rgba(62, 39, 35, 0.8)',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <span style={{ color: '#D7CCC8' }} className="text-sm">
                            {(selectedIndex ?? 0) + 1} / {filteredMedia.length}
                        </span>
                        <div className="w-px h-4" style={{ background: 'rgba(141, 110, 99, 0.5)' }} />
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                downloadFile(selectedMedia)
                            }}
                            className="flex items-center gap-2 transition-colors"
                            style={{ color: '#EFEBE9' }}
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
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(62, 39, 35, 0.9)' }}
                    onClick={() => setShowQR(false)}
                >
                    <div
                        className="rounded-3xl p-8 max-w-md w-full text-center relative"
                        style={{
                            background: 'linear-gradient(135deg, #5D4037, #3E2723)',
                            border: '2px solid rgba(141, 110, 99, 0.3)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setShowQR(false)}
                            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                            style={{ background: 'rgba(141, 110, 99, 0.3)' }}
                        >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold" style={{ color: '#EFEBE9' }}>Escanea y Comparte</h2>
                            <p style={{ color: '#D7CCC8' }}>Sube tus fotos y videos del evento</p>
                        </div>

                        <div className="p-6 rounded-2xl inline-block mb-6" style={{ background: '#EFEBE9' }}>
                            <QRCodeSVG
                                value={uploadUrl}
                                size={200}
                                level="H"
                                includeMargin={false}
                                fgColor="#3E2723"
                            />
                        </div>

                        <div className="rounded-xl p-4" style={{ background: 'rgba(141, 110, 99, 0.2)' }}>
                            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#8D6E63' }}>URL del evento</p>
                            <p className="font-mono text-sm break-all" style={{ color: '#EFEBE9' }}>{uploadUrl}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer with Soy Nexo link */}
            <footer className="fixed bottom-0 left-0 right-0 z-30 py-3 text-center" style={{
                background: 'linear-gradient(to top, rgba(62, 39, 35, 0.95), transparent)'
            }}>
                <Link
                    href="https://soynexo.com"
                    target="_blank"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs transition-all hover:scale-105"
                    style={{
                        color: '#8D6E63',
                        background: 'rgba(141, 110, 99, 0.1)',
                        border: '1px solid rgba(141, 110, 99, 0.2)'
                    }}
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                        <circle cx="4" cy="8" r="2" fill="currentColor" opacity="0.7" />
                        <circle cx="20" cy="8" r="2" fill="currentColor" opacity="0.7" />
                        <circle cx="4" cy="16" r="2" fill="currentColor" opacity="0.7" />
                        <circle cx="20" cy="16" r="2" fill="currentColor" opacity="0.7" />
                    </svg>
                    Creado con Soy Nexo
                </Link>
            </footer>
        </div>
    )
}
