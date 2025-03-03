import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { Pinecone } from '@pinecone-database/pinecone';

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
    console.log('🚀 Executando cronjob para processar QueueTraining...');

    // Busca um item pendente na fila de treinamento no banco de dados
    const items = await prisma.queueTraining.findMany({
      where: { status: false }, // Somente itens não processados
      take: 5, // Processa 5 item por vez
    });

    if (items.length === 0) {
      console.log('✅ Nenhum item pendente para processar.');
      return;
    }

    console.log(`🔄 Processando ${items.length} itens...`);

    // Geração dos vetores para cada item na fila
    const vectors = await Promise.all(
      items.map(async (item) => {
        try {
          let embedding = null;
          let targetIndex = null;
          let dimension = null;

          // Se o item for do tipo texto, gera embeddings via OpenAI
          if (item.type === 'text') {
            console.log(`📝 Processando texto para o item ${item.id}: ${item.content.substring(0, 50)}...`);
            
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
            console.log(`🔍 Resposta da OpenAI para o item ${item.id}:`, 
                       JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
            
            embedding = response.data.data[0]?.embedding || null;
            targetIndex = 'text';
            dimension = 1536;
          } 
          // Se o item for imagem, gera embeddings via Jina AI
          else if (item.type === 'image') {
            console.log(`🖼️ Processando imagem para o item ${item.id}: ${item.content.substring(0, 50)}...`);
            
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
            console.log(`🔍 Resposta da Jina AI para o item ${item.id}:`, 
                       JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
            
            // A estrutura da resposta Jina é data -> array de objetos -> embedding
            embedding = response.data.data[0]?.embedding;
            
            if (!embedding) {
              console.error(`❌ Estrutura de resposta inesperada da Jina AI para o item ${item.id}`);
              console.error('Resposta:', response.data);
              return null;
            }
            
            targetIndex = 'image';
            dimension = 1024;  // Dimensão para os modelos CLIP da Jina
          }

          // Validação dos embeddings gerados
          if (!embedding || !Array.isArray(embedding)) {
            console.error(`❌ Erro: Embedding inválido para o item ${item.id}`);
            return null;
          }

          if (embedding.length !== dimension) {
            console.error(`❌ Erro: Dimensão incorreta para o item ${item.id} (${embedding.length} vs ${dimension})`);
            return null;
          }

          console.log(`✅ Embedding gerado com sucesso para o item ${item.id} (${embedding.length} dimensões)`);
          
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
          console.error(`❌ Erro ao processar item ${item.id}:`, error.message);
          if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados:', JSON.stringify(error.response.data).substring(0, 500));
          }
          console.error('Stack trace:', error.stack);
          return null;
        }
      })
    );

    // Filtra os vetores válidos
    const validVectors = vectors.filter(v => v !== null);
    console.log(`🔢 Total de vetores válidos: ${validVectors.length} de ${items.length}`);

    // Separa os vetores em categorias de texto e imagem
    const textVectors = validVectors.filter(v => v.targetIndex === 'text').map(({ id, values, metadata }) => ({ id, values, metadata }));
    const imageVectors = validVectors.filter(v => v.targetIndex === 'image').map(({ id, values, metadata }) => ({ id, values, metadata }));

    console.log(`📊 Distribuição: ${textVectors.length} vetores de texto, ${imageVectors.length} vetores de imagem`);

    // Processamento de vetores de texto - Usando diretamente a API REST
    let textSuccess = false;
    if (textVectors.length > 0) {
      try {
        console.log('📤 Enviando vetores de texto para o Pinecone via API REST...');
        
        // Para depuração - mostra o primeiro vetor de texto
        if (textVectors.length > 0) {
          console.log('Exemplo de vetor de texto:', {
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
        
        console.log(`✅ ${textVectors.length} vetores de TEXTO inseridos via API REST. Resposta:`, textResponse.data);
        textSuccess = true;
      } catch (restError) {
        console.error('❌ Erro na API REST para texto:', restError.message);
        if (restError.response) {
          console.error('Status:', restError.response.status);
          console.error('Detalhes:', JSON.stringify(restError.response.data).substring(0, 500));
        }
      }
    }

    // Processamento de vetores de imagem - Usando diretamente a API REST
    let imageSuccess = false;
    if (imageVectors.length > 0) {
      try {
        console.log('📤 Enviando vetores de imagem para o Pinecone via API REST...');
        
        // Log do primeiro vetor para debug
        if (imageVectors.length > 0) {
          console.log('Exemplo de vetor de imagem:', {
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
        
        console.log(`✅ ${imageVectors.length} vetores de IMAGEM inseridos via API REST. Resposta:`, imageResponse.data);
        imageSuccess = true;
      } catch (restError) {
        console.error('❌ Erro na API REST para imagem:', restError.message);
        if (restError.response) {
          console.error('Status:', restError.response.status);
          console.error('Detalhes:', JSON.stringify(restError.response.data).substring(0, 500));
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

    console.log(`🔄 Atualizando status de ${successfulItemIds.length} itens no banco de dados...`);
    
    for (const itemId of successfulItemIds) {
      try {
        // Usa o ID original diretamente, sem conversão
        await prisma.queueTraining.update({
          where: { id: itemId },
          data: { status: true }
        });
        console.log(`✅ Item ${itemId} atualizado com sucesso.`);
      } catch (updateError) {
        console.error(`❌ Erro ao atualizar item ${itemId}:`, updateError.message);
        // Tenta verificar o esquema do modelo para debug
        try {
          const dmmf = prisma._baseDmmf.modelMap.QueueTraining;
          console.log(`ℹ️ Tipo esperado para o campo id:`, 
                     dmmf.fields.find(f => f.name === 'id')?.type);
        } catch (e) {
          // Ignora erro ao tentar obter metadados
        }
      }
    }
    
    console.log('✅ Processamento concluído.');
  } catch (error) {
    console.error('❌ Erro ao processar QueueTraining:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Configura o cronjob para executar a cada 5 minutos
cron.schedule('*/3 * * * *', processQueueTraining);
console.log('⏰ Cronjob iniciado: Executando a cada 3 minutos...');