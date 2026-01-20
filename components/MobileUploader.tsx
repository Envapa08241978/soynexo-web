'use client'

import { useState, useRef } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { storage, db } from '@/lib/firebase'

interface MobileUploaderProps {
    eventSlug: string
}

export default function MobileUploader({ eventSlug }: MobileUploaderProps) {
    const [selectedFile, setSelectedFile] = useState<{ url: string, type: 'photo' | 'video' } | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadSuccess, setUploadSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [uploadType, setUploadType] = useState<'photo' | 'video'>('photo')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        // Validate file type
        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')

        if (!isImage && !isVideo) {
            setError('Por favor selecciona una imagen o video válido')
            return
        }

        // Validate file size (max 50MB for video, 10MB for images)
        const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
        if (file.size > maxSize) {
            setError(`El archivo es muy grande. Máximo ${isVideo ? '50MB' : '10MB'}`)
            return
        }

        // Create preview
        const reader = new FileReader()
        reader.onload = (e) => {
            setSelectedFile({
                url: e.target?.result as string,
                type: isVideo ? 'video' : 'photo'
            })
            setError(null)
        }
        reader.readAsDataURL(file)
    }

    const handleUpload = async () => {
        if (!selectedFile || !fileInputRef.current?.files?.[0]) return

        setIsUploading(true)
        setError(null)

        try {
            const file = fileInputRef.current.files[0]
            const fileName = `${Date.now()}-${file.name}`
            const storageRef = ref(storage, `events/${eventSlug}/${fileName}`)

            // Upload to Firebase Storage
            await uploadBytes(storageRef, file)
            const downloadURL = await getDownloadURL(storageRef)

            // Add to Firestore
            await addDoc(collection(db, 'events', eventSlug, 'media'), {
                url: downloadURL,
                type: selectedFile.type,
                timestamp: serverTimestamp(),
                fileName: fileName
            })

            setUploadSuccess(true)
            setSelectedFile(null)

            // Reset success state manually by user action
            // setTimeout(() => {
            //    setUploadSuccess(false)
            // }, 3000)
        } catch (err) {
            console.error('Upload error:', err)
            setError('Error al subir el archivo. Inténtalo de nuevo.')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleButtonClick = (type: 'photo' | 'video') => {
        setUploadType(type)
        fileInputRef.current?.click()
    }

    const handleCancel = () => {
        setSelectedFile(null)
        setError(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900">
            {/* Header */}
            <header className="p-6 text-center">
                {/* TODO: REEMPLAZAR CON SVG DEL LOGO FINAL AQUÍ */}
                <div className="flex items-center justify-center gap-3 mb-2">
                    <svg
                        className="w-12 h-12 text-accent-500"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                        <circle cx="4" cy="8" r="2" fill="currentColor" opacity="0.7" />
                        <circle cx="20" cy="8" r="2" fill="currentColor" opacity="0.7" />
                        <circle cx="4" cy="16" r="2" fill="currentColor" opacity="0.7" />
                        <circle cx="20" cy="16" r="2" fill="currentColor" opacity="0.7" />
                        <path d="M12 12L4 8M12 12L20 8M12 12L4 16M12 12L20 16" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
                    </svg>
                    <span className="text-3xl font-bold gradient-text">Soy Nexo</span>
                </div>
                <p className="text-white/50 text-sm">{eventSlug}</p>
                <p className="text-accent-400 text-xs mt-1">📸 El álbum de tu fiesta</p>
            </header>

            {/* Main content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6">
                {/* Success state */}
                {uploadSuccess && (
                    <div className="mb-8 glass-strong rounded-2xl p-6 text-center">
                        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">¡Enviado!</h2>
                        <p className="text-white/60 mb-6">Tu foto ya está en el álbum 🎉</p>

                        {/* Action buttons */}
                        <div className="space-y-3">
                            <a
                                href={`/${eventSlug}`}
                                className="w-full btn-primary py-4 flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Ver Álbum
                            </a>
                            <button
                                onClick={() => setUploadSuccess(false)}
                                className="w-full py-4 rounded-xl font-semibold text-white/70 transition-all duration-300 border border-white/20 hover:bg-white/10"
                            >
                                Subir otra foto
                            </button>
                        </div>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-center">
                        {error}
                    </div>
                )}

                {/* Preview */}
                {selectedFile && !uploadSuccess && (
                    <div className="mb-6 w-full max-w-sm">
                        <div className="relative rounded-2xl overflow-hidden glow-purple">
                            {selectedFile.type === 'video' ? (
                                <video
                                    src={selectedFile.url}
                                    className="w-full aspect-square object-cover"
                                    controls
                                />
                            ) : (
                                <img
                                    src={selectedFile.url}
                                    alt="Preview"
                                    className="w-full aspect-square object-cover"
                                />
                            )}
                            <button
                                onClick={handleCancel}
                                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            {/* Type badge */}
                            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                                <span className="text-white text-sm">
                                    {selectedFile.type === 'video' ? '🎥 Video' : '📸 Foto'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload button or Send button */}
                {!uploadSuccess && (
                    <div className="w-full max-w-sm space-y-4">
                        {selectedFile ? (
                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="w-full btn-primary text-xl py-6 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                        Subiendo...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                        Añadir al Álbum
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="space-y-4">
                                {/* Photo button */}
                                <button
                                    onClick={() => handleButtonClick('photo')}
                                    className="w-full btn-primary text-xl py-6 flex flex-col items-center justify-center gap-3"
                                >
                                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <span>SUBIR FOTO</span>
                                </button>

                                {/* Video button */}
                                <button
                                    onClick={() => handleButtonClick('video')}
                                    className="w-full py-5 rounded-xl font-semibold text-white/80 transition-all duration-300 border border-white/20 hover:bg-white/10 hover:border-white/40 flex flex-col items-center justify-center gap-2"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <span>SUBIR VIDEO</span>
                                </button>
                            </div>
                        )}

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={uploadType === 'video' ? 'video/*' : 'image/*'}
                            capture={uploadType === 'video' ? undefined : 'environment'}
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {/* Helper text */}
                        {!selectedFile && (
                            <p className="text-center text-white/40 text-sm">
                                Comparte tus mejores momentos con todos 🎉
                            </p>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="p-6 text-center">
                <p className="text-white/30 text-xs">
                    Powered by Soy Nexo · Tu álbum de fiesta en tiempo real
                </p>
            </footer>

            {/* Ambient effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-1/4 left-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl" />
            </div>
        </div>
    )
}
