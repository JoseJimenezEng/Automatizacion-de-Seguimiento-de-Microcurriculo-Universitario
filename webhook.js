// webhook.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Almacenamiento en memoria para datos por sesión
const sessionData = {};

// Clientes conectados para SSE (ahora asociados a sesiones)
const clients = [];

// Middleware para procesar JSON y habilitar CORS
app.use(bodyParser.text({ type: '*/*' }));
app.use(cors());

// Endpoint para SSE (Server-Sent Events)
app.get('/events', (req, res) => {
    // Obtener el sessionId de los parámetros de consulta
    const { sessionId } = req.query;
    
    if (!sessionId) {
        res.status(400).send('Falta el sessionId');
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

    // Añadir cliente a la lista con su sessionId
    const clientId = Date.now();
    clients.push({
        id: clientId,
        res,
        sessionId
    });

    // Enviar datos existentes si hay alguno para esta sesión
    if (sessionData[sessionId]) {
        const dataStr = JSON.stringify(sessionData[sessionId]);
        res.write(`event: webhook-data\ndata: ${dataStr}\n\n`);
    }

    // Eliminar cliente cuando se cierre la conexión
    req.on('close', () => {
        const index = clients.findIndex(client => client.id === clientId);
        if (index !== -1) {
            clients.splice(index, 1);
        }
    });
});

// Endpoint para recibir el webhook
app.post('/webhook', (req, res) => {
    try {
        // Obtener el cuerpo de la solicitud como string
        let jsonString = req.body;
        
        // Eliminar los delimitadores ```json y ``` si existen
        if (jsonString.startsWith('```json')) {
            jsonString = jsonString.substring('```json'.length);
        }
        if (jsonString.endsWith('```')) {
            jsonString = jsonString.substring(0, jsonString.length - 3);
        }
        
        // Parsear el JSON
        const data = JSON.parse(jsonString);
        
        // Verificar que tengamos un sessionId
        if (!data.sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Falta el ID de sesión'
            });
        }
        
        // Añadir campo "observations" a cada elemento si no existe
        for (const groupId in data) {
            if (groupId === 'sessionId') continue; // Saltamos el sessionId
            
            data[groupId].forEach(item => {
                if (!item.hasOwnProperty('observations')) {
                    item.observations = "None";
                }
            });
        }
        
        // Guardar los datos en la sesión correspondiente
        sessionData[data.sessionId] = data;
        
        // Notificar a todos los clientes conectados para esta sesión
        sendEventToSession(data.sessionId, 'webhook-data', data);
        
        // Enviar respuesta
        res.status(200).json({
            success: true,
            message: 'Datos recibidos y procesados correctamente',
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

// Endpoint para recibir acciones (check/x)
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
        
        // Verificar que tengamos un sessionId
        if (!data.sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Falta el ID de sesión'
            });
        }
        
        // Procesar la acción (en un entorno real, esto podría actualizar una base de datos)
        console.log(`Acción recibida: ${data.color ? 'Rechazar' : 'Aprobar'} para grupo ${data.groupId}`);
        
        // Verificar que existan datos para esta sesión
        if (!sessionData[data.sessionId]) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron datos para esta sesión'
            });
        }
        
        // Obtener los datos de la sesión
        const session = sessionData[data.sessionId];
        
        // Actualizar los datos
        if (session[data.groupId]) {
            const index = session[data.groupId].findIndex(item => 
                item.dateOfClass === data.dateOfClass && 
                item.temaDado === data.temaDado
            );
            
            if (index !== -1) {
                // Actualizar el estado según la acción
                session[data.groupId][index].success = !data.color;
                
                // Actualizar observaciones
                session[data.groupId][index].observations = 
                    data.color ? "Rechazado manualmente" : "Aprobado manualmente";
                    
                // Notificar a todos los clientes conectados sobre el cambio
                sendEventToSession(data.sessionId, 'webhook-data', session);
            }
        }
        
        // Enviar respuesta
        res.status(200).json({
            success: true,
            message: `Acción ${data.color ? 'rechazar' : 'aprobar'} procesada correctamente`
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

// Función para enviar eventos a clientes de una sesión específica
function sendEventToSession(sessionId, eventName, data) {
    clients
        .filter(client => client.sessionId === sessionId)
        .forEach(client => {
            client.res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
        });
}

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor webhook escuchando en el puerto ${port}`);
    console.log(`Endpoint SSE disponible en http://localhost:${port}/events`);
    console.log(`Endpoint webhook disponible en http://localhost:${port}/webhook`);
    console.log(`Endpoint de acciones disponible en http://localhost:${port}/action`);
});