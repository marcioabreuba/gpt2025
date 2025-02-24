// src/utils/logger.js
import winston from 'winston';
import config from '../config.js';

// Configuração do logger com Winston, incluindo timestamp e stack trace
const logger = winston.createLogger({
  level: config.loggerLevel || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) => {
        const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`;
      }
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/conversation.log',
      level: 'info'
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    })
  ],
});

// Helpers específicos para mensagens de conversação
logger.userMessage = (phone, message) => {
  logger.info(`👤 ${phone} → Sofia: "${message}"`);
};

logger.iaMessage = (phone, message) => {
  logger.info(`🤖 Sofia → ${phone}: "${message}"`);
};

export default logger;
