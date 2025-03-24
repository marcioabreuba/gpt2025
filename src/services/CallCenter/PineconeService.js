import { Pinecone } from '@pinecone-database/pinecone';
import config from '../../config.js';
import embeddingText from '../embeddingText.js';
import logger from '../../utils/logger.js';

class PineconeService {
    constructor() {
        this.pc = new Pinecone({ apiKey: config.pinecone.apiKey });
        this.indexName = config.pinecone.index;
    }

    async initialize() {
        try {
            this.index = await this.pc.index(this.indexName);
            logger.info('Pinecone inicializado com sucesso');
        } catch (error) {
            logger.error('Erro ao inicializar Pinecone:', error);
            throw error;
        }
    }

    async buscarProdutosSimilares(nomeProduto) {
        try {
            if (!this.index) {
                await this.initialize();
            }

            // Gerar embedding do texto
            logger.debug('Gerando embedding para:', nomeProduto);
            const embedding = await embeddingText(nomeProduto);

            // Buscar produtos similares no Pinecone
            const searchParams = {
                vector: embedding,
                topK: 5,
                includeMetadata: true
            };

            const results = await this.index.query(searchParams);
            
            // Filtrar resultados com score acima de 0.5
            const produtosFiltrados = results.matches
                .filter(match => match.score > 0.5)
                .map(match => ({
                    score: match.score,
                    metadata: match.metadata
                }));

            logger.info(`Encontrados ${produtosFiltrados.length} produtos similares para: ${nomeProduto}`);
            
            return produtosFiltrados;
        } catch (error) {
            logger.error('Erro ao buscar produtos similares:', error);
            throw error;
        }
    }
}

export default new PineconeService(); 