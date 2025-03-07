// src/utils/logger.js
import winston from 'winston';
import config from '../config.js';
import fs from 'fs';
import path from 'path';

// Garante que o diretório de logs existe
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Definição de cores para cada nível no console
const colors = {
  error: '\x1b[31m', // Vermelho
  warn: '\x1b[33m',  // Amarelo
  info: '\x1b[36m',  // Ciano
  debug: '\x1b[32m', // Verde
  trace: '\x1b[35m', // Magenta
  reset: '\x1b[0m'   // Reset
};

// Obtém o nível de log do ambiente ou usa o padrão do config
const logLevel = process.env.LOG_LEVEL || config.loggerLevel || 'info';

// Configuração do logger com Winston
const logger = winston.createLogger({
  level: logLevel,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
  },
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) => {
        const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`;
      }
    )
  ),
  transports: [
    // Logs no console com cores
    new winston.transports.Console({
      format: winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const color = colors[level] || colors.reset;
        const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${color}${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}${colors.reset}`;
      })
    }),
    // Todos os logs acima de info vão para o arquivo principal
    new winston.transports.File({ 
      filename: 'logs/application.log',
      level: 'info'
    }),
    // Arquivo específico para erros
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    // Arquivo específico para logs de depuração
    new winston.transports.File({ 
      filename: 'logs/debug.log', 
      level: 'debug' 
    }),
    // Arquivo específico para conversas
    new winston.transports.File({ 
      filename: 'logs/conversation.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(
          ({ timestamp, level, message, ...meta }) => {
            return `${timestamp}: ${message}`;
          }
        )
      )
    })
  ],
});

// Helpers específicos para mensagens de conversação
logger.userMessage = (phone, message) => {
  logger.info(`👤 ${phone} → Sofia: "${message}"`, { type: 'user_message', phone });
};

logger.iaMessage = (phone, message) => {
  logger.info(`🤖 Sofia → ${phone}: "${message}"`, { type: 'ia_message', phone });
};

// Aliases para facilitar o uso e transição dos console.log existentes
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

// Sobrescreve os métodos do console para usar o logger
console.log = (...args) => {
  logger.info(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  // Mantém o comportamento original em desenvolvimento se necessário
  if (process.env.NODE_ENV === 'development') {
    originalConsoleLog(...args);
  }
};

console.error = (...args) => {
  logger.error(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  if (process.env.NODE_ENV === 'development') {
    originalConsoleError(...args);
  }
};

console.warn = (...args) => {
  logger.warn(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  if (process.env.NODE_ENV === 'development') {
    originalConsoleWarn(...args);
  }
};

console.info = (...args) => {
  logger.info(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  if (process.env.NODE_ENV === 'development') {
    originalConsoleInfo(...args);
  }
};

console.debug = (...args) => {
  logger.debug(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  if (process.env.NODE_ENV === 'development') {
    originalConsoleDebug(...args);
  }
};

export default logger;
