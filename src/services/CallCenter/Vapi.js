import { buscarPedidos } from './Yampi.js';
import PineconeService from './PineconeService.js';

class VapiService {
    async processarPedido(request) {
        try {
            console.log('Iniciando processamento de pedido');
            const { message } = request;
            const { toolCalls } = message;
            const toolCall = toolCalls[0];
            const { function: functionCall } = toolCall;
            const { arguments: functionArgs } = functionCall;
            const { CPF } = functionArgs;

            // Simular tempo de processamento
            await new Promise(resolve => setTimeout(resolve, 1000));

            const pedidos = await buscarPedidos(CPF);
            return {
                success: true,
                pedidos
            };
        } catch (error) {
            console.error('Erro ao processar pedido:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async processarBuscaProdutos(request) {
        try {
            console.log('Iniciando busca de produtos');
            const { message } = request;
            const { toolCalls } = message;
            const toolCall = toolCalls[0];
            const { function: functionCall } = toolCall;
            const { arguments: functionArgs } = functionCall;
            const { Produto } = functionArgs;

            const produtosSimilares = await PineconeService.buscarProdutosSimilares(Produto);
            
            const produtosFormatados = produtosSimilares.map(produto => ({
                nome: produto.metadata.content,
                descricao: produto.metadata.content,
                preco: produto.metadata.price,
                disponibilidade: produto.metadata.available ? "Em estoque" : "Fora de estoque",
                similaridade: produto.score,
                url: produto.metadata.url
            }));

            const resposta = {
                success: true,
                produto: Produto,
                produtosEncontrados: produtosFormatados
            };

            console.log('Informações do produto enviadas para a Vapi:', JSON.stringify(resposta, null, 2));
            
            return resposta;
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default new VapiService();
