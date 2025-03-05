import { Pinecone } from '@pinecone-database/pinecone';
import config from '../config.js';

// Inicializa o cliente Pinecone para vetores de texto e imagem
const pc = new Pinecone({ apiKey: config.pinecone.apiKey });

async function pineconeSearch(type, query) {
  try {
    // Determina qual índice usar com base no tipo
    const index = type === 'text' ? await pc.index(config.pinecone.index) : await pc.index('image');
    
    // Parâmetros de busca - removido o filtro de score
    const searchParams = {
      vector: query, 
      topK: 5, 
      includeMetadata: true
    };
    
    // Executa a busca no índice apropriado
    const results = await index.query(searchParams);
    
    // Filtragem opcional dos resultados após a recuperação
    const filteredResults = results.matches
      .filter(match => match.score > 0.5)
      .map(match => ( 
        match.metadata
      ));
    
    return filteredResults;
  } catch (error) {
    console.error('Erro na busca Pinecone:', error);
    throw new Error(`Falha na busca do Pinecone: ${error.message}`);
  }
}

export default pineconeSearch;