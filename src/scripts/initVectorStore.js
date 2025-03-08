import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { 
  createVectorStore, 
  addFilesToVectorStore, 
  checkVectorStoreStatus,
  attachVectorStoreToAssistant
} from '../services/openaiVectorStore.js';
import logger from '../utils/logger.js';

/**
 * NOTA IMPORTANTE:
 * ---------------
 * Este script NÃO é necessário na configuração atual do projeto, pois os arquivos
 * já estão anexados diretamente ao assistente através da interface da OpenAI.
 * 
 * Se você estiver usando a configuração onde os arquivos são anexados diretamente
 * ao assistente (não através de um vector store gerenciado via API), este script
 * não deve ser executado.
 * 
 * Este script seria útil apenas se você quisesse migrar para o modelo de vector store
 * separado, que permite até 10.000 arquivos (contra o limite menor de anexos diretos).
 */

console.log(`
⚠️ ATENÇÃO ⚠️

Este script não é necessário na configuração atual do projeto.
Seus arquivos já estão anexados diretamente ao assistente através da interface da OpenAI.

Se realmente deseja migrar para o modelo de vector store separado (até 10.000 arquivos),
remova esta mensagem e execute o script novamente.

Pressione Ctrl+C para cancelar...
`);

// Aguardar 10 segundos antes de continuar, dando tempo para cancelar
setTimeout(() => {
  console.log('Continuando com a execução do script...');
  // Carregando variáveis de ambiente
  dotenv.config();

  // Obter o diretório atual
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Diretório de documentos a serem carregados para o vector store
  const DOCS_DIR = path.join(__dirname, '../../docs');

  // Nome do vector store a ser criado
  const VECTOR_STORE_NAME = process.env.VECTOR_STORE_NAME || 'Base de Conhecimento';

  // ID do assistente a ser configurado
  const ASSISTANT_ID = config.openai.assistantId;

  /**
   * Função principal para inicializar o vector store
   */
  async function initializeVectorStore() {
    console.log('🚀 Inicializando o Vector Store OpenAI');
    
    try {
      // 1. Criar o vector store
      console.log(`📦 Criando vector store: ${VECTOR_STORE_NAME}`);
      const vectorStore = await createVectorStore(VECTOR_STORE_NAME);
      console.log(`✅ Vector store criado com ID: ${vectorStore.id}`);
      
      // Salvar o ID do vector store no .env
      updateEnvFile('OPENAI_VECTOR_STORE_ID', vectorStore.id);
      
      // 2. Verificar se o diretório de documentos existe
      if (!fs.existsSync(DOCS_DIR)) {
        console.log(`📁 Criando diretório de documentos: ${DOCS_DIR}`);
        fs.mkdirSync(DOCS_DIR, { recursive: true });
      }
      
      // 3. Carregar documentos do diretório, se houver
      const files = getFilesFromDirectory(DOCS_DIR);
      
      if (files.length > 0) {
        console.log(`📄 Encontrados ${files.length} arquivos para carregar`);
        
        // Adicionar arquivos ao vector store
        const batch = await addFilesToVectorStore(vectorStore.id, files);
        console.log(`✅ ${batch.file_counts.processed} arquivos processados com sucesso`);
        
        // Aguardar processamento completo
        await waitForProcessingCompletion(vectorStore.id);
      } else {
        console.log('⚠️ Nenhum arquivo encontrado no diretório de documentos');
      }
      
      // 4. Configurar o assistente para usar o vector store
      console.log(`🤖 Configurando assistente ${ASSISTANT_ID} para usar o vector store`);
      await attachVectorStoreToAssistant(ASSISTANT_ID, vectorStore.id);
      console.log('✅ Assistente configurado com sucesso');
      
      console.log('\n🎉 Vector Store inicializado com sucesso!');
      console.log(`ID do Vector Store: ${vectorStore.id}`);
      console.log('Este ID foi salvo no arquivo .env como OPENAI_VECTOR_STORE_ID');
      
    } catch (error) {
      console.error(`❌ Erro ao inicializar o vector store: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Recupera todos os arquivos em um diretório recursivamente
   * @param {string} directory - Caminho do diretório
   * @returns {string[]} - Lista de caminhos de arquivos
   */
  function getFilesFromDirectory(directory) {
    const files = [];
    
    const items = fs.readdirSync(directory);
    
    for (const item of items) {
      const itemPath = path.join(directory, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Recursivamente obtém arquivos de subdiretórios
        files.push(...getFilesFromDirectory(itemPath));
      } else {
        // Adiciona apenas arquivos suportados
        const extension = path.extname(itemPath).toLowerCase();
        const supportedExtensions = ['.pdf', '.txt', '.doc', '.docx', '.csv', '.json', '.md'];
        
        if (supportedExtensions.includes(extension)) {
          files.push(itemPath);
        }
      }
    }
    
    return files;
  }

  /**
   * Aguarda até que todos os arquivos no vector store estejam processados
   * @param {string} vectorStoreId - ID do vector store
   */
  async function waitForProcessingCompletion(vectorStoreId) {
    console.log('⏳ Aguardando processamento completo dos arquivos...');
    let isProcessing = true;
    
    while (isProcessing) {
      const status = await checkVectorStoreStatus(vectorStoreId);
      
      if (status.file_counts.in_progress === 0) {
        isProcessing = false;
        console.log('✅ Todos os arquivos foram processados!');
      } else {
        const totalFiles = status.file_counts.processed + status.file_counts.in_progress + status.file_counts.error;
        const progress = Math.floor((status.file_counts.processed / totalFiles) * 100);
        
        console.log(`⏳ Processando: ${progress}% concluído (${status.file_counts.processed}/${totalFiles})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Atualiza o arquivo .env com uma nova variável
   * @param {string} key - Nome da variável
   * @param {string} value - Valor da variável
   */
  function updateEnvFile(key, value) {
    const envPath = path.join(__dirname, '../../.env');
    
    if (fs.existsSync(envPath)) {
      // Ler o conteúdo atual do arquivo .env
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Verificar se a variável já existe
      const regex = new RegExp(`^${key}=.*$`, 'm');
      
      if (regex.test(envContent)) {
        // Substituir valor existente
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        // Adicionar nova variável
        envContent += `\n${key}=${value}`;
      }
      
      // Salvar o arquivo atualizado
      fs.writeFileSync(envPath, envContent);
    } else {
      // Criar novo arquivo .env
      fs.writeFileSync(envPath, `${key}=${value}\n`);
    }
  }

  // Executar o script
  initializeVectorStore();
}, 10000); 