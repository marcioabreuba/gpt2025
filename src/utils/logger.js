// src/utils/logger.js
import fs from 'fs';
import path from 'path';
import { format } from 'util';

// Garante que o diretório de logs existe
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Streams de arquivos para logs
const appLogStream = fs.createWriteStream(path.join(logDir, 'application.log'), { flags: 'a' });
const errorLogStream = fs.createWriteStream(path.join(logDir, 'error.log'), { flags: 'a' });
const convoLogStream = fs.createWriteStream(path.join(logDir, 'conversation.log'), { flags: 'a' });

// Função auxiliar para formatar a data/hora atual
function timestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substr(0, 19);
}

// Lista de avisos a serem ignorados
const ignoredWarnings = [
  '[DEP0040] DeprecationWarning: The `punycode` module is deprecated',
  'DeprecationWarning:',
  '[DEP'
];

// Função para verificar se uma mensagem deve ser ignorada
function shouldIgnoreMessage(message) {
  return ignoredWarnings.some(warning => message.includes(warning));
}

// Função auxiliar para escrever logs
function writeLog(stream, level, message) {
  // Ignora avisos de depreciação e outros avisos internos do Node
  if (shouldIgnoreMessage(message)) {
    return;
  }

  const time = timestamp();
  const formattedMessage = `${time} [${level.toUpperCase()}] ${message}\n`;
  
  // Escreve no console
  process.stdout.write(formattedMessage);
  
  // Escreve no arquivo
  stream.write(formattedMessage);
}

// Logger simples
const logger = {
  error: (...args) => {
    const message = format(...args);
    // Não registra avisos de depreciação como erros
    if (shouldIgnoreMessage(message)) {
      return;
    }
    writeLog(appLogStream, 'ERROR', message);
    writeLog(errorLogStream, 'ERROR', message);
  },
  
  warn: (...args) => {
    const message = format(...args);
    writeLog(appLogStream, 'WARN', message);
  },
  
  info: (...args) => {
    const message = format(...args);
    writeLog(appLogStream, 'INFO', message);
  },
  
  debug: (...args) => {
    if (process.env.LOG_LEVEL === 'debug') {
      const message = format(...args);
      writeLog(appLogStream, 'DEBUG', message);
    }
  },
  
  // Funções para mensagens de conversação
  userMessage: (phone, message) => {
    const formattedMessage = `👤 ${phone} → Sofia: "${message}"`;
    writeLog(appLogStream, 'INFO', formattedMessage);
    convoLogStream.write(`${timestamp()} ${formattedMessage}\n`);
  },
  
  iaMessage: (phone, message) => {
    const formattedMessage = `🤖 Sofia → ${phone}: "${message}"`;
    writeLog(appLogStream, 'INFO', formattedMessage);
    convoLogStream.write(`${timestamp()} ${formattedMessage}\n`);
  }
};

// Override dos console.* para usar o logger
const originalConsoleError = console.error;

console.log = (...args) => logger.info(...args);
console.error = (...args) => {
  const message = format(...args);
  // Filtra avisos de depreciação
  if (shouldIgnoreMessage(message)) {
    if (process.env.NODE_ENV === 'development') {
      // Em desenvolvimento, ainda mostra no console original
      originalConsoleError(...args);
    }
    return;
  }
  logger.error(...args);
};
console.warn = (...args) => logger.warn(...args);
console.info = (...args) => logger.info(...args);
console.debug = (...args) => logger.debug(...args);

export default logger;
