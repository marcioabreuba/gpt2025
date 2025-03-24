import { Pinecone } from '@pinecone-database/pinecone';
import config from '../../config.js';
import embeddingText from '../embeddingText.js';
import { buscarProdutoPorId } from '../shopifyService.js';

class PineconeService {
    constructor() {
        this.pc = new Pinecone({ apiKey: config.pinecone.apiKey });
        this.indexName = config.pinecone.index;
    }

    async initialize() {
        try {
            this.index = await this.pc.index(this.indexName);
        } catch (error) {
            console.error('Erro ao inicializar Pinecone:', error);
            throw error;
        }
    }

    async buscarProdutosSimilares(nomeProduto) {
        try {
            if (!this.index) {
                await this.initialize();
            }

            const embedding = await embeddingText(nomeProduto);
            const searchParams = {
                vector: embedding,
                topK: 5,
                includeMetadata: true
            };

            const results = await this.index.query(searchParams);
            
            const produtosFiltrados = results.matches
                .filter(match => match.score > 0.5)
                .map(match => ({
                    score: match.score,
                    metadata: match.metadata
                }));

            console.log(`Encontrados ${produtosFiltrados.length} produtos similares para: ${nomeProduto}`);
            
            const produtosComDetalhes = await Promise.all(
                produtosFiltrados.map(async (produto) => {
                    if (produto.metadata.productId) {
                        const detalhes = await buscarProdutoPorId(produto.metadata.productId);
                        if (detalhes) {
                            return {
                                ...produto,
                                metadata: {
                                    ...produto.metadata,
                                    price: detalhes.price,
                                    available: true,
                                    url: detalhes.public_url
                                }
                            };
                        }
                    }
                    return produto;
                })
            );
            
            return produtosComDetalhes;
        } catch (error) {
            console.error('Erro ao buscar produtos similares:', error);
            throw error;
        }
    }
}

export default new PineconeService(); 