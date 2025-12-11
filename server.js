const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors());

// --- ⚠️ IMPORTANTE: PEGA AQUÍ TUS DATOS DE FACEBOOK OTRA VEZ ---
const TOKEN = "EAFj4QWuVaT4BQIei0hlzSxGkpL0U5Q07Ta8knXfIQcOTbsZAcitUVSZCxfwYavZBbGqMZBLZCC5eFCgFxZCh7spPPOa2JBb2ySzeRc7glji5guJYem7bkZCP6joK0WZBnfbfsl8S4mb6PFuYd49dCGw1KNFmEj8IMM0OdBqGDOTNlqf9bXzzcxdt7Q0KgK7OZADiNtZBxuZAdhCAfyyPAur5KBauVSTq0wKmy3VAXW4vpxEkVStua4ZCLphKvCiZABVwuZAjUi9L6Mg9anVp88GrzbXhZBQ"; 
const PHONE_ID = "899157846613663";
const VERIFY_TOKEN = "soynexo123"; 

// 1. VERIFICACIÓN
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 2. LÓGICA DE NEGOCIO (Aquí ocurre la magia)
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object) {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const messageObj = body.entry[0].changes[0].value.messages[0];
      const from = messageObj.from;
      const text = messageObj.text.body;

      console.log(`📩 Mensaje de ${from}: ${text}`);

      // --- ESCENARIO 1: CLIENTE LLEGA DE LA WEB ---
      if (text.includes("REPORT_READY") || text.includes("SOLICITUD DE DEMO")) {
        await enviarRespuesta(from, "👋 ¡Hola! Soy Nexo Bot.\n\nHe recibido tu diagnóstico digital exitosamente. 📉\n\nVeo que tu negocio tiene fugas de capital importantes. Para explicarte la solución, tengo estos espacios disponibles para una Demo Técnica de 15 min:\n\n1️⃣ Mañana a las 10:00 AM\n2️⃣ Mañana a las 4:00 PM\n3️⃣ Pasado mañana a las 11:00 AM\n\n*Responde con el número de tu preferencia (1, 2 o 3).*");
      }
      
      // --- ESCENARIO 2: CLIENTE ELIGE HORARIO ---
      else if (text === "1" || text.includes("10:00")) {
        await enviarRespuesta(from, "✅ ¡Confirmado! Te he agendado para *Mañana a las 10:00 AM*.\n\nTe enviaré el enlace de Google Meet por aquí 10 minutos antes. 👨‍💻");
      }
      else if (text === "2" || text.includes("4:00")) {
        await enviarRespuesta(from, "✅ ¡Listo! Quedaste agendado para *Mañana a las 4:00 PM*.\n\nNos vemos pronto.");
      }
      else if (text === "3" || text.includes("11:00")) {
        await enviarRespuesta(from, "✅ ¡Perfecto! Agenda bloqueada para *Pasado mañana a las 11:00 AM*.");
      }
      
      // --- ESCENARIO 3: CUALQUIER OTRA COSA ---
      else {
        // Solo respondemos si no es un mensaje que el propio bot envió
        await enviarRespuesta(from, "Entendido. Si deseas agendar una cita, escribe 'Demo'.");
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

async function enviarRespuesta(paraQuien, texto) {
  try {
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v17.0/${PHONE_ID}/messages`,
      data: { messaging_product: "whatsapp", to: paraQuien, text: { body: texto } },
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

app.listen(3000, () => console.log("🤖 SOY NEXO BOT: Modo Ventas Activado"));