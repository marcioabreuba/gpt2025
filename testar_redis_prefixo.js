/**
 * Script para testar se os prefixos do Redis estão funcionando corretamente
 * 
 * Como usar:
 * 1. Instale o pacote redis: npm install redis
 * 2. Execute: node testar_redis_prefixo.js [prefixo]
 * 
 * Exemplo: node testar_redis_prefixo.js store2
 */

import 'dotenv/config';
import redis from 'redis';
import readline from 'readline';

// Cria interface para entrada/saída
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para perguntar ao usuário
function pergunta(questao) {
  return new Promise((resolve) => {
    rl.question(questao, (resposta) => {
      resolve(resposta);
    });
  });
}

// Função principal
async function main() {
  // Obtém o prefixo da linha de comando ou solicita ao usuário
  let prefixo = process.argv[2];
  
  if (!prefixo) {
    prefixo = await pergunta('Digite o prefixo a ser testado: ');
  }
  
  if (!prefixo) {
    console.error('❌ Prefixo não informado. Encerrando.');
    process.exit(1);
  }
  
  console.log(`\n🔍 Testando prefixo "${prefixo}" no Redis...`);
  
  try {
    // Carrega configuração do Redis do arquivo .env
    const REDIS_URL = process.env.REDIS_URL;
    const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
    
    if (!REDIS_URL || !REDIS_PASSWORD) {
      console.error('❌ Configuração do Redis não encontrada no arquivo .env');
      process.exit(1);
    }
    
    // Cria cliente Redis padrão
    const redisUrlCompleta = `redis://default:${REDIS_PASSWORD}@${REDIS_URL}`;
    console.log(`📡 Conectando ao Redis: ${REDIS_URL}`);
    
    const clienteRedis = redis.createClient({
      url: redisUrlCompleta
    });
    
    // Configura log de erros
    clienteRedis.on('error', (err) => {
      console.error('Erro no Redis:', err);
    });
    
    // Conecta ao Redis
    await clienteRedis.connect();
    console.log('✅ Conectado ao Redis com sucesso!');
    
    // Cria chave de teste com prefixo manual
    const chaveComPrefixo = `${prefixo}:chave-teste`;
    const valorTeste = `Teste realizado em ${new Date().toISOString()}`;
    
    console.log(`\n📝 Gravando valor em "${chaveComPrefixo}"...`);
    await clienteRedis.set(chaveComPrefixo, valorTeste);
    
    // Verifica se o valor foi gravado corretamente
    console.log(`🔍 Verificando valor gravado...`);
    const valorRecuperado = await clienteRedis.get(chaveComPrefixo);
    
    if (valorRecuperado === valorTeste) {
      console.log(`✅ Teste bem-sucedido! Valor recuperado: "${valorRecuperado}"`);
    } else {
      console.error(`❌ Teste falhou! Valor esperado: "${valorTeste}", Valor obtido: "${valorRecuperado}"`);
    }
    
    // Limpa chave de teste
    console.log(`\n🧹 Removendo chave de teste...`);
    await clienteRedis.del(chaveComPrefixo);
    console.log('✅ Chave removida com sucesso!');
    
    // Lista todas as chaves com o prefixo
    console.log(`\n📋 Listando todas as chaves existentes com prefixo "${prefixo}:"...`);
    const chaves = await clienteRedis.keys(`${prefixo}:*`);
    
    if (chaves.length > 0) {
      console.log(`🔑 Encontradas ${chaves.length} chaves:`);
      chaves.forEach((chave) => {
        console.log(`   - ${chave}`);
      });
    } else {
      console.log('📭 Nenhuma chave encontrada com este prefixo.');
    }
    
    // Fecha conexão
    await clienteRedis.quit();
    console.log('\n👋 Conexão com Redis fechada.');
    
  } catch (erro) {
    console.error(`\n❌ Erro ao testar Redis: ${erro.message}`);
    console.error(erro);
  }
  
  rl.close();
}

// Executa função principal
main(); 