'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Home() {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [showContactForm, setShowContactForm] = useState(false)
    const [contactData, setContactData] = useState({
        nombre: '',
        tipoEvento: '',
        fechaEvento: ''
    })

    const handleContactSubmit = () => {
        const mensaje = `Hola! Me interesa contratar Soy Nexo 🎉%0A%0A*Datos del evento:*%0A- Nombre: ${contactData.nombre}%0A- Tipo de evento: ${contactData.tipoEvento}%0A- Fecha: ${contactData.fechaEvento}`
        window.open(`https://wa.me/526421600559?text=${mensaje}`, '_blank')
        setShowContactForm(false)
        setContactData({ nombre: '', tipoEvento: '', fechaEvento: '' })
    }

    return (
        <main className="min-h-screen">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 glass">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <svg
                            className="w-10 h-10 text-accent-500"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle cx="12" cy="12" r="3" fill="currentColor" />
                            <circle cx="4" cy="8" r="2" fill="currentColor" opacity="0.7" />
                            <circle cx="20" cy="8" r="2" fill="currentColor" opacity="0.7" />
                            <circle cx="4" cy="16" r="2" fill="currentColor" opacity="0.7" />
                            <circle cx="20" cy="16" r="2" fill="currentColor" opacity="0.7" />
                            <path
                                d="M12 12L4 8M12 12L20 8M12 12L4 16M12 12L20 16"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                opacity="0.5"
                            />
                        </svg>
                        <span className="text-2xl font-bold gradient-text">Soy Nexo</span>
                    </div>

                    <nav className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-white/70 hover:text-white transition-colors">
                            Características
                        </a>
                        <a href="#how-it-works" className="text-white/70 hover:text-white transition-colors">
                            Cómo funciona
                        </a>
                        <a href="#pricing" className="text-white/70 hover:text-white transition-colors">
                            Precios
                        </a>
                        <Link
                            href="/demo-evento"
                            className="btn-primary text-sm py-2 px-4"
                        >
                            Ver Demo
                        </Link>
                    </nav>

                    {/* Mobile menu button */}
                    <button
                        className="md:hidden text-white p-2"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="md:hidden absolute top-full left-0 right-0 bg-[#0f0a1e] border-b border-white/10 p-4 shadow-2xl animate-fade-in text-center">
                        <div className="flex flex-col gap-4">
                            <a
                                href="#features"
                                className="text-white/80 hover:text-white py-2"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Características
                            </a>
                            <a
                                href="#how-it-works"
                                className="text-white/80 hover:text-white py-2"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Cómo funciona
                            </a>
                            <a
                                href="#pricing"
                                className="text-white/80 hover:text-white py-2"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Precios
                            </a>
                            <Link
                                href="/demo-evento"
                                className="btn-primary py-3"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Ver Demo
                            </Link>
                        </div>
                    </div>
                )}
            </header>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center overflow-hidden">
                {/* Animated background orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-float" />
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
                    <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '-1.5s' }} />
                </div>

                <div className="container mx-auto px-6 pt-24 grid lg:grid-cols-2 gap-12 items-center relative z-10">
                    {/* Left side - Text content */}
                    <div className="space-y-8">
                        <div className="inline-block">
                            <span className="px-4 py-2 rounded-full text-sm font-medium bg-accent-500/20 text-accent-400 border border-accent-500/30">
                                📸 El álbum digital de tu evento
                            </span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                            Tu fiesta,<br />
                            <span className="gradient-text">un álbum colaborativo</span>
                        </h1>

                        <p className="text-xl text-white/60 max-w-lg">
                            Los invitados suben fotos y videos desde sus teléfonos. Todos pueden ver,
                            disfrutar y descargar los mejores momentos al instante.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link href="/demo-evento" className="btn-primary text-center text-lg">
                                Ver Demo en Vivo
                            </Link>
                            <button
                                onClick={() => setShowContactForm(true)}
                                className="px-8 py-4 rounded-xl font-semibold text-white transition-all duration-300 bg-green-600 hover:bg-green-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                Contratar Ahora
                            </button>
                        </div>

                        {/* Trust badges */}
                        <div className="flex items-center gap-8 pt-8 border-t border-white/10">
                            <div className="text-center">
                                <div className="text-3xl font-bold gradient-text">500+</div>
                                <div className="text-sm text-white/50">Eventos</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold gradient-text">50K+</div>
                                <div className="text-sm text-white/50">Fotos y videos</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold gradient-text">100%</div>
                                <div className="text-sm text-white/50">Descargables</div>
                            </div>
                        </div>
                    </div>

                    {/* Right side - Hero image */}
                    <div className="relative">
                        <div className="relative rounded-2xl overflow-hidden glow-purple">
                            {/* Placeholder image from Unsplash */}
                            {/* TODO: REEMPLAZAR CON IMAGEN DE MARKETING PROPIA */}
                            <img
                                src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1280&h=720&fit=crop"
                                alt="Evento con pantalla interactiva"
                                className="w-full h-auto object-cover aspect-video"
                            />
                            {/* Overlay gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                            {/* Floating card */}
                            <div className="absolute bottom-6 left-6 right-6 glass-strong rounded-xl p-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-white font-semibold">Nueva foto recibida</div>
                                        <div className="text-white/50 text-sm">De: Mesa 7 - hace 2 segundos</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Decorative elements */}
                        <div className="absolute -top-4 -right-4 w-24 h-24 border-2 border-accent-500/30 rounded-2xl" />
                        <div className="absolute -bottom-4 -left-4 w-32 h-32 border-2 border-primary-500/30 rounded-2xl" />
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                    <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            El álbum que <span className="gradient-text">todos crean</span>
                        </h2>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto">
                            Fotos, videos, y la posibilidad de descargar todo. Tu evento, desde todos los ángulos.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 - Gallery */}
                        <div className="glass rounded-2xl p-8 hover:scale-105 transition-transform duration-300">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent-500 to-primary-500 flex items-center justify-center mb-6">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold mb-3">Galería Visual</h3>
                            <p className="text-white/60">
                                Ve todas las fotos y videos en una galería elegante.
                                Visor a pantalla completa con navegación fácil.
                            </p>
                        </div>

                        {/* Feature 2 - Download */}
                        <div className="glass rounded-2xl p-8 hover:scale-105 transition-transform duration-300">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center mb-6">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold mb-3">Descarga Todo</h3>
                            <p className="text-white/60">
                                Descarga individual o masiva. Todos los recuerdos
                                de tu evento, listos para guardar.
                            </p>
                        </div>

                        {/* Feature 3 - Photo + Video */}
                        <div className="glass rounded-2xl p-8 hover:scale-105 transition-transform duration-300">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-pink-500 to-accent-500 flex items-center justify-center mb-6">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold mb-3">Fotos y Videos</h3>
                            <p className="text-white/60">
                                No solo fotos. También videos cortos que capturan
                                la energía y emoción del momento.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 animated-gradient opacity-10" />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Cómo <span className="gradient-text">funciona</span>
                        </h2>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto">
                            En solo 3 pasos, tu evento cobra vida
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Step 1 */}
                        <div className="relative">
                            <div className="text-8xl font-bold text-white/5 absolute -top-8 -left-4">1</div>
                            <div className="relative z-10 pt-12">
                                <div className="w-20 h-20 rounded-2xl glass-strong flex items-center justify-center mb-6 glow-purple">
                                    <svg className="w-10 h-10 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold mb-3">Escanea el QR</h3>
                                <p className="text-white/60">
                                    Los invitados escanean el código QR que colocas en las mesas o entrada del evento.
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="relative">
                            <div className="text-8xl font-bold text-white/5 absolute -top-8 -left-4">2</div>
                            <div className="relative z-10 pt-12">
                                <div className="w-20 h-20 rounded-2xl glass-strong flex items-center justify-center mb-6 glow-blue">
                                    <svg className="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold mb-3">Sube foto o video</h3>
                                <p className="text-white/60">
                                    Toman una foto, graban un video o eligen de su galería.
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="relative">
                            <div className="text-8xl font-bold text-white/5 absolute -top-8 -left-4">3</div>
                            <div className="relative z-10 pt-12">
                                <div className="w-20 h-20 rounded-2xl glass-strong flex items-center justify-center mb-6 animate-pulse-glow">
                                    <svg className="w-10 h-10 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold mb-3">Ve y Descarga</h3>
                                <p className="text-white/60">
                                    Todo aparece en el álbum. Visualiza y descarga los recuerdos.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-24">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Un precio, <span className="gradient-text">todo incluido</span>
                        </h2>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto">
                            Sin sorpresas, sin letras pequeñas. Todo lo que necesitas para tu evento.
                        </p>
                    </div>

                    <div className="max-w-lg mx-auto">
                        <div className="relative glass-strong rounded-3xl p-8 md:p-12 overflow-hidden glow-purple">
                            {/* Popular badge */}
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-accent-500 to-primary-500 text-white text-xs font-bold px-4 py-2 rounded-bl-xl rounded-tr-3xl">
                                PAQUETE COMPLETO
                            </div>

                            {/* Price */}
                            <div className="text-center mb-8">
                                <div className="flex items-baseline justify-center gap-2">
                                    <span className="text-6xl md:text-7xl font-bold gradient-text">$950</span>
                                    <span className="text-2xl text-white/60">MXN</span>
                                </div>
                                <p className="text-white/50 mt-2">Pago único por evento</p>
                            </div>

                            {/* Features list */}
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-white/80"><strong className="text-white">Página personalizada</strong> para tu evento</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-white/80"><strong className="text-white">Fotos y videos ilimitados</strong></span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-white/80"><strong className="text-white">100 tarjetas impresas</strong> con código QR</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-white/80"><strong className="text-white">Diseño personalizado</strong> con tu diseño existente</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-white/80"><strong className="text-white">Descarga todos los archivos</strong> después del evento</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-white/80"><strong className="text-white">Sincronización en tiempo real</strong></span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-white/80"><strong className="text-white">Servidor activo 36 horas</strong> para descargar archivos</span>
                                </li>
                            </ul>

                            {/* CTA Button */}
                            <button
                                onClick={() => setShowContactForm(true)}
                                className="w-full text-lg py-4 flex items-center justify-center gap-3 rounded-xl font-bold text-white transition-all duration-300 bg-green-600 hover:bg-green-500 hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-900/20"
                            >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                Contratar Ahora
                            </button>

                            <p className="text-center text-white/40 text-sm mt-4">
                                Respuesta inmediata • Sin compromiso
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Demo CTA Section */}
            <section className="py-24">
                <div className="container mx-auto px-6">
                    <div className="relative glass-strong rounded-3xl p-12 md:p-16 overflow-hidden">
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-500/20 rounded-full blur-3xl" />

                        <div className="relative z-10 text-center max-w-3xl mx-auto">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">
                                ¿Quieres probarlo <span className="gradient-text">en vivo</span>?
                            </h2>
                            <p className="text-xl text-white/60 mb-8">
                                Entra al demo y sube una foto o video. Verás cómo funciona en tiempo real.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link href="/demo-evento" className="btn-primary text-lg flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Ver Demo en Vivo
                                </Link>
                                <a
                                    href="https://wa.me/526421600559?text=Hola!%20Tengo%20una%20pregunta%20sobre%20Soy%20Nexo"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-8 py-4 rounded-xl font-semibold text-white transition-all duration-300 bg-green-600 hover:bg-green-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    Preguntar por WhatsApp
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/10">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <svg
                                className="w-8 h-8 text-accent-500"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <circle cx="12" cy="12" r="3" fill="currentColor" />
                                <circle cx="4" cy="8" r="2" fill="currentColor" opacity="0.7" />
                                <circle cx="20" cy="8" r="2" fill="currentColor" opacity="0.7" />
                                <circle cx="4" cy="16" r="2" fill="currentColor" opacity="0.7" />
                                <circle cx="20" cy="16" r="2" fill="currentColor" opacity="0.7" />
                                <path
                                    d="M12 12L4 8M12 12L20 8M12 12L4 16M12 12L20 16"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    opacity="0.5"
                                />
                            </svg>
                            <span className="text-xl font-bold gradient-text">Soy Nexo</span>
                        </div>

                        <p className="text-white/40 text-sm">
                            © 2024 Soy Nexo. Todos los derechos reservados.
                        </p>

                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setShowContactForm(true)}
                                className="text-white/50 hover:text-green-400 transition-colors"
                                title="Contáctanos por WhatsApp"
                            >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </button>
                            <a
                                href="https://www.facebook.com/SoyNexo1/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/50 hover:text-blue-400 transition-colors"
                                title="Síguenos en Facebook"
                            >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </a>
                            <a
                                href="https://www.instagram.com/soynexo1/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/50 hover:text-pink-400 transition-colors"
                                title="Síguenos en Instagram"
                            >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="mt-8 pt-6 border-t border-white/10">
                        <p className="text-white/30 text-xs text-center max-w-3xl mx-auto leading-relaxed">
                            <strong>Aviso importante:</strong> Los dispositivos móviles requieren conexión a internet (WiFi o datos móviles) para poder subir fotografías y videos.
                            Soy Nexo no se hace responsable por contenido inapropiado subido por terceros, falta de conexión a internet o señal de los usuarios,
                            ni por la disponibilidad del servicio de red móvil durante el evento.
                        </p>
                    </div>
                </div>
            </footer>

            {/* Contact Form Modal */}
            {showContactForm && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setShowContactForm(false)}
                >
                    <div
                        className="glass-strong rounded-3xl p-8 max-w-md w-full relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setShowContactForm(false)}
                            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                        >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Header */}
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">¡Cuéntanos de tu evento!</h2>
                            <p className="text-white/60 text-sm">Completa estos datos para enviarte una cotización personalizada</p>
                        </div>

                        {/* Form */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-white/70 text-sm mb-2">Tu nombre</label>
                                <input
                                    type="text"
                                    value={contactData.nombre}
                                    onChange={(e) => setContactData({ ...contactData, nombre: e.target.value })}
                                    placeholder="Ej: María García"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-accent-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-white/70 text-sm mb-2">Tipo de evento</label>
                                <select
                                    value={contactData.tipoEvento}
                                    onChange={(e) => setContactData({ ...contactData, tipoEvento: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-accent-500 transition-colors appearance-none cursor-pointer"
                                >
                                    <option value="" className="bg-slate-900">Selecciona...</option>
                                    <option value="Boda" className="bg-slate-900">Boda</option>
                                    <option value="XV Años" className="bg-slate-900">XV Años</option>
                                    <option value="Cumpleaños" className="bg-slate-900">Cumpleaños</option>
                                    <option value="Baby Shower" className="bg-slate-900">Baby Shower</option>
                                    <option value="Evento Corporativo" className="bg-slate-900">Evento Corporativo</option>
                                    <option value="Graduación" className="bg-slate-900">Graduación</option>
                                    <option value="Otro" className="bg-slate-900">Otro</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-white/70 text-sm mb-2">Fecha del evento</label>
                                <input
                                    type="date"
                                    value={contactData.fechaEvento}
                                    onChange={(e) => setContactData({ ...contactData, fechaEvento: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-accent-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            onClick={handleContactSubmit}
                            disabled={!contactData.nombre || !contactData.tipoEvento || !contactData.fechaEvento}
                            className="w-full mt-6 py-4 rounded-xl font-bold text-white transition-all duration-300 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Enviar por WhatsApp
                        </button>

                        <p className="text-center text-white/40 text-xs mt-4">
                            Te responderemos en minutos
                        </p>
                    </div>
                </div>
            )}
        </main>
    )
}
