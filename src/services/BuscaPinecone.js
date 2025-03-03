import { Pinecone } from '@pinecone-database/pinecone';

// Inicializa o cliente Pinecone para lidar com vetores de texto e imagem
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    controllerHostUrl: "https://controller.us-west1-gcp.pinecone.io"
});

// Função assíncrona para buscar no Pinecone que indica se é texto ou imagem 
async function pineconeSearch(type, query) { 
  try { 
    // Determina qual índice usar com base no tipo
    const index = type === 'text' ? 
      pc.index('tropicalize-products-rzi4pqr') : 
      pc.index('image-rzi4pqr');
    
    // Configuração dos parâmetros da busca
    const searchParams = {
      vector: query,
      topK: 5,
      includeMetadata: true
    };
    
    // Executa a busca no índice apropriado
    const results = await index.query(searchParams);
    
    // Retorna os resultados da busca
    return results.matches;
  } catch (error) {
    console.error('Erro na busca Pinecone:', error);
    throw new Error(`Falha na busca do Pinecone: ${error.message}`);
  } 
}

export default pineconeSearch;