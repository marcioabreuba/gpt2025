import { Pinecone } from '@pinecone-database/pinecone';
import config from '../config.js';

// Inicializa o cliente Pinecone para vetores de texto e imagem
const pc = new Pinecone({ apiKey: config.pinecone.apiKey });

// Usa config.pinecone.index para texto e 'image' para imagens
// Isto pode ser modificado para usar uma variável de ambiente específica no futuro
const TEXT_INDEX = config.pinecone.index;
const IMAGE_INDEX = 'image';

async function pineconeSearch(type, query) {
  try {
    // Determina qual índice usar com base no tipo
    const index = type === 'text' ? await pc.index(TEXT_INDEX) : await pc.index(IMAGE_INDEX);
    
    // Parâmetros de busca - removido o filtro de score
    const searchParams = {
      vector: query, 
      topK: 5, 
      includeMetadata: true
    };
    
    // Executa a busca no índice apropriado
    const results = await index.query(searchParams);
    
    // Verifica se há algum resultado com score acima de 0.9
    const highScoreResults = results.matches.filter(match => match.score > 0.9);
    
    let filteredResults;
    
    if (highScoreResults.length > 0) {
      // Se houver resultados com score acima de 0.9, retorna apenas o de maior score
      const highestScoreMatch = highScoreResults.reduce((highest, current) => 
        current.score > highest.score ? current : highest, highScoreResults[0]);
      
      filteredResults = [highestScoreMatch.metadata];
    } else {
      // Caso contrário, mantém o comportamento original (scores > 0.5)
      filteredResults = results.matches
        .filter(match => match.score > 0.5)
        .map(match => match.metadata);
    }
    
    return filteredResults;
  } catch (error) {
    console.error('Erro na busca Pinecone:', error);
    throw new Error(`Falha na busca do Pinecone: ${error.message}`);
  }
}

export default pineconeSearch;