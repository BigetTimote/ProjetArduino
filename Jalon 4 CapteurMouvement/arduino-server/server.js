const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const express = require('express');

const app = express();
const httpPort = 3000; 
const portName = 'COM9';

let ledState = 0; 
let capteurState = 0; 


const serialPort = new SerialPort({
    path: portName,
    baudRate: 9600,
});


serialPort.on('error', (err) => {
    console.error('Erreur sur le port série :', err.message);
});


const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));


parser.on('data', (data) => {
    
    const cleanedData = data.trim(); 
    console.log(`Donnée brute reçue (nettoyée) : "${cleanedData}"`);

    if (cleanedData.startsWith('ledState=') && cleanedData.includes(',capteurState=')) {
        const parts = cleanedData.split(',');
        const ledPart = parts[0].split('=')[1]; 
        const capteurPart = parts[1].split('=')[1]; 

        ledState = parseInt(ledPart, 10);
        capteurState = parseInt(capteurPart, 10);

        console.log(`Données extraites : ledState=${ledState}, capteurState=${capteurState}`);
    } else {
        console.warn('Format de données non valide ou ligne vide reçue :', cleanedData);
    }
});



app.get('/data', (req, res) => {
    console.log('Requête reçue sur /data');
    console.log(`Données envoyées : ledState=${ledState}, capteurState=${capteurState}`);
    res.json({ ledState, capteurState });
});

app.listen(httpPort, '0.0.0.0', () => {
    console.log(`Serveur HTTP démarré sur toutes les interfaces réseau, port ${httpPort}`);
});