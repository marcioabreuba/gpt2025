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
  CHAT: path.join(LOG_DIR, 'chat.log'),
  DEBUG: path.join(LOG_DIR, 'debug.log'),   // Novo arquivo só para logs de debug
  FULL: path.join(LOG_DIR, 'full.log')      // Novo arquivo que captura TUDO
};

// Configuração do nível de log
const getLogLevel = () => {
  // Forçamos TRACE para garantir que TUDO seja registrado no arquivo full.log
  // Mas respeitamos a configuração do usuário para console e outros arquivos
  const level = (process.env.LOG_LEVEL || 'info').toUpperCase();
  return LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.INFO;
};

// Obtém o timestamp atual formatado
const timestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
};

// Escreve uma mensagem no arquivo de log e no console
const writeLog = (level, message, meta = {}) => {
  // Formata a mensagem
  let logMessage = `${timestamp()} [${level}] ${message}`;
  
  // Adiciona metadados se existirem
  if (Object.keys(meta).length > 0) {
    const metaStr = JSON.stringify(meta, null, 2);
    logMessage += `\n${metaStr}`;
  }
  
  // Adiciona quebra de linha
  logMessage += '\n';
  
  try {
    // SEMPRE escreve no arquivo full.log, independente do nível
    fs.appendFileSync(LOG_FILES.FULL, logMessage);
    
    // Para os outros arquivos, respeita o nível configurado
    if (LEVELS[level] <= getLogLevel()) {
      // Escreve no console com cores
      const color = COLORS[level] || '';
      process.stdout.write(`${color}${logMessage}${COLORS.RESET}`);
      
      // Escreve no arquivo de log principal
      fs.appendFileSync(LOG_FILES.APP, logMessage);
      
      // Escreve no arquivo de erros se for um erro
      if (level === 'ERROR') {
        fs.appendFileSync(LOG_FILES.ERROR, logMessage);
      }
      
      // Escreve no arquivo de debug se for debug ou trace
      if (level === 'DEBUG' || level === 'TRACE') {
        fs.appendFileSync(LOG_FILES.DEBUG, logMessage);
      }
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
    fs.appendFileSync(LOG_FILES.FULL, chatMessage);
    logger.info(`Usuário ${phone}: "${message}"`);
  },
  
  iaMessage: (phone, message) => {
    const chatMessage = `${timestamp()} 🤖 Sofia → ${phone}: "${message}"\n`;
    fs.appendFileSync(LOG_FILES.CHAT, chatMessage);
    fs.appendFileSync(LOG_FILES.FULL, chatMessage);
    logger.info(`Resposta para ${phone}`);
  },
  
  // Função especial para registrar TUDO (não filtra pelo nível)
  system: (message, data = {}) => {
    const fullMessage = `${timestamp()} [SYSTEM] ${message}\n`;
    fs.appendFileSync(LOG_FILES.FULL, fullMessage);
    
    // Se tiver dados, registra eles também
    if (Object.keys(data).length > 0) {
      const dataStr = JSON.stringify(data, null, 2);
      fs.appendFileSync(LOG_FILES.FULL, `${dataStr}\n`);
    }
    
    // Se o nível de log for DEBUG ou TRACE, mostra no console também
    if (getLogLevel() >= LEVELS.DEBUG) {
      console.log(`[SYSTEM] ${message}`, data);
    }
  }
};

// Cria uma função para interceptar e registrar TODAS as chamadas de função
const registerFunctionCall = (original, name) => {
  return function(...args) {
    // Registra no log FULL
    const argsString = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(', ');
    
    const fullMessage = `${timestamp()} [CALL] ${name}(${argsString})\n`;
    try {
      fs.appendFileSync(LOG_FILES.FULL, fullMessage);
    } catch (error) {
      // Não faz nada se falhar
    }
    
    // Chama a função original
    return original.apply(this, args);
  };
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

// Cria uma versão melhorada do logger para depuração
console.system = (message, data = {}) => logger.system(message, data);

export default logger;
