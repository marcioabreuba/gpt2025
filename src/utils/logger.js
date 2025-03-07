// src/utils/logger.js
import fs from 'fs';
import path from 'path';
import { format } from 'util';

// Níveis de log disponíveis
const LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Cores para os diferentes níveis (quando exibidos no console)
const COLORS = {
  ERROR: '\x1b[31m', // Vermelho
  WARN: '\x1b[33m',  // Amarelo
  INFO: '\x1b[36m',  // Ciano
  DEBUG: '\x1b[32m', // Verde
  TRACE: '\x1b[35m', // Magenta
  RESET: '\x1b[0m'   // Reset
};

// Cria o diretório de logs se não existir
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

// Arquivos de log
const LOG_FILES = {
  APP: path.join(LOG_DIR, 'app.log'),
  ERROR: path.join(LOG_DIR, 'error.log'),
  CHAT: path.join(LOG_DIR, 'chat.log')
};

// Configuração do nível de log
const getLogLevel = () => {
  const level = (process.env.LOG_LEVEL || 'info').toUpperCase();
  return LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.INFO;
};

// Obtém o timestamp atual formatado
const timestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
};

// Escreve uma mensagem no arquivo de log e no console
const writeLog = (level, message, meta = {}) => {
  // Verifica se o nível de log está habilitado
  if (LEVELS[level] > getLogLevel()) {
    return;
  }

  // Formata a mensagem
  let logMessage = `${timestamp()} [${level}] ${message}`;
  
  // Adiciona metadados se existirem
  if (Object.keys(meta).length > 0) {
    const metaStr = JSON.stringify(meta, null, 2);
    logMessage += `\n${metaStr}`;
  }
  
  // Adiciona quebra de linha
  logMessage += '\n';
  
  // Escreve no console com cores
  const color = COLORS[level] || '';
  process.stdout.write(`${color}${logMessage}${COLORS.RESET}`);
  
  try {
    // Escreve no arquivo de log principal
    fs.appendFileSync(LOG_FILES.APP, logMessage);
    
    // Escreve no arquivo de erros se for um erro
    if (level === 'ERROR') {
      fs.appendFileSync(LOG_FILES.ERROR, logMessage);
    }
  } catch (error) {
    console.error(`Erro ao escrever no log: ${error.message}`);
  }
};

// API do logger
const logger = {
  error: (message, meta) => writeLog('ERROR', message, meta),
  warn: (message, meta) => writeLog('WARN', message, meta),
  info: (message, meta) => writeLog('INFO', message, meta),
  debug: (message, meta) => writeLog('DEBUG', message, meta),
  trace: (message, meta) => writeLog('TRACE', message, meta),
  
  // Formata argumentos múltiplos como o console.log
  log: (level, ...args) => {
    const message = format(...args);
    writeLog(level.toUpperCase(), message);
  },
  
  // Logs de chat
  userMessage: (phone, message) => {
    const chatMessage = `${timestamp()} 👤 ${phone} → Sofia: "${message}"\n`;
    fs.appendFileSync(LOG_FILES.CHAT, chatMessage);
    logger.info(`Usuário ${phone}: "${message}"`);
  },
  
  iaMessage: (phone, message) => {
    const chatMessage = `${timestamp()} 🤖 Sofia → ${phone}: "${message}"\n`;
    fs.appendFileSync(LOG_FILES.CHAT, chatMessage);
    logger.info(`Resposta para ${phone}`);
  }
};

// Sobrescreve os métodos do console
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

// Substitui os métodos do console
console.log = (...args) => logger.info(format(...args));
console.error = (...args) => logger.error(format(...args));
console.warn = (...args) => logger.warn(format(...args));
console.info = (...args) => logger.info(format(...args));
console.debug = (...args) => logger.debug(format(...args));

export default logger;
