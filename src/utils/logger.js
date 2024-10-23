const fs = require('fs-extra');
const path = require('path');
const util = require('util');

class Logger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
        fs.ensureDirSync(this.logDir);
    }

    write(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedMessage = args.length ? util.format(message, ...args) : message;
        const logEntry = `[${timestamp}] [${level}] ${formattedMessage}\n`;
        console.log(`[${level}] ${formattedMessage}`);
        fs.appendFileSync(this.logFile, logEntry);
    }

    info(message, ...args) { this.write('INFO', message, ...args); }
    warn(message, ...args) { this.write('WARN', message, ...args); }
    error(message, ...args) { this.write('ERROR', message, ...args); }
    debug(message, ...args) {
        if (process.env.DEBUG) {
            this.write('DEBUG', message, ...args);
        }
    }
}

module.exports = new Logger();
