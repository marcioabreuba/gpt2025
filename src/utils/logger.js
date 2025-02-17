// src/utils/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Registra no console
    new winston.transports.Console(),
    // Registra em um arquivo (por exemplo, logs/app.log)
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});

export default logger;
