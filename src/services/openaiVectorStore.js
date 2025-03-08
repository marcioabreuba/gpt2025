import OpenAI from "openai";
import fs from "fs";
import path from "path";
import config from "../config.js";
import logger from "../utils/logger.js";

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Cria um novo vector store na OpenAI
 * @param {string} name - Nome do vector store
 * @returns {Promise<Object>} - Objeto do vector store criado
 */
export async function createVectorStore(name) {
  try {
    logger.info(`Criando vector store: ${name}`);
    const vectorStore = await openai.beta.vector_stores.create({
      name: name
    });
    
    logger.info(`Vector store criado com sucesso: ${vectorStore.id}`);
    return vectorStore;
  } catch (error) {
    logger.error(`Erro ao criar vector store: ${error.message}`);
    throw error;
  }
}

/**
 * Adiciona arquivos a um vector store existente
 * @param {string} vectorStoreId - ID do vector store
 * @param {string[]} filePaths - Caminhos dos arquivos a serem adicionados
 * @returns {Promise<Object>} - Resultado do batch de upload
 */
export async function addFilesToVectorStore(vectorStoreId, filePaths) {
  try {
    logger.info(`Adicionando ${filePaths.length} arquivos ao vector store ${vectorStoreId}`);
    
    // Upload dos arquivos para o OpenAI Files
    const fileIds = [];
    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const fileStream = fs.createReadStream(filePath);
      
      const file = await openai.files.create({
        file: fileStream,
        purpose: "assistants"
      });
      
      fileIds.push(file.id);
      logger.info(`Arquivo ${fileName} carregado com ID: ${file.id}`);
    }
    
    // Adiciona os arquivos ao vector store
    const batch = await openai.beta.vector_stores.file_batches.create_and_poll(
      vectorStoreId,
      { file_ids: fileIds }
    );
    
    logger.info(`Batch criado com sucesso: ${batch.id}`);
    return batch;
  } catch (error) {
    logger.error(`Erro ao adicionar arquivos ao vector store: ${error.message}`);
    throw error;
  }
}

/**
 * Verifica o status de processamento de um vector store
 * @param {string} vectorStoreId - ID do vector store
 * @returns {Promise<Object>} - Status do vector store
 */
export async function checkVectorStoreStatus(vectorStoreId) {
  try {
    const vectorStore = await openai.beta.vector_stores.retrieve(vectorStoreId);
    
    logger.info(`Status do vector store ${vectorStoreId}:`);
    logger.info(`- Processados: ${vectorStore.file_counts.processed}`);
    logger.info(`- Em processamento: ${vectorStore.file_counts.in_progress}`);
    logger.info(`- Com erro: ${vectorStore.file_counts.error}`);
    
    return vectorStore;
  } catch (error) {
    logger.error(`Erro ao verificar status do vector store: ${error.message}`);
    throw error;
  }
}

/**
 * Configura um assistente para usar um vector store específico
 * @param {string} assistantId - ID do assistente
 * @param {string} vectorStoreId - ID do vector store
 * @returns {Promise<Object>} - Assistente atualizado
 */
export async function attachVectorStoreToAssistant(assistantId, vectorStoreId) {
  try {
    logger.info(`Anexando vector store ${vectorStoreId} ao assistente ${assistantId}`);
    
    const assistant = await openai.beta.assistants.update(
      assistantId,
      {
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreId]
          }
        }
      }
    );
    
    logger.info(`Vector store anexado com sucesso ao assistente ${assistantId}`);
    return assistant;
  } catch (error) {
    logger.error(`Erro ao anexar vector store ao assistente: ${error.message}`);
    throw error;
  }
}

/**
 * Anexa um vector store a uma thread específica
 * @param {string} threadId - ID da thread
 * @param {string} vectorStoreId - ID do vector store
 * @returns {Promise<Object>} - Thread atualizada
 */
export async function attachVectorStoreToThread(threadId, vectorStoreId) {
  try {
    logger.info(`Anexando vector store ${vectorStoreId} à thread ${threadId}`);
    
    const thread = await openai.beta.threads.update(
      threadId,
      {
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreId]
          }
        }
      }
    );
    
    logger.info(`Vector store anexado com sucesso à thread ${threadId}`);
    return thread;
  } catch (error) {
    logger.error(`Erro ao anexar vector store à thread: ${error.message}`);
    throw error;
  }
}

/**
 * Migra os dados do Pinecone para um vector store da OpenAI
 * @param {string} pineconeIndex - Nome do índice Pinecone
 * @param {string} vectorStoreName - Nome para o novo vector store
 * @returns {Promise<Object>} - Vector store criado
 */
export async function migratePineconeToOpenAI(pineconeIndex, vectorStoreName) {
  // Esta função é apenas um exemplo e precisará ser adaptada ao seu caso específico
  logger.info(`Iniciando migração de ${pineconeIndex} para OpenAI Vector Store`);
  
  // 1. Crie um novo vector store na OpenAI
  const vectorStore = await createVectorStore(vectorStoreName);
  
  // 2. A implementação completa dependeria de como seus dados estão estruturados no Pinecone
  // e de como você quer organizá-los no Vector Store da OpenAI
  
  logger.info(`Migração concluída para o vector store ${vectorStore.id}`);
  return vectorStore;
} 