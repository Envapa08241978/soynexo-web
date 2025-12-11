import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Zap, 
  Activity, 
  MessageSquare, 
  Menu, 
  X, 
  Terminal, 
  CheckCircle2,
  Send,
  MapPin,
  Eye,
  Building2,
  Search,
  AlertTriangle
} from 'lucide-react';

// --- 🔌 CAMBIO PRINCIPAL: CONEXIÓN AL SERVIDOR REAL ---
// En lugar de la API Key de Gemini, ahora apuntamos a tu cerebro local
const API_URL = "https://soynexo-servidor-final.onrender.com/api/audit"; 

// --- MAPEO DE ASSETS (TU DISEÑO ORIGINAL) ---
const ASSETS = {
  logoMain: "logo-main.png",           
  logoHorizontal: "logo-horizontal.png",
  favicon: "favicon.jpg",             
  bgHero: "bg-hero.jpg",               
  bgServices: "bg-services.jpg",       
  bgCta: "bg-cta.jpg",                 
};

// --- COLORES DE MARCA ---
const BRAND_COLORS = {
  deepBlue: "#0A2540",
  neonOrange: "#FF6B00",
  techWhite: "#FFFFFF",
  circuitGray: "#1E3A5F"
};

// --- DATOS DE CONTACTO ---
const CONTACT_INFO = {
  whatsapp: "5216421513997",
  email: "hola@soynexo.com",
  whatsappDisplay: "+52 1 642 151 3997"
};

// --- CATÁLOGO DE SERVICIOS ---
const SERVICES = [
  {
    id: "aic-v1",
    code: "AIC-v1",
    title: "Auditoría de Integridad",
    desc: "Análisis forense de su presencia digital. Detectamos errores en Maps, falta de catálogo y fugas de capital.",
    icon: <Activity className="w-8 h-8" />,
    features: ["Diagnóstico de Maps", "Análisis de Latencia", "Reporte ROI"]
  },
  {
    id: "nrn-v2",
    code: "NRN-v2",
    title: "Chatbot IA (24/7)",
    desc: "Operador digital que nunca duerme. Responde preguntas, muestra productos y filtra curiosos automáticamente.",
    icon: <Cpu className="w-8 h-8" />,
    features: ["Respuesta Inmediata", "Catálogo en WhatsApp", "Filtro de Ventas"]
  },
  {
    id: "prf-v1",
    code: "PRF-v1",
    title: "CRM de Reactivación",
    desc: "Sistema de seguimiento automatizado para recuperar a los clientes que preguntaron precio y no compraron.",
    icon: <Zap className="w-8 h-8" />,
    features: ["Seguimiento Automático", "Recuperación de Cartera", "Alertas de Venta"]
  }
];

// --- COMPONENTE MAPA (CORREGIDO) ---
const MapVisualizer = ({ query, realLink }) => {
  if (!query) return null;
  // Usamos la dirección estándar que NUNCA falla
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="w-full bg-[#020B14] border-t border-white/10 flex flex-col animate-fade-in-up shrink-0">
      <div className="bg-[#FF6B00] px-3 py-1 flex justify-between items-center text-white">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <Eye className="w-3 h-3" /> EVIDENCIA ENCONTRADA
        </div>
        {realLink ? (
             <a href={realLink} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono opacity-80 hover:opacity-100 hover:underline flex items-center gap-1 cursor-pointer">
                VER FICHA OFICIAL ↗
             </a>
        ) : (
            <div className="text-[9px] font-mono opacity-80">LIVE SATELLITE</div>
        )}
      </div>
      <div className="relative w-full h-40 bg-gray-900">
        <iframe 
          width="100%" 
          height="100%" 
          src={mapSrc} 
          frameBorder="0" 
          title="Map Preview"
          className="opacity-90 hover:opacity-100 transition-opacity w-full h-full"
        ></iframe>
      </div>
    </div>
  );
};

// --- COMPONENTE TÍTULO ---
const SectionTitle = ({ subtitle, title }) => (
  <div className="mb-8 md:mb-12">
    <div className="flex items-center gap-2 mb-2">
      <div className="h-[1px] w-8 bg-[#FF6B00]"></div>
      <span className="text-[#FF6B00] font-mono text-sm uppercase tracking-widest">{subtitle}</span>
    </div>
    <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white font-sans uppercase leading-tight">
      {title}
    </h2>
  </div>
);

// --- CEREBRO DEL BOT (RE-INGENIERÍA TOTAL AQUI) ---
const SalesTerminal = ({ context }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [locationQuery, setLocationQuery] = useState(null);
  const [officialLink, setOfficialLink] = useState(null);
  
  const chatContainerRef = useRef(null); 
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
        let intro = "Iniciando Protocolo de Auditoría Real.\n\nSoy el Auditor de Integridad de Soy Nexo. Estoy conectado directamente a Google Maps.\n\nEscriba el nombre del negocio y la ciudad (Ej: 'Pizzería Los Arcos en Guadalajara') para iniciar el rastreo.";
        
        if (context && context.includes("Interés")) {
             intro = `Iniciando análisis específico para: ${context.replace("Interés en: ", "")}.\n\nIndique el nombre del negocio y la ciudad para auditar.`;
        }

        setMessages([{ id: Date.now(), type: 'bot', text: intro }]);
        hasInitialized.current = true;
    }
  }, [context]);

  // SCROLL INTELIGENTE
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput("");
    
    // 1. Ponemos el mensaje del usuario en pantalla
    const newHistory = [...messages, { id: Date.now(), type: 'user', text: userText }];
    setMessages(newHistory);
    setIsTyping(true);
    setReportData(null); // Reseteamos botones viejos

    try {
        // 2. Preparamos los datos para el servidor
        // Intentamos separar "Nombre" de "Ciudad" usando la palabra " en "
        const parts = userText.split(' en ');
        const businessName = parts[0];
        const city = parts[1] || "Mexico"; // Si no pone ciudad, busca en general

        // 3. LLAMADA AL SERVIDOR REAL (Adiós Gemini directo)
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessName, city })
        });

        const data = await response.json();
        
        // 4. Procesamos la respuesta
        setIsTyping(false);

        if (!data.found) {
            // Caso: No existe en Google
            setMessages(prev => [...prev, { 
                id: Date.now() + 1, 
                type: 'bot', 
                text: data.message || "No encontré ese negocio en Google Maps. Error crítico de visibilidad." 
            }]);
            setLocationQuery(null);
        } else {
            // Caso: Encontrado -> Mostramos análisis y mapa real
            setMessages(prev => [...prev, { 
                id: Date.now() + 1, 
                type: 'bot', 
                text: data.ai_analysis 
            }]);
            
            // Activamos el mapa con la dirección que nos devolvió Google
            setLocationQuery(`${data.data.nombre}, ${data.data.direccion}`);
            setOfficialLink(data.data.mapa_oficial);
            
            // Activamos el botón de venta
            setReportData(data.ai_analysis);
        }

    } catch (error) {
        console.error(error);
        setIsTyping(false);
        setMessages(prev => [...prev, { 
            id: Date.now() + 1, 
            type: 'bot', 
            text: "⚠️ Error de conexión: No logro comunicarme con el Servidor Central (app.js). Verifique que la terminal negra esté ejecutándose en el puerto 3000." 
        }]);
    }
  };

  const handleWhatsAppClick = () => {
    if (!reportData) return;
    // Limpiamos las etiquetas HTML (<br>, <b>) para que se lea bien en WhatsApp
    const cleanReport = reportData.replace(/<[^>]*>?/gm, ''); 
    const message = `*AUDITORÍA SOY NEXO*\n\n${cleanReport}\n\n[Quiero corregir esto]`;
    const url = `https://wa.me/${CONTACT_INFO.whatsapp}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="w-full h-[80vh] md:h-[650px] bg-[#051626] rounded-xl border border-[#FF6B00]/30 shadow-2xl flex flex-col overflow-hidden relative font-sans transition-all duration-300 max-w-full">
      
      {/* Header */}
      <div className="bg-[#0A2540] p-4 border-b border-white/10 flex items-center justify-between shadow-lg z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-[#FF6B00]/20 p-2 rounded-lg">
             <Search className="w-5 h-5 text-[#FF6B00]" />
          </div>
          <div>
            <div className="font-bold text-white text-sm tracking-wide">AUDITORÍA TÉCNICA (REAL)</div>
            <div className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              CONECTADO A GOOGLE PLACES
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-[#FF6B00]/20 bg-[#051626] scroll-smooth"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-md text-sm leading-relaxed ${
              msg.type === 'user' 
                ? 'bg-[#FF6B00] text-white rounded-br-none' 
                : 'bg-[#1E3A5F] text-gray-100 rounded-bl-none border border-white/5'
            }`}>
              {/* Usamos dangerouslySetInnerHTML para leer las negritas que manda el servidor */}
              <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
            </div>
          </div>
        ))}

        {isTyping && (
            <div className="flex justify-start">
                <div className="bg-[#1E3A5F] p-4 rounded-2xl rounded-bl-none flex items-center gap-2 text-gray-400 text-xs border border-white/5">
                    <Activity className="w-3 h-3 animate-spin text-[#FF6B00]" />
                    <span>Conectando con Google Maps Platform...</span>
                </div>
            </div>
        )}
      </div>

      {/* ZONA INFERIOR */}
      <div className="bg-[#020B14] shrink-0 flex flex-col w-full">
          
          <div className="p-3 border-t border-white/10">
            {reportData ? (
                <div className="animate-fade-in-up">
                    <div className="mb-2 text-center text-xs text-gray-400 font-mono flex items-center justify-center gap-2">
                         <AlertTriangle className="w-3 h-3 text-yellow-500" /> ERRORES DETECTADOS
                    </div>
                    <button 
                        onClick={handleWhatsAppClick}
                        className="w-full py-4 rounded-lg font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg hover:shadow-green-900/50 hover:-translate-y-1"
                    >
                        <MessageSquare className="w-6 h-6" />
                        SOLICITAR CORRECCIÓN EN WHATSAPP
                    </button>
                    <button 
                        onClick={() => { setReportData(null); setInput(""); }}
                        className="w-full mt-2 py-2 text-[10px] text-gray-500 hover:text-white uppercase tracking-wider"
                    >
                        Nueva Búsqueda
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSend} className="flex gap-2">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ej: Tacos El Pariente en Navojoa"
                        className="flex-1 bg-[#0A2540] border border-white/10 text-white px-4 py-3 rounded-lg focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] focus:outline-none transition-all placeholder-gray-500 font-sans text-base w-full"
                    />
                    <button 
                        type="submit" 
                        disabled={!input.trim() || isTyping}
                        className="bg-[#FF6B00] text-white p-3 rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            )}
          </div>

          {locationQuery && (
             <MapVisualizer query={locationQuery} realLink={officialLink} />
          )}
      </div>

    </div>
  );
};

// --- COMPONENTE PRINCIPAL APP (SIN CAMBIOS VISUALES) ---
export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [terminalContext, setTerminalContext] = useState(null);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTerminal = (context = null) => {
    setTerminalContext(context);
    const element = document.getElementById('contacto-ia');
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden text-white font-sans selection:bg-[#FF6B00] selection:text-white" style={{ backgroundColor: BRAND_COLORS.deepBlue }}>
      
      {/* Navbar */}
      <nav className={`fixed w-full z-50 transition-all duration-300 border-b border-white/10 ${isScrolled ? 'bg-[#0A2540]/95 backdrop-blur-md py-2 shadow-lg' : 'bg-transparent py-4'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <img src={ASSETS.logoHorizontal} alt="Soy Nexo" className="h-8 md:h-10 w-auto object-contain" />
          <div className="hidden md:flex items-center gap-8 font-mono text-sm text-gray-300">
            <a href="#filosofia" className="hover:text-[#FF6B00] transition-colors hover:glow">[ FILOSOFÍA ]</a>
            <a href="#servicios" className="hover:text-[#FF6B00] transition-colors hover:glow">[ SOLUCIONES ]</a>
            <button onClick={() => scrollToTerminal("Consulta General")} className="border border-[#FF6B00] text-[#FF6B00] px-4 py-2 hover:bg-[#FF6B00] hover:text-white transition-all flex items-center gap-2 rounded-sm font-mono text-xs uppercase tracking-wider">
              <Terminal className="w-4 h-4" /> CONSULTA
            </button>
          </div>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-[#FF6B00]">
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {isMenuOpen && (
           <div className="md:hidden absolute top-full left-0 w-full bg-[#0A2540] border-b border-white/10 p-6 flex flex-col gap-4 shadow-2xl">
            <a href="#filosofia" onClick={() => setIsMenuOpen(false)} className="font-mono text-gray-300 py-2">01. FILOSOFÍA</a>
            <a href="#servicios" onClick={() => setIsMenuOpen(false)} className="font-mono text-gray-300 py-2">02. SOLUCIONES</a>
            <button onClick={() => {setIsMenuOpen(false); scrollToTerminal();}} className="text-[#FF6B00] font-bold py-2 text-left">03. CONTACTAR IA</button>
           </div>
        )}
      </nav>

      {/* Hero */}
      <header className="relative min-h-screen flex items-center pt-32 pb-48 lg:py-0 overflow-hidden w-full">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[#0A2540] opacity-90 z-10 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A2540]/50 to-[#0A2540] z-10"></div>
          <img src={ASSETS.bgHero} className="w-full h-full object-cover opacity-40" alt="hero bg" />
        </div>
        <div className="container mx-auto px-6 relative z-20">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-[#FF6B00]/30 bg-[#FF6B00]/10 text-[#FF6B00] font-mono text-xs mb-6 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-[#FF6B00]"></span> SISTEMAS DE CIERRE //
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 font-sans">
                EL MARKETING ATRAE MIRADAS.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">LA INGENIERÍA ASEGURA </span>
                <span className="text-[#FF6B00] ml-2 drop-shadow-[0_0_15px_rgba(255,107,0,0.5)]">RESULTADOS.</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-300 max-w-2xl mb-10 font-light font-mono leading-relaxed border-l-2 border-[#FF6B00] pl-6">
                Deje de pagar por "Likes". En Soy Nexo instalamos sistemas de inteligencia artificial que responden, atienden y venden 24/7.
              </p>
            </div>
            <div className="lg:w-1/2 flex justify-center lg:justify-end mt-16 mb-12 lg:mt-0 lg:mb-0">
              <img src={ASSETS.logoMain} alt="Soy Nexo Logo Principal" className="w-full max-w-md object-contain drop-shadow-[0_0_30px_rgba(255,107,0,0.2)] hover:drop-shadow-[0_0_50px_rgba(255,107,0,0.4)] transition-all duration-500" />
            </div>
          </div>
        </div>
      </header>

      {/* Filosofía */}
      <section id="filosofia" className="py-24 relative bg-[#081f36] border-b border-white/5 w-full">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <SectionTitle subtitle="El Problema Real" title="LA FUGA SILENCIOSA" />
              <div className="space-y-8 font-mono text-gray-400 text-sm leading-relaxed">
                <div>
                  <h3 className="text-white font-bold mb-3 uppercase tracking-wider text-xs border-l-2 border-[#FF6B00] pl-3">Datos relevantes sobre búsquedas móviles locales</h3>
                  <p className="mb-4">Un gran porcentaje de búsquedas locales se hacen desde smartphones: alrededor del <span className="text-[#FF6B00]">57% al 67%</span> de las búsquedas con intención de encontrar negocios locales vienen de móviles.</p>
                  <p className="mb-4">De quienes hacen esas búsquedas móviles, hasta un <span className="text-[#FF6B00]">88% termina llamando o visitando</span> el negocio en menos de 24 horas.</p>
                </div>
              </div>
            </div>
             <div className="relative self-center">
                <div className="absolute inset-0 bg-[#FF6B00] blur-[100px] opacity-10"></div>
                <img src={ASSETS.bgCta} alt="Circuitry" className="relative z-10 rounded border border-white/10 shadow-2xl grayscale hover:grayscale-0 transition-all duration-500" />
            </div>
          </div>
        </div>
      </section>

      {/* Servicios */}
      <section id="servicios" className="py-24 relative w-full">
        <div className="absolute inset-0 z-0 opacity-20"><img src={ASSETS.bgServices} className="w-full h-full object-cover" alt="bg" /></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-[#FF6B00] font-mono text-sm uppercase tracking-widest">[ CATÁLOGO DE INGENIERÍA ]</span>
            <h2 className="text-2xl md:text-5xl font-bold text-white mt-4 mb-6">SOLUCIONES TÉCNICAS</h2>
            <p className="text-gray-400">Seleccione el sistema que su empresa necesita para ver detalles.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {SERVICES.map((service) => (
              <div key={service.id} className="group bg-[#0D2B4A]/80 backdrop-blur-sm border border-white/10 p-8 hover:border-[#FF6B00] transition-all duration-300 hover:-translate-y-1 flex flex-col">
                <div className="mb-6 text-[#FF6B00] bg-[#FF6B00]/10 p-4 inline-block rounded-full w-fit">{service.icon}</div>
                <div className="font-mono text-xs text-gray-500 mb-2">{service.code}</div>
                <h3 className="text-xl font-bold text-white mb-4">{service.title}</h3>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-1">{service.desc}</p>
                <ul className="space-y-2 mb-8">
                  {service.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-gray-300 font-mono"><CheckCircle2 className="w-3 h-3 text-[#FF6B00]" /> {feat}</li>
                  ))}
                </ul>
                <button onClick={() => scrollToTerminal(`Interés en: ${service.title}`)} className="w-full py-3 border border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white transition-all font-mono text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2">
                  <Cpu className="w-4 h-4" /> CONSULTA TECNICA CON LA IA
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Terminal */}
      <section id="contacto-ia" className="py-16 bg-[#020B14] border-t border-white/10 w-full">
        <div className="container mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-start gap-12">
                <div className="lg:w-1/3">
                    <SectionTitle subtitle="Iniciar Consultoría Gratuita" title="CONSULTORÍA TÉCNICA" />
                    <p className="text-gray-400 font-mono mb-8 text-sm leading-relaxed">
                        Utilice esta terminal para verificar la viabilidad de nuestros sistemas en su negocio. Nuestra IA buscará su presencia en Google en tiempo real para generar un reporte forense.
                    </p>
                    <div className="mt-8 space-y-4">
                        <div className="flex items-center gap-3 text-gray-400 text-sm"><Building2 className="w-5 h-5 text-blue-400" /> <span>Diagnóstico Sector Público/Privado</span></div>
                         <div className="flex items-center gap-3 text-gray-400 text-sm"><MapPin className="w-5 h-5 text-[#FF6B00]" /> <span>Verificación de Google Maps</span></div>
                    </div>
                </div>
                <div className="lg:w-2/3 w-full">
                    <SalesTerminal context={terminalContext} />
                </div>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A2540] py-12 border-t border-white/5 w-full">
        <div className="container mx-auto px-6 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
                <img src={ASSETS.logoMain} alt="Logo" className="h-16 w-auto mb-4 mx-auto md:mx-0 opacity-80" />
                <p className="text-xs font-mono text-gray-500">Ingeniería de Cierre © {new Date().getFullYear()}</p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2">
                <p className="text-sm text-gray-300 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#FF6B00]" /> Navojoa, Sonora</p>
                <p className="text-sm text-gray-300 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-[#FF6B00]" /> {CONTACT_INFO.whatsappDisplay}</p>
            </div>
        </div>
      </footer>
    </div>
  );
}
