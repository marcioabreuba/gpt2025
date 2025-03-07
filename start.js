// Script para iniciar a aplicação ignorando avisos de depreciação
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtém o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração para ignorar avisos de depreciação
process.env.NODE_NO_WARNINGS = '1';

// Inicia a aplicação
console.log('🚀 Iniciando a aplicação...');

const app = spawn('node', ['src/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_NO_WARNINGS: '1'
  }
});

// Tratamento de eventos do processo
app.on('close', (code) => {
  console.log(`Aplicação encerrada com código: ${code}`);
});

// Encaminha sinais do sistema operacional para a aplicação
process.on('SIGINT', () => {
  console.log('Encerrando aplicação...');
  app.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Encerrando aplicação...');
  app.kill('SIGTERM');
}); 