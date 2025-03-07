// src/utils/logger.js
import winston from 'winston';
import config from '../config.js';
import fs from 'fs';

// Garante que o diretório de logs existe
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Configuração do logger com Winston - versão super simples
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    // Console
    new winston.transports.Console(),
    // Arquivo para todos os logs
    new winston.transports.File({ 
      filename: 'logs/application.log' 
    }),
    // Arquivo apenas para erros
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    })
  ],
});

// Override dos console.* para usar o logger
console.log = (message) => logger.info(message);
console.error = (message) => logger.error(message);
console.warn = (message) => logger.warn(message);
console.info = (message) => logger.info(message);
console.debug = (message) => logger.debug(message);

export default logger;
