// REEMPLAZAR TODO EL ARCHIVO WEBHOOK EXISTENTE CON ESTE CÓDIGO

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Almacenamiento en memoria para los datos por sesión
const sessionData = new Map();
// Clientes conectados por sesión
const sessionClients = new Map();

// Middleware para procesar JSON y habilitar CORS
app.use(bodyParser.text({ type: '*/*' }));
app.use(cors());

// Endpoint para SSE (Server-Sent Events) con soporte de sesiones
app.get('/events', (req, res) => {
    const sessionToken = req.query.token;
    
    if (!sessionToken) {
        res.status(400).json({ error: 'Token de sesión requerido' });
        return;
    }

    // Configurar cabeceras para SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    
    // Enviar un evento inicial para confirmar la conexión
    res.write('event: connected\ndata: {"status": "connected"}\n\n');
    
    // Crear cliente
    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res,
        sessionToken
    };
    
    // Añadir cliente a la sesión correspondiente
    if (!sessionClients.has(sessionToken)) {
        sessionClients.set(sessionToken, []);
    }
    sessionClients.get(sessionToken).push(newClient);
    
    console.log(`Cliente ${clientId} conectado a sesión ${sessionToken}`);
    
    // Enviar datos existentes de la sesión si hay alguno
    const existingData = sessionData.get(sessionToken);
    if (existingData && Object.keys(existingData).length > 0) {
        const dataStr = JSON.stringify(existingData);
        res.write(`event: webhook-data\ndata: ${dataStr}\n\n`);
    }
    
    // Eliminar cliente cuando se cierre la conexión
    req.on('close', () => {
        console.log(`Cliente ${clientId} desconectado de sesión ${sessionToken}`);
        const sessionClientList = sessionClients.get(sessionToken);
        if (sessionClientList) {
            const index = sessionClientList.findIndex(client => client.id === clientId);
            if (index !== -1) {
                sessionClientList.splice(index, 1);
                // Si no quedan clientes en la sesión, eliminar la sesión
                if (sessionClientList.length === 0) {
                    sessionClients.delete(sessionToken);
                    sessionData.delete(sessionToken);
                    console.log(`Sesión ${sessionToken} eliminada`);
                }
            }
        }
    });
});

// Endpoint para recibir el webhook
app.post('/webhook', (req, res) => {
    try {
        // Obtener el cuerpo de la solicitud como string
        let jsonString = req.body;
        console.log('Datos recibidos en el webhook:', jsonString);
        
        // Eliminar los delimitadores ```json y ``` si existen
        if (jsonString.startsWith('```json')) {
            jsonString = jsonString.substring('```json'.length);
        }
        if (jsonString.endsWith('```')) {
            jsonString = jsonString.substring(0, jsonString.length - 3);
        }
        
        // Parsear el JSON
        const data = JSON.parse(jsonString);
        
        // Añadir campo "observations" a cada elemento si no existe
        for (const groupId in data) {
            data[groupId].forEach(item => {
                if (!item.hasOwnProperty('observations')) {
                    item.observations = "None";
                }
            });
        }
        
        // Determinar a qué sesión enviar los datos
        // Por simplicidad, si no se especifica sesión, crear una nueva o usar la primera activa
        let targetSessionToken = data.sessionToken;
        
        // // Buscar la primera sesión activa (en un escenario real, esto se haría de manera más específica)
        // for (const [sessionToken, clients] of sessionClients.entries()) {
        //     if (clients.length > 0) {
        //         targetSessionToken = sessionToken;
        //         break;
        //     }
        // }
        
        if (targetSessionToken) {
            // Guardar los datos para la sesión específica
            sessionData.set(targetSessionToken, data);
            
            // Notificar solo a los clientes de esta sesión
            sendEventToSession(targetSessionToken, 'webhook-data', data);
            
            console.log(`Datos enviados a sesión ${targetSessionToken}`);
        }
        
        // Enviar respuesta
        res.status(200).json({
            success: true,
            message: 'Datos recibidos y procesados correctamente',
            sessionToken: targetSessionToken,
            data: data
        });
        
    } catch (error) {
        console.error('Error al procesar el webhook:', error);
        res.status(400).json({
            success: false,
            message: 'Error al procesar los datos',
            error: error.message
        });
    }
});

// Endpoint para recibir acciones (coherente/incoherente) con soporte de sesiones
app.post('/action', (req, res) => {
    try {
        // Obtener el cuerpo de la solicitud
        let jsonString = req.body;
        
        // Si es un string, parsearlo
        let data;
        if (typeof jsonString === 'string') {
            data = JSON.parse(jsonString);
        } else {
            data = jsonString;
        }
        
        const sessionToken = data.sessionToken;
        
        if (!sessionToken) {
            return res.status(400).json({
                success: false,
                message: 'Token de sesión requerido'
            });
        }
        
        // Procesar la acción para la sesión específica
        console.log(`Acción recibida para sesión ${sessionToken}: ${data.color ? 'Incoherente' : 'Coherente'} para grupo ${data.groupId}`);
        
        // Actualizar los datos en memoria para la sesión específica
        const sessionWebhookData = sessionData.get(sessionToken);
        if (sessionWebhookData && sessionWebhookData[data.groupId]) {
            const index = sessionWebhookData[data.groupId].findIndex(item => 
                item.dateOfClass === data.dateOfClass && 
                item.temaDado === data.temaDado
            );
            
            if (index !== -1) {
                // Actualizar el estado según la acción
                sessionWebhookData[data.groupId][index].success = !data.color;
                // Actualizar observaciones
                sessionWebhookData[data.groupId][index].observations = 
                    data.color ? "Marcado como incoherente" : "Marcado como coherente";
                
                // Actualizar los datos de la sesión
                sessionData.set(sessionToken, sessionWebhookData);
                
                // Notificar solo a los clientes de esta sesión sobre el cambio
                sendEventToSession(sessionToken, 'webhook-data', sessionWebhookData);
            }
        }
        
        // Enviar respuesta
        res.status(200).json({
            success: true,
            message: `Acción ${data.color ? 'incoherente' : 'coherente'} procesada correctamente para sesión ${sessionToken}`
        });
        
    } catch (error) {
        console.error('Error al procesar la acción:', error);
        res.status(400).json({
            success: false,
            message: 'Error al procesar la acción',
            error: error.message
        });
    }
});

// Función para enviar eventos a todos los clientes de una sesión específica
function sendEventToSession(sessionToken, eventName, data) {
    const clients = sessionClients.get(sessionToken);
    if (clients) {
        clients.forEach(client => {
            try {
                client.res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (error) {
                console.error(`Error al enviar evento a cliente ${client.id}:`, error);
            }
        });
    }
}

// Endpoint para obtener estadísticas de sesiones (opcional, para debugging)
app.get('/sessions', (req, res) => {
    const sessions = [];
    for (const [sessionToken, clients] of sessionClients.entries()) {
        sessions.push({
            sessionToken,
            clientCount: clients.length,
            hasData: sessionData.has(sessionToken)
        });
    }
    
    res.json({
        totalSessions: sessions.length,
        sessions: sessions
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor webhook con sesiones escuchando en el puerto ${port}`);
    console.log(`Endpoint SSE disponible en http://localhost:${port}/events?token=SESSION_TOKEN`);
    console.log(`Endpoint webhook disponible en http://localhost:${port}/webhook`);
    console.log(`Endpoint de estadísticas disponible en http://localhost:${port}/sessions`);
});