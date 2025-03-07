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
  if (PRINT_TO_CONSOLE) {
    process.stdout.write(formattedMessage);
  }
  
  // Escreve no arquivo
  try {
    stream.write(formattedMessage);
  } catch (error) {
    console.error(`Erro ao escrever no log:`, error);
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
    // Não escrever no log padrão, apenas no de conversas, para evitar duplicação
    convoLogStream.write(`${timestamp()} ${formattedMessage}\n`);
    
    // Escrever apenas no console se necessário
    if (PRINT_TO_CONSOLE) {
      console.info(`📱 ${formattedMessage}`);
    }
  },
  
  iaMessage: (phone, message) => {
    const formattedMessage = `🤖 Sofia → ${phone}: "${message}"`;
    // Não escrever no log padrão, apenas no de conversas, para evitar duplicação
    convoLogStream.write(`${timestamp()} ${formattedMessage}\n`);
    
    // Escrever apenas no console se necessário
    if (PRINT_TO_CONSOLE) {
      console.info(`🔄 ${formattedMessage}`);
    }
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
