'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { db, storage } from '@/lib/firebase'
import { addDoc, collection, serverTimestamp, doc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// ==========================================
// TYPES
// ==========================================
type EventType = 'boda' | 'xv' | 'cumpleanos' | 'corporativo' | ''

const ThemedButton = ({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) => (
    <button type="button" onClick={(e) => { e.preventDefault(); onClick(); }}
        className={`w-full p-4 rounded-xl border-2 transition-all text-left font-medium ${active
            ? 'border-[#BCA872] bg-[#BCA872]/10 text-[#BCA872]'
            : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30'
            }`}>
        {children}
    </button>
)

// Placeholder for compressImage function - user is expected to provide this or ensure it's imported
async function compressImage(file: File): Promise<Blob> {
    // This is a placeholder. In a real application, you'd use a library like 'browser-image-compression'
    // or implement your own compression logic here.
    // For now, it just returns the original file as a Blob.
    console.warn("compressImage function is a placeholder. Implement actual image compression.")
    return new Blob([file], { type: file.type })
}

export default function CrearEventoWizard() {
    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form Data
    const [eventType, setEventType] = useState<EventType>('')
    const [names, setNames] = useState('')
    const [date, setDate] = useState('')
    const [location, setLocation] = useState('')
    const [coords, setCoords] = useState('')

    // Custom Theme State
    const [customTheme, setCustomTheme] = useState({
        accentColor: '#BCA872', // Default Gold
        backgroundColor: '#0F0F12', // Default Dark
        textColor: '#FFFFFF' // Default White
    })

    const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null)

    const handleImageSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            try {
                const compressedImage = await compressImage(file)
                const compressedFile = new File([compressedImage], file.name, { type: file.type })
                setCoverImageFile(compressedFile)
                setCoverImagePreview(URL.createObjectURL(compressedFile))
            } catch (error) {
                console.error("Compression failed:", error)
            }
        }
    }


    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            const tempSlug = names.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000)

            // Upload Image if present
            let uploadedImageUrl = ''
            if (coverImageFile) {
                const imageRef = ref(storage, `events/${tempSlug}/cover_${Date.now()}`)
                const snapshot = await uploadBytes(imageRef, coverImageFile)
                uploadedImageUrl = await getDownloadURL(snapshot.ref)
            }

            // We write DIRECTLY to the real events collection, but mark it pending so it requires payment
            await setDoc(doc(db, 'events', tempSlug, 'config', 'main'), {
                id: tempSlug,
                type: eventType,
                title: names,
                date: date,
                location: location,
                coords: coords,
                theme: customTheme,
                coverImage: uploadedImageUrl || '/demo-hero.png',
                status: 'active',
                timestamp: serverTimestamp()
            })
            window.location.href = `/${tempSlug}`
        } catch (error) {
            console.error("Error saving event:", error)
            alert("Error al guardar. Intenta nuevamente.")
            setIsSubmitting(false)
        }
    }

    const handleNext = (e?: React.SyntheticEvent) => {
        if (e) e.preventDefault()
        console.log("Avanzando paso desde: ", step)
        if (step < 5) {
            setStep(prev => prev + 1)
        } else {
            handleSubmit()
        }
    }


    return (
        <div className="min-h-screen bg-[#0F0F12] text-white flex flex-col">
            {/* Header */}
            <header className="p-6 border-b border-white/5 flex justify-between items-center">
                <Link href="/">
                    <img src="/logo.png" alt="Soy Nexo" className="h-6" />
                </Link>
                <div className="text-xs uppercase tracking-widest text-[#BCA872] font-bold">
                    Paso {step} de 5
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="w-full max-w-lg">

                    {/* Progress Bar */}
                    <div className="w-full h-1 bg-white/5 rounded-full mb-12 overflow-hidden">
                        <div className="h-full bg-[#BCA872] transition-all duration-500 ease-out" style={{ width: `${(step / 5) * 100}%` }} />
                    </div>

                    <div className="animate-fade-in-up">

                        {/* STEP 1: EVENT TYPE */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">¿Qué vamos a celebrar?</h1>
                                <p className="text-white/50 mb-8">Elige el tipo de evento para adaptar la experiencia.</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <ThemedButton active={eventType === 'boda'} onClick={() => setEventType('boda')}>
                                        <span className="text-2xl block mb-2">💍</span> Boda
                                    </ThemedButton>
                                    <ThemedButton active={eventType === 'xv'} onClick={() => setEventType('xv')}>
                                        <span className="text-2xl block mb-2">👑</span> XV Años
                                    </ThemedButton>
                                    <ThemedButton active={eventType === 'cumpleanos'} onClick={() => setEventType('cumpleanos')}>
                                        <span className="text-2xl block mb-2">🎂</span> Cumpleaños
                                    </ThemedButton>
                                    <ThemedButton active={eventType === 'corporativo'} onClick={() => setEventType('corporativo')}>
                                        <span className="text-2xl block mb-2">🏢</span> Evento Corporativo
                                    </ThemedButton>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: NAMES */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
                                    {eventType === 'boda' ? '¿Cómo se llaman los novios?' :
                                        eventType === 'corporativo' ? '¿Cuál es el nombre de la empresa?' :
                                            '¿Cómo se llama el festejado/a?'}
                                </h1>
                                <p className="text-white/50 mb-8">Este será el título principal de tu invitación.</p>

                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-[#BCA872] mb-2 font-bold">Título del Evento</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={names}
                                        onChange={(e) => setNames(e.target.value)}
                                        placeholder={eventType === 'boda' ? 'Ej. Ana & Carlos' : 'Ej. Mis XV Años Sofía'}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && names) handleNext(); }}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-lg focus:border-[#BCA872] outline-none transition-colors"
                                    />
                                </div>
                            </div>
                        )}

                        {/* STEP 3: DETAILS */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Cuándo y Dónde</h1>
                                <p className="text-white/50 mb-8">Los datos clave de tu gran evento.</p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest text-[#BCA872] mb-2 font-bold">Fecha y Hora</label>
                                        <input
                                            type="datetime-local"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-lg focus:border-[#BCA872] outline-none transition-colors [color-scheme:dark]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest text-[#BCA872] mb-2 font-bold">Lugar Corto</label>
                                        <input
                                            type="text"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            placeholder="Ej. Hacienda Los Arcángeles"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-lg focus:border-[#BCA872] outline-none transition-colors mb-4"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest text-[#BCA872] mb-2 font-bold">Enlace de Google Maps (Coordenadas)</label>
                                        <input
                                            type="text"
                                            value={coords}
                                            onChange={(e) => setCoords(e.target.value)}
                                            placeholder="Pega el enlace de Google Maps aquí"
                                            onKeyDown={(e) => { if (e.key === 'Enter' && date && location) handleNext(); }}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-lg focus:border-[#BCA872] outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: COVER IMAGE */}
                        {step === 4 && (
                            <div className="space-y-6">
                                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Una foto de portada</h1>
                                <p className="text-white/50 mb-8">Sube una foto tuya o de los festejados para darle la bienvenida a tus invitados.</p>

                                <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 flex flex-col items-center justify-center relative hover:border-[#BCA872] transition-colors cursor-pointer" onClick={() => document.getElementById('cover-upload')?.click()}>
                                    {coverImagePreview ? (
                                        <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl">
                                            <img src={coverImagePreview} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                <span className="text-white font-bold bg-black/50 px-6 py-3 rounded-xl backdrop-blur-sm">Cambiar Foto</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📸</div>
                                            <p className="font-bold text-lg mb-2">Toca para subir una foto</p>
                                            <p className="text-xs text-white/50">JPG, PNG o WEBP. Formato horizontal recomendado.</p>
                                        </div>
                                    )}
                                    <input
                                        id="cover-upload"
                                        type="file"
                                        accept="image/jpeg, image/png, image/webp"
                                        className="hidden"
                                        onChange={handleImageSelection}
                                    />
                                </div>
                            </div>
                        )}

                        {/* STEP 5: DESIGN & COLORS */}
                        {step === 5 && (
                            <div className="space-y-6">
                                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Personaliza tus colores</h1>
                                <p className="text-white/50 mb-8">Decide exactamente cómo quieres que se vea tu invitación.</p>

                                <div className="space-y-6">
                                    {/* Color Pickers */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center">
                                            <label className="text-xs text-white/60 mb-3 font-bold uppercase tracking-widest">Color de Fondo</label>
                                            <input
                                                type="color"
                                                value={customTheme.backgroundColor}
                                                onChange={(e) => setCustomTheme({ ...customTheme, backgroundColor: e.target.value })}
                                                className="w-16 h-16 rounded-full cursor-pointer bg-transparent border-none p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full shadow-lg"
                                            />
                                            <span className="text-xs text-white/30 mt-2 font-mono">{customTheme.backgroundColor.toUpperCase()}</span>
                                        </div>

                                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center">
                                            <label className="text-xs text-white/60 mb-3 font-bold uppercase tracking-widest">Color Principal</label>
                                            <input
                                                type="color"
                                                value={customTheme.accentColor}
                                                onChange={(e) => setCustomTheme({ ...customTheme, accentColor: e.target.value })}
                                                className="w-16 h-16 rounded-full cursor-pointer bg-transparent border-none p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full shadow-lg"
                                            />
                                            <span className="text-xs text-white/30 mt-2 font-mono">{customTheme.accentColor.toUpperCase()}</span>
                                        </div>

                                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center">
                                            <label className="text-xs text-white/60 mb-3 font-bold uppercase tracking-widest">Color de Texto</label>
                                            <input
                                                type="color"
                                                value={customTheme.textColor}
                                                onChange={(e) => setCustomTheme({ ...customTheme, textColor: e.target.value })}
                                                className="w-16 h-16 rounded-full cursor-pointer bg-transparent border-none p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full shadow-lg"
                                            />
                                            <span className="text-xs text-white/30 mt-2 font-mono">{customTheme.textColor.toUpperCase()}</span>
                                        </div>
                                    </div>

                                    {/* Live Preview */}
                                    <div className="mt-8 rounded-2xl overflow-hidden shadow-2xl transition-colors duration-500" style={{ backgroundColor: customTheme.backgroundColor }}>
                                        <div className="p-6 sm:p-8 text-center" style={{ color: customTheme.textColor }}>
                                            <h3 className="text-sm font-bold tracking-widest uppercase mb-4 opacity-60">Vista Previa</h3>
                                            <h2 className="text-3xl font-black mb-6">{names || 'Tu Evento'}</h2>

                                            <button
                                                className="px-8 py-4 rounded-full font-bold shadow-xl transition-transform hover:scale-105"
                                                style={{ backgroundColor: customTheme.accentColor, color: customTheme.backgroundColor }}
                                            >
                                                Mí Boleto VIP
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="mt-12 flex gap-4">
                            {step > 1 && (
                                <button type="button" onClick={() => setStep(step - 1)}
                                    className="w-1/3 py-4 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 transition-colors">
                                    Atrás
                                </button>
                            )}
                            <button type="button" onClick={handleNext}
                                disabled={isSubmitting || (step === 1 && !eventType) || (step === 2 && !names) || (step === 3 && (!date || !location)) || (step === 4 && !coverImageFile)}
                                className={`flex-1 py-4 rounded-xl font-bold text-black uppercase tracking-widest text-sm transition-transform ${isSubmitting || (step === 1 && !eventType) || (step === 2 && !names) || (step === 3 && (!date || !location)) || (step === 4 && !coverImageFile) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'}`}
                                style={{ background: '#BCA872', boxShadow: '0 8px 25px rgba(188,168,114,0.3)' }}>
                                {isSubmitting ? 'Creando evento...' : step === 5 ? 'Generar Evento de Prueba' : 'Siguiente'}
                            </button>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    )
}
