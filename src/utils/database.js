const mongoose = require('mongoose');
const config = require('../config');
const logger = require('./logger');

async function connectToDatabase() {
    try {
        await mongoose.connect(config.mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        logger.info('Connected to MongoDB');
    } catch (error) {
        logger.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

mongoose.connection.on('disconnected', () => {
    setTimeout(connectToDatabase, 5000);
});

mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error:', err);
});

module.exports = {
    connectToDatabase,
    mongoose
};
