// Script para iniciar a aplicação 
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Obtém o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração para ignorar avisos de depreciação
process.env.NODE_NO_WARNINGS = '1';

// Banner de inicialização
console.log(`
┌─────────────────────────────────────────────┐
│                                             │
│             INICIANDO APLICAÇÃO             │
│                                             │
└─────────────────────────────────────────────┘
`);

// Configurações
console.log('🔧 Configurações:');
console.log(`• NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);
console.log(`• LOG_LEVEL: ${process.env.LOG_LEVEL || 'info (padrão)'}`);
console.log(`• PORT: ${process.env.PORT || '3000 (padrão)'}`);

// Cria diretório de logs se não existir
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
  console.log(`📁 Diretório de logs criado: ${logDir}`);
}

// Inicia a aplicação
console.log('\n🚀 Iniciando servidor...');

const app = spawn('node', ['src/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_NO_WARNINGS: '1'
  }
});

// Tratamento de eventos do processo
app.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Aplicação encerrada normalmente.');
  } else {
    console.error(`\n❌ Aplicação encerrada com código: ${code}`);
  }
});

// Encaminha sinais do sistema operacional para a aplicação
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando aplicação...');
  app.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Encerrando aplicação...');
  app.kill('SIGTERM');
}); 