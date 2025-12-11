// VERSION FINAL V6 - FILTRO DE SALUDOS ACTIVADO
import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, X, Terminal, CheckCircle2, Send, MapPin, Eye, Building2, Search, AlertTriangle 
} from 'lucide-react';

// --- VERIFICACIÓN DE URL ---
// Asegúrate de que esta sea la dirección EXACTA que sale en tu panel de Render
const API_URL = "https://soynexo-servidor-final.onrender.com/api/audit";

// --- COMPONENTE MAPA ---
const MapVisualizer = ({ query, realLink }) => {
  if (!query) return null;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="w-full bg-[#020B14] border-t border-white/10 flex flex-col animate-fade-in-up shrink-0 mt-4 rounded-lg overflow-hidden">
      <div className="bg-[#FF6B00] px-3 py-2 flex justify-between items-center text-white">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <Eye className="w-4 h-4" /> EVIDENCIA ENCONTRADA
        </div>
        {realLink ? (
             <a href={realLink} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono opacity-80 hover:opacity-100 hover:underline flex items-center gap-1 cursor-pointer">
                VER FICHA ↗
             </a>
        ) : (
            <div className="text-[10px] font-mono opacity-80">SATÉLITE EN VIVO</div>
        )}
      </div>
      <div className="relative w-full h-48 bg-gray-900">
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

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { 
      text: "👋 Hola, soy la IA de Soy Nexo.\n\nEscribe el nombre de tu negocio y ciudad para auditar cuánto dinero estás perdiendo por no tener presencia digital.", 
      isBot: true 
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [mapQuery, setMapQuery] = useState(null);
  const [mapLink, setMapLink] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // --- SOLUCIÓN NUEVA: FILTRO LOCAL (EL "HOLA" SIN SERVIDOR) ---
    // Esto detecta el saludo en tu teléfono antes de enviarlo a la nube.
    const textoUsuario = input.toLowerCase().trim();
    const saludos = ["hola", "buenos dias", "buenas", "que tal", "inicio", "prueba"];
    
    // Agregamos el mensaje del usuario al chat
    const userMessage = { text: input, isBot: false };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Si es un saludo, respondemos AQUÍ MISMO (Sin llamar al servidor)
    if (saludos.some(s => textoUsuario.includes(s)) && textoUsuario.length < 15) {
        setTimeout(() => {
            setMessages(prev => [...prev, { 
                text: "👋 ¡Hola! Soy el Auditor de Nexo.\n\nPara comenzar, necesito que escribas el **Nombre del Negocio** y la **Ciudad**.\n\nEjemplo: *'Tacos El Pariente en Navojoa'*", 
                isBot: true 
            }]);
        }, 500);
        return; // ¡IMPORTANTE! Aquí detenemos la función para no ir al servidor.
    }

    // --- SI NO ES SALUDO, VAMOS AL SERVIDOR ---
    setLoading(true);
    setMapQuery(null);

    try {
      console.log("📡 Conectando a:", API_URL); // Para ver en consola si la liga está bien
      
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            businessName: userMessage.text, // Usamos el texto original
            city: "Mexico" 
        })
      });

      const data = await res.json();

      if (data.success) {
        // ACTIVAMOS EL MAPA
        if (data.data && data.data.direccion) {
            setMapQuery(data.data.direccion); 
        } else {
            setMapQuery(`${userMessage.text} Mexico`);
        }
        
        if (data.data && data.data.mapa_oficial) {
            setMapLink(data.data.mapa_oficial);
        }

        const botMessage = { text: data.ai_analysis, isBot: true, isHtml: true };
        setMessages(prev => [...prev, botMessage]);
      } else {
        // Si el servidor dice que no encontró nada
        setMessages(prev => [...prev, { 
            text: data.message || "🚫 No pude encontrar ese negocio. Intenta ser más específico (Ej: 'Tacos El Pariente en Navojoa').", 
            isBot: true 
        }]);
      }
    } catch (error) {
      console.error("Error de conexión:", error);
      setMessages(prev => [...prev, { text: "❌ Error de conexión. Verifica tu internet o intenta de nuevo.", isBot: true }]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#020B14] text-white font-sans selection:bg-[#FF6B00] selection:text-white flex flex-col">
      {/* NAVBAR */}
      <nav className="fixed w-full z-50 bg-[#020B14]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
               <div className="bg-gradient-to-r from-[#FF6B00] to-[#FF8533] p-1.5 rounded text-white font-bold">
                 <Terminal size={20} />
               </div>
               <span className="font-bold text-xl tracking-tight">SOY NEXO</span>
            </div>
          </div>
        </div>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-grow pt-20 pb-10 px-4 flex flex-col items-center justify-center">
        <div className="text-center mb-6 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] text-xs font-bold uppercase tracking-wider mb-4 border border-[#FF6B00]/20">
            <span className="animate-pulse">●</span> Sistema Online V5.0
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight leading-tight">
            Consultoría <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-[#FF9E00]">Forense</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg px-2">
            Nuestra IA analiza tus pérdidas financieras en tiempo real.
          </p>
        </div>

        {/* CHAT INTERFACE */}
        <div className="w-full max-w-lg bg-[#0A1625] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col h-[75vh] md:h-[600px]">
          <div className="bg-[#0f1f30] p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-ping absolute top-0 right-0"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full relative border-2 border-[#0f1f30]"></div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Auditoría IA</h3>
                <p className="text-[10px] text-green-400 font-mono">EN LÍNEA • RASTREANDO</p>
              </div>
            </div>
            <Terminal className="text-white/20 w-5 h-5" />
          </div>

          {/* MENSAJES */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-[#FF6B00]/20 scrollbar-track-transparent">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
                <div className={`
                  max-w-[85%] rounded-2xl p-4 text-base leading-relaxed shadow-sm
                  ${msg.isBot 
                    ? 'bg-[#132335] text-gray-200 border border-white/5 rounded-tl-none' 
                    : 'bg-[#FF6B00] text-white font-medium rounded-tr-none shadow-lg shadow-[#FF6B00]/20'}
                `}>
                  {msg.isHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                  ) : (
                      <div className="whitespace-pre-line">{msg.text}</div>
                  )}
                </div>
              </div>
            ))}
            {mapQuery && <MapVisualizer query={mapQuery} realLink={mapLink} />}
            {loading && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-[#132335] rounded-2xl p-4 text-gray-400 text-sm flex items-center gap-2">
                  <Search className="w-4 h-4 animate-spin" />
                  Analizando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div className="p-4 bg-[#0f1f30] border-t border-white/5">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ej: Tacos El Pariente en Navojoa..."
                className="flex-1 bg-[#020B14] border border-white/10 rounded-xl px-4 py-4 text-base text-white focus:outline-none focus:border-[#FF6B00] transition-colors placeholder:text-gray-600"
                style={{ fontSize: '16px' }} 
              />
              <button 
                type="submit"
                disabled={loading}
                className="bg-[#FF6B00] hover:bg-[#FF8533] text-white p-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FF6B00]/20 active:scale-95 flex items-center justify-center"
              >
                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={24} />}
              </button>
            </form>
          </div>
        </div>
      </main>
      
      <footer className="py-6 text-center text-gray-600 text-xs">
        <p>© 2025 Soy Nexo | Ingeniería de Cierre</p>
      </footer>
    </div>
  );
}

export default App;