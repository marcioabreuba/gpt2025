import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { 
  createVectorStore,
  addFilesToVectorStore,
  checkVectorStoreStatus
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
 * Este script seria útil apenas se você quisesse migrar dados do Pinecone para
 * um vector store da OpenAI, o que não é necessário na configuração atual.
 */

console.log(`
⚠️ ATENÇÃO ⚠️

Este script não é necessário na configuração atual do projeto.
Seus arquivos já estão anexados diretamente ao assistente através da interface da OpenAI.

Se realmente deseja migrar dados do Pinecone para um vector store da OpenAI,
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

  // Diretório temporário para salvar os dados antes de enviar para a OpenAI
  const TEMP_DIR = path.join(__dirname, '../temp/pinecone_migration');

  // Configurações
  const PINECONE_INDEX = config.pinecone.index;
  const VECTOR_STORE_NAME = process.env.VECTOR_STORE_NAME || 'Dados Migrados do Pinecone';

  // Inicializa o cliente Pinecone
  const pc = new Pinecone({ apiKey: config.pinecone.apiKey });

  // Inicializa o cliente OpenAI
  const openai = new OpenAI({ apiKey: config.openai.apiKey });

  /**
   * Função principal para migrar dados do Pinecone para o Vector Store da OpenAI
   */
  async function migratePineconeToOpenAI() {
    console.log('🚀 Iniciando migração do Pinecone para o Vector Store OpenAI');
    console.log(`📦 Índice Pinecone: ${PINECONE_INDEX}`);
    console.log(`📦 Nome do Vector Store: ${VECTOR_STORE_NAME}`);
    
    try {
      // 1. Criar o diretório temporário se não existir
      if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
      }
      
      // 2. Obter todos os registros do Pinecone
      const index = await pc.index(PINECONE_INDEX);
      console.log('🔍 Consultando registros do Pinecone...');
      
      // Lista de IDs para consultar (limite de 1000 por vez)
      // Primeiro, obtemos a lista completa de IDs
      const stats = await index.describeIndexStats();
      const totalVectors = stats.totalVectorCount;
      
      console.log(`📊 Total de vetores no Pinecone: ${totalVectors}`);
      
      if (totalVectors === 0) {
        console.log('⚠️ Não há dados para migrar no Pinecone.');
        return;
      }
      
      // 3. Criar um novo vector store na OpenAI
      console.log(`📦 Criando vector store: ${VECTOR_STORE_NAME}`);
      const vectorStore = await createVectorStore(VECTOR_STORE_NAME);
      console.log(`✅ Vector store criado com ID: ${vectorStore.id}`);
      
      // Salvar o ID no .env se não existir o principal
      if (!process.env.OPENAI_VECTOR_STORE_ID) {
        updateEnvFile('OPENAI_VECTOR_STORE_ID', vectorStore.id);
      }
      
      // 4. Buscar os dados em lotes e salvá-los temporariamente
      const BATCH_SIZE = 100;
      let processed = 0;
      let batchFiles = [];
      
      // Função para extrair dados de um vetor do Pinecone e salvar como arquivo
      async function processVector(vector) {
        if (!vector.metadata || !vector.metadata.content) {
          return null;
        }
        
        try {
          const content = vector.metadata.content;
          const title = vector.metadata.title || `documento_${vector.id}`;
          
          // Cria um arquivo temporário com o conteúdo
          const filePath = path.join(TEMP_DIR, `${title}.txt`);
          fs.writeFileSync(filePath, content);
          
          return filePath;
        } catch (error) {
          console.error(`⚠️ Erro ao processar vetor ${vector.id}: ${error.message}`);
          return null;
        }
      }
      
      // Consultar todos os vetores em batches
      let batchNum = 1;
      let hasMoreVectors = true;
      let nextPageToken = null;
      
      while (hasMoreVectors) {
        console.log(`📄 Processando lote ${batchNum}...`);
        
        // Consultar um lote de vetores
        const queryOptions = {
          topK: BATCH_SIZE,
          includeMetadata: true
        };
        
        if (nextPageToken) {
          queryOptions.paginationToken = nextPageToken;
        }
        
        const results = await index.query(queryOptions);
        
        if (!results.matches || results.matches.length === 0) {
          hasMoreVectors = false;
          break;
        }
        
        // Processar cada vetor no lote
        const filePromises = results.matches.map(processVector);
        const filePaths = (await Promise.all(filePromises)).filter(Boolean);
        
        processed += filePaths.length;
        batchFiles = batchFiles.concat(filePaths);
        
        console.log(`✅ Processados ${processed}/${totalVectors} vetores`);
        
        // Se atingiu um número razoável de arquivos, faz upload para o vector store
        if (batchFiles.length >= 50 || !hasMoreVectors) {
          console.log(`📤 Enviando ${batchFiles.length} arquivos para o vector store...`);
          
          if (batchFiles.length > 0) {
            await addFilesToVectorStore(vectorStore.id, batchFiles);
            
            // Limpa os arquivos temporários após o upload
            batchFiles.forEach(file => {
              try {
                fs.unlinkSync(file);
              } catch (error) {
                console.error(`⚠️ Erro ao remover arquivo temporário ${file}: ${error.message}`);
              }
            });
            
            batchFiles = [];
          }
        }
        
        // Verifica se há mais vetores a serem processados
        if (results.paginationToken) {
          nextPageToken = results.paginationToken;
        } else {
          hasMoreVectors = false;
        }
        
        batchNum++;
      }
      
      // 5. Aguardar o processamento completo
      console.log('⏳ Aguardando processamento completo dos arquivos no vector store...');
      await waitForProcessingCompletion(vectorStore.id);
      
      console.log('\n🎉 Migração concluída com sucesso!');
      console.log(`📊 ${processed} vetores migrados para o Vector Store OpenAI`);
      console.log(`🔑 ID do Vector Store: ${vectorStore.id}`);
      
    } catch (error) {
      console.error(`❌ Erro na migração: ${error.message}`);
      console.error(error.stack);
    }
  }

  /**
   * Aguarda até que todos os arquivos no vector store estejam processados
   * @param {string} vectorStoreId - ID do vector store
   */
  async function waitForProcessingCompletion(vectorStoreId) {
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
  migratePineconeToOpenAI();
}, 10000); 