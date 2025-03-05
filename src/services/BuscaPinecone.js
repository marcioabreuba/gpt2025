import { Pinecone } from '@pinecone-database/pinecone';
import config from '../config.js';

// Inicializa o cliente Pinecone para lidar com vetores de texto e imagem
const pc = new Pinecone({
    apiKey: config.pinecone.apiKey
});

// Função assíncrona para buscar no Pinecone que indica se é texto ou imagem 
async function pineconeSearch(type, query) { 
  try { 
    // Determina qual índice usar com base no tipo
    const index = type === 'text' ? 
      await pc.index(config.pinecone.index) : 
      await pc.index('image');
    
    // Configuração dos parâmetros da busca e aplicação do filtro de similaridade por score do pinecone para acima de 0.5
    const searchParams = {
      vector: query,
      topK: 5,
      includeMetadata: true,
      filter: {
        score: {
          gt: 0.5
        }
      }
    };  
    
    // Executa a busca no índice apropriado
    const results = await index.query(searchParams);
    
    // Retorna os resultados da busca
    return results.matches.map(match => ({
      metadata: match.metadata
    }));
  } catch (error) {
    console.error('Erro na busca Pinecone:', error);
    throw new Error(`Falha na busca do Pinecone: ${error.message}`);
  } 
}

export default pineconeSearch;