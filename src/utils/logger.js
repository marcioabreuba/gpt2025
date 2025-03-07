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

// Contador de logs para numeração sequencial
let logCounter = 1;

// Definição de cores para cada nível no console
const colors = {
  // Estilos de texto: bold, brilhante, sublinhado, fundo, etc
  // Formato: \x1b[<estilo>;<cor texto>;<cor fundo>m
  error: '\x1b[1;37;41m', // Texto branco bold em fundo vermelho
  warn: '\x1b[1;30;43m',  // Texto preto bold em fundo amarelo
  info: '\x1b[1;37;44m',  // Texto branco bold em fundo azul
  debug: '\x1b[38;5;34m', // Verde escuro 256 cores
  trace: '\x1b[38;5;141m', // Lilás mais suave 256 cores
  success: '\x1b[1;37;42m', // Texto branco bold em fundo verde
  reset: '\x1b[0m'        // Reset
};

// Obtém o nível de log do ambiente ou usa o padrão do config
const logLevel = process.env.LOG_LEVEL || config.loggerLevel || 'info';

// Função para criar uma caixa de destaque para mensagens importantes
function criarCaixaDestaque(mensagem, tipo = 'info') {
  const color = colors[tipo] || colors.info;
  const largura = mensagem.length + 8;
  const linhaHorizontal = `${color}+${'-'.repeat(largura)}+${colors.reset}`;
  const espacoVazio = `${color}|${' '.repeat(largura)}|${colors.reset}`;
  
  return `
${linhaHorizontal}
${espacoVazio}
${color}|    ${mensagem}    |${colors.reset}
${espacoVazio}
${linhaHorizontal}
`;
}

// Configuração do logger com Winston
const logger = winston.createLogger({
  level: logLevel,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
    success: 2 // Mesmo nível de importância que info
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
        const metaString = Object.keys(meta).length ? 
          `\n${colors.reset}${JSON.stringify(meta, null, 2)}` : '';
        
        // Símbolos para cada nível usando setas e números
        const symbols = {
          error: '[!] ',
          warn: '[*] ',
          info: '[→] ',
          debug: '[#] ',
          trace: '[+] ',
          success: '[✓] '
        };
        
        const symbol = symbols[level] || '';
        const logNumber = logCounter++;
        
        // Datas e horas sem cor (branco padrão)
        return `${colors.reset}${timestamp} ${color}[${logNumber.toString().padStart(4, '0')}] ${symbol}[${level.toUpperCase()}]: ${message}${colors.reset}${metaString}`;
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

// Adicionar helper para sucesso
logger.success = (message, ...meta) => {
  logger.log('success', message, ...meta);
};

// Adiciona funções para mensagens em destaque
logger.destaque = (mensagem, tipo = 'info') => {
  const caixa = criarCaixaDestaque(mensagem, tipo);
  logger.log(tipo, caixa);
  return caixa; // Retorna a caixa formatada caso seja necessário usar em outro lugar
};

logger.destaqueErro = (mensagem) => logger.destaque(mensagem, 'error');
logger.destaqueSucesso = (mensagem) => logger.destaque(mensagem, 'success');
logger.destaqueAviso = (mensagem) => logger.destaque(mensagem, 'warn');

// Aliases para facilitar o uso e transição dos console.log existentes
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

// Função para detectar mensagens de sucesso típicas
function isSuccessMessage(message) {
  if (typeof message !== 'string') return false;
  const successPatterns = [
    /✅/,
    /sucesso/i,
    /concluído/i,
    /concluido/i,
    /completo/i,
    /criado/i,
    /finalizado/i,
    /ok/i,
    /feito/i,
    /pronto/i,
    /funcionando/i,
    /sincronizado/i,
    /conectado/i,
    /carregado/i,
    /iniciado/i,
    /atualizado/i,
    /inserido/i,
    /enviado/i,
    /processado/i,
    /\bsim\b/i
  ];
  return successPatterns.some(pattern => pattern.test(message));
}

// Sobrescreve os métodos do console para usar o logger
console.log = (...args) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  
  // Detecta se é uma mensagem de sucesso
  if (isSuccessMessage(args[0])) {
    logger.success(message);
  } else {
    logger.info(message);
  }
  
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
