const config = require('../config');
const { handleCommand } = require('./commandHandler');
const User = require('../models/user');
const logger = require('../utils/logger');

async function messageHandler(sock, msg) {
    try {
        if (!msg.message || msg.key.fromMe) return;
        
        const messageType = Object.keys(msg.message)[0];
        if (messageType === 'protocolMessage' || messageType === 'senderKeyDistributionMessage') return;

        const content = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text || 
                       msg.message?.imageMessage?.caption ||
                       msg.message?.videoMessage?.caption;
                       
        if (!content) return;

        if (config.autoRead) {
            await sock.readMessages([msg.key]);
        }

        if (!content.startsWith(config.prefix)) return;

        const [cmd, ...args] = content.slice(config.prefix.length).trim().split(/\s+/);
        if (!cmd) return;

        await handleCommand(sock, msg, args, cmd.toLowerCase());
    } catch (error) {
        logger.error('Error in message handler:', error);
    }
}

module.exports = messageHandler;
