require('dotenv').config();
const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const P = require('pino');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const NodeCache = require('node-cache');
const gradient = require('gradient-string');
const figlet = require('figlet');
const { connectToDatabase } = require('./src/utils/database.js');
const logger = require('./src/utils/logger.js');
const messageHandler = require('./src/handlers/messageHandler.js');
const config = require('./src/config.js');
const { initializeCommands } = require('./src/handlers/commandHandler.js');

const msgRetryCounterCache = new NodeCache({
    stdTTL: 3600,
    checkperiod: 600,
    maxKeys: 500
});

const store = makeInMemoryStore({
    logger: P({ level: 'silent' })
});

store.readFromFile('./baileys_store.json');
setInterval(() => {
    store.writeToFile('./baileys_store.json');
}, 10_000);

const app = express();
let sock = null;
let initialConnection = true;
let reconnectAttempts = 0;
let isConnected = false;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 3000;
const sessionDir = path.join(process.cwd(), 'session');

async function displayBanner() {
    return new Promise((resolve) => {
        figlet(config.botName, (err, data) => {
            if (!err) console.log(gradient.rainbow(data));
            resolve();
        });
    });
}

async function ensureDirectories() {
    const dirs = [sessionDir, 'temp', 'assets', 'logs', 'downloads'];
    await Promise.all(dirs.map(dir => fs.ensureDir(dir)));
}

async function cleanTempFiles() {
    try {
        await fs.emptyDir('temp');
        await fs.emptyDir('downloads');
        logger.info('Temporary files cleaned');
    } catch (error) {
        logger.error('Error cleaning temp files:', error);
    }
}

async function loadSessionData() {
    if (!process.env.SESSION_DATA) {
        logger.error('SESSION_DATA environment variable is required');
        return false;
    }

    try {
        const sessionData = Buffer.from(process.env.SESSION_DATA, 'base64').toString();
        const parsedData = JSON.parse(sessionData);
        await fs.writeJson(path.join(sessionDir, 'creds.json'), parsedData);
        return true;
    } catch (error) {
        logger.error('Session data error:', error);
        return false;
    }
}

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const socketConfig = {
            version,
            auth: state,
            printQRInTerminal: false,
            logger: P({ level: 'silent' }),
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 120000,
            connectTimeoutMs: 120000,
            browser: ['Chrome (Linux)', '', ''],
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true
        };

        sock = makeWASocket(socketConfig);
        store.bind(sock.ev);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                isConnected = false;

                if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    setTimeout(connectToWhatsApp, RECONNECT_INTERVAL * reconnectAttempts);
                } else {
                    process.exit(1);
                }
            } else if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0;
                
                if (initialConnection) {
                    await sock.sendMessage(sock.user.id, { 
                        text: '🤖 Bot Successfully Connected\n\n' +
                              '📱 Device: Chrome Linux\n' +
                              '⚡ Status: Online\n' +
                              '🕒 Time: ' + new Date().toLocaleString()
                    });
                    initialConnection = false;
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    await messageHandler(sock, msg);
                }
            }
        });

        return sock;
    } catch (error) {
        logger.error('Connection error:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            setTimeout(connectToWhatsApp, RECONNECT_INTERVAL);
        }
        return null;
    }
}

async function startServer() {
    const port = process.env.PORT || 3000;
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    app.get('/', (_, res) => res.send(`${config.botName} is running!`));
    app.get('/status', (_, res) => {
        res.json({
            status: isConnected ? 'connected' : 'disconnected',
            reconnectAttempts,
            timestamp: new Date().toISOString()
        });
    });

    app.listen(port, '0.0.0.0', () => {
        logger.info(`Server running on port ${port}`);
    });
}

async function initialize() {
    try {
        await displayBanner();
        await ensureDirectories();
        await cleanTempFiles();
        const hasSession = await loadSessionData();
        if (!hasSession) {
            process.exit(1);
        }
        await connectToDatabase();
        await initializeCommands();
        await connectToWhatsApp();
        await startServer();

        process.on('unhandledRejection', logger.error);
        process.on('uncaughtException', logger.error);
    } catch (error) {
        logger.error('Initialization failed:', error);
        process.exit(1);
    }
}

initialize();
