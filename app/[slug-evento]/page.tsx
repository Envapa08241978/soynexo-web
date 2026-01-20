'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import components to avoid SSR issues with Matter.js
const GravityWall = dynamic(() => import('@/components/GravityWall'), {
    ssr: false,
    loading: () => (
        <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/70 text-lg">Cargando el muro...</p>
            </div>
        </div>
    )
})

const GalleryView = dynamic(() => import('@/components/GalleryView'), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/70 text-lg">Cargando galería...</p>
            </div>
        </div>
    )
})

const MobileUploader = dynamic(() => import('@/components/MobileUploader'), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/70 text-lg">Cargando...</p>
            </div>
        </div>
    )
})

interface EventPageProps {
    params: { 'slug-evento': string }
}

type ViewMode = 'gravity' | 'gallery'

export default function EventPage({ params }: EventPageProps) {
    const eventSlug = params['slug-evento']
    const [isMobile, setIsMobile] = useState<boolean | null>(null)
    const [viewMode, setViewMode] = useState<ViewMode>('gallery') // Default to gallery for easy viewing

    useEffect(() => {
        // Detect if device is mobile based on screen width and touch capability
        const checkMobile = () => {
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
            const isSmallScreen = window.innerWidth < 1024
            setIsMobile(isTouchDevice && isSmallScreen)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)

        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Show loading while determining device type
    if (isMobile === null) {
        return (
            <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/70 text-lg">Preparando experiencia...</p>
                </div>
            </div>
        )
    }

    // Mobile view - now shows gallery with upload capability (same as desktop)
    // Users can browse photos AND upload from the gallery view

    // Desktop view with mode toggle
    return (
        <>
            {/* Mode toggle - floating button */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                <div className="glass-strong rounded-full p-1 flex gap-1">
                    <button
                        onClick={() => setViewMode('gallery')}
                        className={`px-6 py-3 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'gallery'
                                ? 'bg-accent-500 text-white shadow-lg'
                                : 'text-white/70 hover:text-white'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        Álbum
                    </button>
                    <button
                        onClick={() => setViewMode('gravity')}
                        className={`px-6 py-3 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'gravity'
                                ? 'bg-accent-500 text-white shadow-lg'
                                : 'text-white/70 hover:text-white'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                        Gravity
                    </button>
                </div>
            </div>

            {/* Render selected view */}
            {viewMode === 'gallery' ? (
                <GalleryView eventSlug={eventSlug} />
            ) : (
                <GravityWall eventSlug={eventSlug} />
            )}
        </>
    )
}
