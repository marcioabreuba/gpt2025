import cron from 'node-cron';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import axios from 'axios';
import { Pinecone } from '@pinecone-database/pinecone';
import logger from '../utils/logger.js';

// Inicializa o cliente Pinecone para lidar com vetores de texto e imagem
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    controllerHostUrl: "https://controller.us-west1-gcp.pinecone.io"
});

// Configuração dos endpoints diretos para API REST
const TEXT_ENDPOINT = "https://tropicalize-products-rzi4pqr.svc.aped-4627-b74a.pinecone.io/vectors/upsert";
const IMAGE_ENDPOINT = "https://image-rzi4pqr.svc.aped-4627-b74a.pinecone.io/vectors/upsert";

// Inicializa o cliente Prisma para interação com o banco de dados
const prisma = new PrismaClient();

// Função assíncrona para processar a fila de treinamento
async function processQueueTraining() {
  try {
    logger.info('🚀 Executando cronjob para processar QueueTraining...');

    // Busca um item pendente na fila de treinamento no banco de dados
    const items = await prisma.queueTraining.findMany({
      where: { status: false }, // Somente itens não processados
      take: 5, // Processa 5 item por vez
    });

    if (items.length === 0) {
      logger.info('✅ Nenhum item pendente para processar.');
      return;
    }

    logger.info(`🔄 Processando ${items.length} itens...`);

    // Geração dos vetores para cada item na fila
    const vectors = await Promise.all(
      items.map(async (item) => {
        try {
          let embedding = null;
          let targetIndex = null;
          let dimension = null;

          // Se o item for do tipo texto, gera embeddings via OpenAI
          if (item.type === 'text') {
            logger.debug(`📝 Processando texto para o item ${item.id}: ${item.content.substring(0, 50)}...`);
            
            const response = await axios.post(
              'https://api.openai.com/v1/embeddings',
              { 
                input: item.content, 
                model: 'text-embedding-ada-002' 
              },
              { 
                headers: { 
                  'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                  'Content-Type': 'application/json'
                } 
              }
            );
            
            // Log da resposta para debug
            logger.trace(`🔍 Resposta da OpenAI para o item ${item.id}:`, 
                       { responseStatus: response.status, firstEmbeddingLength: response.data?.data[0]?.embedding?.length });
            
            embedding = response.data.data[0]?.embedding || null;
            targetIndex = 'text';
            dimension = 1536;
          } 
          // Se o item for imagem, gera embeddings via Jina AI
          else if (item.type === 'image') {
            logger.debug(`🖼️ Processando imagem para o item ${item.id}: ${item.content.substring(0, 50)}...`);
            
            const response = await axios.post(
              'https://api.jina.ai/v1/embeddings',
              {
                input: [{ image: item.content }],  // Formato correto para imagens
                model: "jina-clip-v2",             // Modelo conforme documentação
                dimensions: 1024,                  // Dimensão explícita 
                normalized: true                   // Vetores normalizados
              },
              { 
                headers: { 
                  'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
                  'Content-Type': 'application/json'
                } 
              }
            );
            
            // Log da resposta para debug
            logger.trace(`🔍 Resposta da Jina AI para o item ${item.id}:`, 
                       JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
            
            // A estrutura da resposta Jina é data -> array de objetos -> embedding
            embedding = response.data.data[0]?.embedding;
            
            if (!embedding) {
              logger.error(`❌ Estrutura de resposta inesperada da Jina AI para o item ${item.id}`);
              logger.error('Resposta:', response.data);
              return null;
            }
            
            targetIndex = 'image';
            dimension = 1024;  // Dimensão para os modelos CLIP da Jina
          }

          // Validação dos embeddings gerados
          if (!embedding || !Array.isArray(embedding)) {
            logger.error(`❌ Erro: Embedding inválido para o item ${item.id}`);
            return null;
          }

          if (embedding.length !== dimension) {
            logger.error(`❌ Erro: Dimensão incorreta para o item ${item.id} (${embedding.length} vs ${dimension})`);
            return null;
          }

          logger.info(`✅ Embedding gerado com sucesso para o item ${item.id} (${embedding.length} dimensões)`);
          
          return {
            id: String(item.id),
            values: embedding,
            metadata: {
              productId: String(item.productId),
              content: item.content,
            },
            targetIndex,
            originalId: item.id  // Preserva o ID original no formato correto
          };
        } catch (error) {
          logger.error(`❌ Erro ao processar item ${item.id}:`, error.message);
          if (error.response) {
            logger.error('Status:', error.response.status);
            logger.error('Dados:', JSON.stringify(error.response.data).substring(0, 500));
          }
          logger.error('Stack trace:', error.stack);
          return null;
        }
      })
    );

    // Filtra os vetores válidos
    const validVectors = vectors.filter(v => v !== null);
    logger.info(`🔢 Total de vetores válidos: ${validVectors.length} de ${items.length}`);

    // Separa os vetores em categorias de texto e imagem
    const textVectors = validVectors.filter(v => v.targetIndex === 'text').map(({ id, values, metadata }) => ({ id, values, metadata }));
    const imageVectors = validVectors.filter(v => v.targetIndex === 'image').map(({ id, values, metadata }) => ({ id, values, metadata }));

    logger.info(`📊 Distribuição: ${textVectors.length} vetores de texto, ${imageVectors.length} vetores de imagem`);

    // Processamento de vetores de texto - Usando diretamente a API REST
    let textSuccess = false;
    if (textVectors.length > 0) {
      try {
        logger.info('📤 Enviando vetores de texto para o Pinecone via API REST...');
        
        // Para depuração - mostra o primeiro vetor de texto
        if (textVectors.length > 0) {
          logger.trace('Exemplo de vetor de texto:', {
            id: textVectors[0].id,
            dimensão: textVectors[0].values.length,
            primeirosValores: textVectors[0].values.slice(0, 5)
          });
        }
        
        // Usa diretamente a API REST para texto
        const textResponse = await axios.post(
          TEXT_ENDPOINT,
          { vectors: textVectors, namespace: '' },
          { 
            headers: { 
              'Api-Key': process.env.PINECONE_API_KEY, 
              'Content-Type': 'application/json' 
            } 
          }
        );
        
        logger.info(`✅ ${textVectors.length} vetores de TEXTO inseridos via API REST. Resposta:`, textResponse.data);
        textSuccess = true;
      } catch (restError) {
        logger.error('❌ Erro na API REST para texto:', restError.message);
        if (restError.response) {
          logger.error('Status:', restError.response.status);
          logger.error('Detalhes:', JSON.stringify(restError.response.data).substring(0, 500));
        }
      }
    }

    // Processamento de vetores de imagem - Usando diretamente a API REST
    let imageSuccess = false;
    if (imageVectors.length > 0) {
      try {
        logger.info('📤 Enviando vetores de imagem para o Pinecone via API REST...');
        
        // Log do primeiro vetor para debug
        if (imageVectors.length > 0) {
          logger.trace('Exemplo de vetor de imagem:', {
            id: imageVectors[0].id,
            dimensão: imageVectors[0].values.length,
            primeirosValores: imageVectors[0].values.slice(0, 5)
          });
        }
        
        // Usa diretamente a API REST para imagem
        const imageResponse = await axios.post(
          IMAGE_ENDPOINT,
          { vectors: imageVectors, namespace: '' },
          { 
            headers: { 
              'Api-Key': process.env.PINECONE_API_KEY, 
              'Content-Type': 'application/json' 
            } 
          }
        );
        
        logger.info(`✅ ${imageVectors.length} vetores de IMAGEM inseridos via API REST. Resposta:`, imageResponse.data);
        imageSuccess = true;
      } catch (restError) {
        logger.error('❌ Erro na API REST para imagem:', restError.message);
        if (restError.response) {
          logger.error('Status:', restError.response.status);
          logger.error('Detalhes:', JSON.stringify(restError.response.data).substring(0, 500));
        }
      }
    }

    // Atualiza os itens processados no banco de dados
    // Mapeando IDs originais para atualização correta
    const successfulItemIds = [];
    if (textSuccess) {
      const textOriginalIds = validVectors
        .filter(v => v.targetIndex === 'text')
        .map(v => v.originalId);
      successfulItemIds.push(...textOriginalIds);
    }
    
    if (imageSuccess) {
      const imageOriginalIds = validVectors
        .filter(v => v.targetIndex === 'image')
        .map(v => v.originalId);
      successfulItemIds.push(...imageOriginalIds);
    }

    logger.info(`🔄 Atualizando status de ${successfulItemIds.length} itens no banco de dados...`);
    
    for (const itemId of successfulItemIds) {
      try {
        // Usa o ID original diretamente, sem conversão
        await prisma.queueTraining.update({
          where: { id: itemId },
          data: { status: true }
        });
        logger.info(`✅ Item ${itemId} atualizado com sucesso.`);
      } catch (updateError) {
        logger.error(`❌ Erro ao atualizar item ${itemId}:`, updateError.message);
        // Tenta verificar o esquema do modelo para debug
        try {
          const dmmf = prisma._baseDmmf.modelMap.QueueTraining;
          logger.info(`ℹ️ Tipo esperado para o campo id:`, 
                     dmmf.fields.find(f => f.name === 'id')?.type);
        } catch (e) {
          // Ignora erro ao tentar obter metadados
        }
      }
    }
    
    logger.info('✅ Processamento concluído.');
  } catch (error) {
    logger.error('❌ Erro ao processar QueueTraining:', error.message);
    logger.error('Stack trace:', error.stack);
  }
}

// Configura o cronjob para executar a cada 6 horas
cron.schedule('0 */6 * * *', processQueueTraining);
logger.info('⏰ Cronjob iniciado: Executando a cada 6 horas...');