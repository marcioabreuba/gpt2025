// src/utils/logger.js
import fs from 'fs';
import path from 'path';
import { format } from 'util';

// Garante que o diretório de logs existe
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Tratamento de erro para os streams
function createSafeWriteStream(filePath) {
  try {
    return fs.createWriteStream(filePath, { flags: 'a' });
  } catch (error) {
    console.error(`Erro ao criar stream para ${filePath}:`, error);
    // Fallback para um stream que não faz nada
    return { 
      write: () => {}, 
      end: () => {},
      on: () => {}
    };
  }
}

// Streams de arquivos para logs
const appLogStream = createSafeWriteStream(path.join(logDir, 'application.log'));
const errorLogStream = createSafeWriteStream(path.join(logDir, 'error.log'));
const convoLogStream = createSafeWriteStream(path.join(logDir, 'conversation.log'));

// Flag para controlar a saída para o console
const PRINT_TO_CONSOLE = true;

// Salva as funções originais do console antes de sobrescrevê-las
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

// Flag para evitar loops infinitos de logging
let isLogging = false;

// Cache de mensagens recentes para evitar duplicação
const recentMessages = new Set();
const MESSAGE_CACHE_SIZE = 100;
const MESSAGE_CACHE_TTL = 2000; // 2 segundos

// Função para adicionar à cache com tempo de expiração
function addToRecentMessages(message) {
  // Limpa cache se ficar muito grande
  if (recentMessages.size > MESSAGE_CACHE_SIZE) {
    recentMessages.clear();
  }
  
  // Adiciona mensagem com expiração
  recentMessages.add(message);
  setTimeout(() => {
    recentMessages.delete(message);
  }, MESSAGE_CACHE_TTL);
  
  // Retorna true se a mensagem já existia
  return recentMessages.has(message);
}

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
  // Previne loops infinitos
  if (isLogging) return;
  isLogging = true;
  
  try {
    // Ignora avisos de depreciação e outros avisos internos do Node
    if (shouldIgnoreMessage(message)) {
      isLogging = false;
      return;
    }
  
    // Verifica se a mensagem é recente duplicada
    const messageKey = `${level}:${message}`;
    if (addToRecentMessages(messageKey)) {
      isLogging = false;
      return;
    }
  
    const time = timestamp();
    const formattedMessage = `${time} [${level.toUpperCase()}] ${message}\n`;
    
    // Escreve no console usando a função original
    if (PRINT_TO_CONSOLE) {
      process.stdout.write(formattedMessage);
    }
    
    // Escreve no arquivo
    try {
      stream.write(formattedMessage);
    } catch (error) {
      originalConsole.error(`Erro ao escrever no log:`, error);
    }
  } finally {
    isLogging = false;
  }
}

// Mapeamento de níveis para decidir quando exibir logs
const shouldShowLevel = {
  error: () => true,
  warn: () => true,
  info: () => true,
  debug: () => process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace',
  trace: () => process.env.LOG_LEVEL === 'trace',
  convo: () => true
};

// Logger simples
const logger = {
  // Método genérico para compatibilidade com chamadas diretas
  log: (level, ...args) => {
    const levelLower = String(level).toLowerCase();
    if (shouldShowLevel[levelLower]?.()) {
      const message = format(...args);
      if (levelLower === 'error') {
        writeLog(appLogStream, levelLower, message);
        writeLog(errorLogStream, levelLower, message);
      } else {
        writeLog(appLogStream, levelLower, message);
      }
    }
  },

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
    if (shouldShowLevel.debug()) {
      const message = format(...args);
      writeLog(appLogStream, 'DEBUG', message);
    }
  },
  
  // Adicionando a função trace que estava faltando
  trace: (...args) => {
    if (shouldShowLevel.trace()) {
      const message = format(...args);
      writeLog(appLogStream, 'TRACE', message);
    }
  },
  
  // Funções para mensagens de conversação
  userMessage: (phone, message) => {
    const formattedMessage = `👤 ${phone} → Sofia: "${message}"`;
    
    // Adicionar à cache para evitar duplicação
    const messageKey = `USER:${phone}:${message}`;
    if (addToRecentMessages(messageKey)) {
      return;
    }
    
    // Escrever no arquivo de conversas
    convoLogStream.write(`${timestamp()} ${formattedMessage}\n`);
    
    // Escrever no console usando a função original
    if (PRINT_TO_CONSOLE) {
      process.stdout.write(`${timestamp()} [INFO] 📱 ${formattedMessage}\n`);
    }
  },
  
  iaMessage: (phone, message) => {
    const formattedMessage = `🤖 Sofia → ${phone}: "${message}"`;
    
    // Adicionar à cache para evitar duplicação
    const messageKey = `IA:${phone}:${message.substring(0, 50)}`;
    if (addToRecentMessages(messageKey)) {
      return;
    }
    
    // Escrever no arquivo de conversas
    convoLogStream.write(`${timestamp()} ${formattedMessage}\n`);
    
    // Escrever no console usando a função original
    if (PRINT_TO_CONSOLE) {
      process.stdout.write(`${timestamp()} [INFO] 🔄 ${formattedMessage}\n`);
    }
  }
};

// Override dos console.* para usar o logger
console.log = (...args) => logger.info(...args);
console.error = (...args) => {
  const message = format(...args);
  // Filtra avisos de depreciação
  if (shouldIgnoreMessage(message)) {
    if (process.env.NODE_ENV === 'development') {
      // Em desenvolvimento, ainda mostra no console original
      originalConsole.error(...args);
    }
    return;
  }
  logger.error(...args);
};
console.warn = (...args) => logger.warn(...args);
console.info = (...args) => logger.info(...args);
console.debug = (...args) => logger.debug(...args);

export default logger;
