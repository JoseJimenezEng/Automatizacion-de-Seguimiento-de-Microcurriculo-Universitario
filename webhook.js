// Este archivo debe ser ejecutado en un servidor Node.js para recibir webhooks
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Almacenamiento en memoria para los datos recibidos (en un entorno real, usarías una base de datos)
let webhookData = {};
// Clientes conectados para SSE
const clients = [];

// Middleware para procesar JSON y habilitar CORS
app.use(bodyParser.text({ type: '*/*' })); // Recibir como texto para procesar los delimitadores
app.use(cors());

// Endpoint para SSE (Server-Sent Events)
app.get('/events', (req, res) => {
    // Configurar cabeceras para SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    
    // Enviar un evento inicial para confirmar la conexión
    res.write('event: connected\ndata: {"status": "connected"}\n\n');
    
    // Añadir cliente a la lista
    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);
    
    // Enviar datos existentes si hay alguno
    if (Object.keys(webhookData).length > 0) {
        const dataStr = JSON.stringify(webhookData);
        res.write(`event: webhook-data\ndata: ${dataStr}\n\n`);
    }
    
    // Eliminar cliente cuando se cierre la conexión
    req.on('close', () => {
        console.log(`Cliente ${clientId} desconectado`);
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
        
        // Añadir campo "observations" a cada elemento si no existe
        for (const groupId in data) {
            data[groupId].forEach(item => {
                if (!item.hasOwnProperty('observations')) {
                    item.observations = "None";
                }
            });
        }
        
        // Guardar los datos
        webhookData = data;
        
        // Notificar a todos los clientes conectados
        sendEventToAll('webhook-data', data);
        
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
        
        // Procesar la acción (en un entorno real, esto podría actualizar una base de datos)
        console.log(`Acción recibida: ${data.color ? 'Rechazar' : 'Aprobar'} para grupo ${data.groupId}`);
        
        // Actualizar los datos en memoria
        if (webhookData[data.groupId]) {
            const index = webhookData[data.groupId].findIndex(item => 
                item.dateOfClass === data.dateOfClass && 
                item.temaDado === data.temaDado
            );
            
            if (index !== -1) {
                // Actualizar el estado según la acción
                webhookData[data.groupId][index].success = !data.color;
                // Actualizar observaciones
                webhookData[data.groupId][index].observations = 
                    data.color ? "Rechazado manualmente" : "Aprobado manualmente";
                
                // Notificar a todos los clientes conectados sobre el cambio
                sendEventToAll('webhook-data', webhookData);
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

// Función para enviar eventos a todos los clientes conectados
function sendEventToAll(eventName, data) {
    clients.forEach(client => {
        client.res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    });
}

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor webhook escuchando en el puerto ${port}`);
    console.log(`Endpoint SSE disponible en http://localhost:${port}/events`);
    console.log(`Endpoint webhook disponible en http://localhost:${port}/webhook`);
});