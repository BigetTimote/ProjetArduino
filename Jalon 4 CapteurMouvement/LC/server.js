const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const wsPort = 8080;
const httpPort = 3000;

const windowsServerUrl = 'http://192.168.64.95:3000/data';

let ledState = 0;
let capteurState = 0;
let previousCapteurState = 0;

const detectionLogsPath = path.resolve(__dirname, 'detectionLogs.json');

app.use(express.static(path.join(__dirname, 'public')));

const wss = new WebSocket.Server({ port: wsPort });

wss.on('connection', (ws) => {
    console.log('Client WebSocket connecté.');

    const sendData = () => {
        let detectionLogs = [];
        if (fs.existsSync(detectionLogsPath)) {
            try {
                const fileData = fs.readFileSync(detectionLogsPath, 'utf8');
                detectionLogs = JSON.parse(fileData);
            } catch (err) {
                console.error('Erreur de lecture du fichier JSON:', err.message);
            }
        }

        const data = {
            ledState: !!ledState,
            capteurState,
            detectionLogs: detectionLogs.slice(-100).reverse() 
        };
        ws.send(JSON.stringify(data));
    };

    sendData();
    const interval = setInterval(sendData, 1000);

    ws.on('close', () => {
        console.log('Client WebSocket déconnecté.');
        clearInterval(interval);
    });
});

const fetchWindowsData = () => {
    http.get(windowsServerUrl, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const parsedData = JSON.parse(data);
                ledState = parsedData.ledState || 0;

                if (previousCapteurState === 0 && parsedData.capteurState === 1) {
                    const detectionTime = new Date().toISOString();
                    const logEntry = {
                        detectionTime,
                        message: 'Détection !'
                    };

                    let detectionLogs = [];
                    if (fs.existsSync(detectionLogsPath)) {
                        try {
                            const fileData = fs.readFileSync(detectionLogsPath, 'utf8');
                            detectionLogs = JSON.parse(fileData);
                        } catch (err) {
                            console.error('Erreur de lecture du fichier JSON. Réinitialisation des logs :', err.message);
                        }
                    }

                    detectionLogs.unshift(logEntry); // Ajouter en premier les nouvelles détections
                    detectionLogs = detectionLogs.slice(0, 100); // Garde seulement les 100 dernières entrées

                    try {
                        fs.writeFileSync(detectionLogsPath, JSON.stringify(detectionLogs, null, 2), 'utf8');
                    } catch (err) {
                        console.error('Erreur lors de l\'écriture dans le fichier JSON :', err.message);
                    }
                }

                previousCapteurState = capteurState;
                capteurState = parsedData.capteurState || 0;
            } catch (err) {
                console.error('Erreur lors du traitement des données reçues :', err.message);
            }
        });
    }).on('error', (err) => {
        console.error(`Erreur lors de la récupération des données du serveur Windows : ${err.message}`);
    });
};

setInterval(fetchWindowsData, 1000);

app.use(express.json());
app.post('/update', (req, res) => {
    if (req.body.ledState !== undefined) {
        ledState = req.body.ledState;
    }
    if (req.body.capteurState !== undefined) {
        capteurState = req.body.capteurState;
    }
    res.sendStatus(200);
});

app.get('/detectionLogs.json', (req, res) => {
    fs.readFile(detectionLogsPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur de lecture du fichier JSON' });
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(JSON.parse(data).reverse())); 
    });
});

app.listen(httpPort, () => {
    console.log(`Serveur HTTP Linux démarré sur http://localhost:${httpPort}`);
});

console.log(`Serveur WebSocket Linux démarré sur ws://localhost:${wsPort}`);
