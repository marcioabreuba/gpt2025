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
                results: [{
                    toolCallId: toolCall.id,
                    result: JSON.stringify({
                        success: true,
                        pedidos
                    })
                }]
            };
        } catch (error) {
            console.error('Erro ao processar pedido:', error);
            return {
                results: [{
                    toolCallId: toolCall.id,
                    result: JSON.stringify({
                        success: false,
                        error: error.message
                    })
                }]
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
                precoFormatado: `R$ ${produto.metadata.price}`,
                url: produto.metadata.url
            }));

            const resposta = {
                success: true,
                produto: Produto,
                produtosEncontrados: produtosFormatados
            };

            console.log('=== RESPOSTA QUE A VAPI RECEBERÁ ===');
            console.log(JSON.stringify({
                results: [{
                    toolCallId: toolCall.id,
                    result: JSON.stringify(resposta)
                }]
            }, null, 2));
            console.log('=====================================');
            
            return {
                results: [{
                    toolCallId: toolCall.id,
                    result: JSON.stringify(resposta)
                }]
            };
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            const erro = {
                success: false,
                error: error.message
            };
            console.log('=== ERRO QUE A VAPI RECEBERÁ ===');
            console.log(JSON.stringify({
                results: [{
                    toolCallId: toolCall.id,
                    result: JSON.stringify(erro)
                }]
            }, null, 2));
            console.log('=====================================');
            return {
                results: [{
                    toolCallId: toolCall.id,
                    result: JSON.stringify(erro)
                }]
            };
        }
    }
}

export default new VapiService();
