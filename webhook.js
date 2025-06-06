const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Almacenamiento en memoria para SSE (opcional)
const sessionData = new Map();
const sessionClients = new Map();

// Middleware global: habilitar CORS
app.use(cors());

/**
 * Convierte "M/D/YYYY" o "MM/DD/YYYY" en Date.
 */
function parseDateMDY(str) {
  const parts = str.split('/');
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

/**
 * Convierte "DD/MM/YYYY" en Date.
 */
function parseDateDMY(str) {
  const parts = str.split('/');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

// SSE: conectar clientes que escuchen cambios en cierta sesión
app.get('/events', (req, res) => {
  const sessionToken = req.query.token;
  if (!sessionToken) {
    res.status(400).json({ error: 'Token de sesión requerido' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Enviar evento inicial de confirmación
  res.write('event: connected\ndata: {"status":"connected"}\n\n');

  const clientId = Date.now();
  const newClient = { id: clientId, res, sessionToken };
  if (!sessionClients.has(sessionToken)) {
    sessionClients.set(sessionToken, []);
  }
  sessionClients.get(sessionToken).push(newClient);

  console.log(`Cliente ${clientId} conectado a sesión ${sessionToken}`);

  // Si ya hay datos previos en esta sesión, enviarlos de inmediato
  const existing = sessionData.get(sessionToken);
  if (existing) {
    res.write(`event: webhook-data\ndata: ${JSON.stringify(existing)}\n\n`);
  }

  req.on('close', () => {
    console.log(`Cliente ${clientId} desconectado de sesión ${sessionToken}`);
    const lista = sessionClients.get(sessionToken) || [];
    const idx = lista.findIndex((c) => c.id === clientId);
    if (idx !== -1) {
      lista.splice(idx, 1);
      if (lista.length === 0) {
        sessionClients.delete(sessionToken);
        sessionData.delete(sessionToken);
        console.log(`Sesión ${sessionToken} eliminada`);
      }
    }
  });
});

/**
 * Middleware específico para /webhook que recibe texto crudo,
 * elimina posibles backticks (“```”) al principio y al final,
 * y luego convierte a JSON.
 */
app.post(
  '/webhook',
  bodyParser.text({ type: '*/*' }),
  (req, res) => {
    try {
      // 1) Tomamos el cuerpo crudo (string)
      let rawText = req.body;

      // 2) Si el texto va envuelto en ```json ... ```, lo limpiamos:
      //    - Eliminamos ```json al inicio
      //    - Eliminamos ``` al final (con o sin “json”)
      rawText = rawText.trim();
      if (rawText.startsWith('```')) {
        // Posible formato: ```json\n{ ... }\n```
        // o bien ```\n{ ... }\n```
        // Eliminamos las tres backticks iniciales y finales
        // Buscamos el índice donde termine la primera línea de backticks
        const firstLineEnd = rawText.indexOf('\n');
        if (firstLineEnd !== -1) {
          // quitamos la primera línea que contiene ``` o ```json
          rawText = rawText.slice(firstLineEnd + 1).trim();
          // Luego quitamos los últimos ``` (pueden ir en su propia línea)
          if (rawText.endsWith('```')) {
            rawText = rawText.slice(0, -3).trim();
          }
        }
      }

      // 3) Parsear JSON “limpio”
      const payload = JSON.parse(rawText);

      // Estructura esperada en el payload:
      // {
      //   "JSON1": [ { "1": "DERE5170-S01", "3": "2/3/2025", "4": "Tema dado..." }, ... ],
      //   "JSON2": { "Semana1": [ "Temas esperados de la Semana1", "08/02/2025" ], ... }
      // }

      const rawJSON1 = Array.isArray(payload.JSON1) ? payload.JSON1 : [];
      let rawJSON2 =
        typeof payload.JSON2 === 'object' && payload.JSON2 !== null
          ? payload.JSON2
          : {};

      // 4) Procesar JSON2: tomar rawJSON2[0] (según tu formato original)
      const semanas = [];
      rawJSON2 = rawJSON2[0] || {};
      for (const semanaKey in rawJSON2) {
        if (!rawJSON2.hasOwnProperty(semanaKey)) continue;
        const arr = rawJSON2[semanaKey];
        if (!Array.isArray(arr) || arr.length < 2) continue;

        const temasEsperados = String(arr[0]).trim();
        const fechaFinStr = String(arr[1]).trim(); // “DD/MM/YYYY”
        const fechaFinDate = parseDateDMY(fechaFinStr);

        semanas.push({
          temasEsperados,
          fechaFinDate,
          fechaFinStr,
        });
      }

      // Ordenar por fecha ascendente
      semanas.sort((a, b) => a.fechaFinDate - b.fechaFinDate);

      // 5) Agrupar rawJSON1 por grupo ("1")
      const agrupado = {};
      rawJSON1.forEach((item) => {
        const grupo = item['1'] || null;
        const dateStrRaw = item['3'] || '';
        const temaDadoRaw = item['4'] || '';

        const fechaClaseStr = dateStrRaw.trim(); // “M/D/YYYY” o “MM/DD/YYYY”
        const temaDado = temaDadoRaw.trim() === '' ? null : temaDadoRaw.trim();

        let matchedTemaEsperado = null;
        let matchedWeekStr = null;

        if (fechaClaseStr !== '') {
          const fechaClaseDate = parseDateMDY(fechaClaseStr);
          for (const sem of semanas) {
            if (fechaClaseDate.getTime() <= sem.fechaFinDate.getTime()) {
              matchedTemaEsperado = sem.temasEsperados;
              matchedWeekStr = sem.fechaFinStr;
              break;
            }
          }
        }

        if (!matchedTemaEsperado) matchedTemaEsperado = null;
        if (!matchedWeekStr) matchedWeekStr = null;

        const claseObj = {
          temaDado,
          temaEsperado: matchedTemaEsperado,
          dateOfClass: fechaClaseStr,
          week: matchedWeekStr,
        };

        if (!agrupado[grupo]) {
          agrupado[grupo] = [];
        }
        agrupado[grupo].push(claseObj);
      });

      // 6) Si viene token por query, guardar en memoria y notificar SSE
      const sessionToken = req.query.token;
      if (sessionToken) {
        sessionData.set(sessionToken, agrupado);
        sendEventToSession(sessionToken, 'webhook-data', agrupado);
        console.log('DATA \n', agrupado);
      }

      // 7) Responder con JSON organizado
      res.status(200).json({
        success: true,
        message: 'Datos recibidos y transformados correctamente',
        newData: agrupado,
      });
    } catch (error) {
      console.error('Error al procesar el webhook:', error);
      res.status(400).json({
        success: false,
        message: 'Error al procesar los datos',
        error: error.message,
      });
    }
  }
);

// Endpoint para recibir acciones (coherente/incoherente) con soporte de sesiones
app.post('/action', bodyParser.json(), (req, res) => {
  try {
    const data = req.body;
    const sessionToken = data.sessionToken;
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        message: 'Token de sesión requerido',
      });
    }

    console.log(
      `Acción recibida para sesión ${sessionToken}: ${
        data.color ? 'Incoherente' : 'Coherente'
      } para grupo ${data.groupId}`
    );

    const sessionWebhookData = sessionData.get(sessionToken);
    if (sessionWebhookData && sessionWebhookData[data.groupId]) {
      const arrGrupo = sessionWebhookData[data.groupId];
      const idx = arrGrupo.findIndex(
        (item) =>
          item.dateOfClass === data.dateOfClass && item.temaDado === data.temaDado
      );
      if (idx !== -1) {
        arrGrupo[idx].success = !data.color;
        arrGrupo[idx].observations = data.color
          ? 'Marcado como incoherente'
          : 'Marcado como coherente';

        sessionData.set(sessionToken, sessionWebhookData);
        sendEventToSession(sessionToken, 'webhook-data', sessionWebhookData);
      }
    }

    res.status(200).json({
      success: true,
      message: `Acción ${data.color ? 'incoherente' : 'coherente'} procesada correctamente para sesión ${sessionToken}`,
    });
  } catch (error) {
    console.error('Error al procesar la acción:', error);
    res.status(400).json({
      success: false,
      message: 'Error al procesar la acción',
      error: error.message,
    });
  }
});

// Función auxiliar para emitir SSE a todos los clientes suscritos a una sesión
function sendEventToSession(sessionToken, eventName, data) {
  const clients = sessionClients.get(sessionToken);
  if (clients) {
    clients.forEach((client) => {
      try {
        client.res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        console.error(`Error al enviar evento a cliente ${client.id}:`, err);
      }
    });
  }
}

// Endpoint para ver estadísticas de sesiones (opcional)
app.get('/sessions', (req, res) => {
  const sessions = [];
  for (const [token, clients] of sessionClients.entries()) {
    sessions.push({
      sessionToken: token,
      clientCount: clients.length,
      hasData: sessionData.has(token),
    });
  }
  res.json({
    totalSessions: sessions.length,
    sessions: sessions,
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor webhook escuchando en el puerto ${port}`);
  console.log(`SSE disponible en http://localhost:${port}/events?token=TU_TOKEN`);
  console.log(`Webhook disponible en http://localhost:${port}/webhook`);
  console.log(`Sessions (estadísticas) en http://localhost:${port}/sessions`);
});
