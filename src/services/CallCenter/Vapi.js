import PineconeService from './PineconeService.js';

class VapiService {
    static async processarPedido(pedido) {
        try {
            // Validação básica do pedido
            if (!pedido || typeof pedido !== 'object') {
                throw new Error('Pedido inválido: deve ser um objeto');
            }

            // Log do início do processamento
            console.log('Iniciando processamento do pedido no serviço Vapi:', pedido.message.toolCalls[0].function.arguments);

            // Aqui você pode implementar a lógica específica do serviço Vapi
            // Por exemplo:
            // - Validar campos obrigatórios
            // - Processar o pedido
            // - Salvar no banco de dados
            // - Enviar notificações
            
            // Simulação de processamento
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('Pedido processado com sucesso no serviço Vapi');
            return true;
        } catch (error) {
            console.error('Erro no processamento do pedido no serviço Vapi:', error);
            throw error;
        }
    }

    static async processarBuscaProdutos(requisicao) {
        try {
            console.log('=== INÍCIO DO PROCESSAMENTO DE BUSCA DE PRODUTOS ===');
            console.log('Requisição recebida:', JSON.stringify(requisicao, null, 2));

            // Validação básica da requisição
            if (!requisicao || typeof requisicao !== 'object') {
                console.error('Requisição inválida:', requisicao);
                throw new Error('Requisição inválida: deve ser um objeto');
            }

            // Verificar estrutura da requisição
            if (!requisicao.message || !requisicao.message.toolCalls || !requisicao.message.toolCalls[0]) {
                console.error('Estrutura da requisição inválida:', requisicao);
                throw new Error('Estrutura da requisição inválida');
            }

            // Log do início do processamento
            console.log('Iniciando busca de produtos no serviço Vapi');
            console.log('Arguments recebidos:', requisicao.message.toolCalls[0].function.arguments);

            // Extrair o nome do produto da requisição
            const functionArgs = requisicao.message.toolCalls[0].function.arguments;
            console.log('Arguments tipo:', typeof functionArgs);
            
            let Produto;
            if (typeof functionArgs === 'string') {
                Produto = JSON.parse(functionArgs).Produto;
            } else {
                Produto = functionArgs.Produto;
            }
            
            console.log('Produto extraído:', Produto);

            // Buscar produtos similares no Pinecone
            console.log('Iniciando busca no Pinecone para o produto:', Produto);
            const produtosSimilares = await PineconeService.buscarProdutosSimilares(Produto);
            console.log('Resultados do Pinecone:', JSON.stringify(produtosSimilares, null, 2));
            
            // Formatar a resposta para a Vapi
            const resposta = {
                success: true,
                produto: Produto,
                produtosEncontrados: produtosSimilares.map(produto => ({
                    nome: produto.metadata.content,
                    descricao: produto.metadata.content,
                    preco: produto.metadata.price || 'Preço não disponível',
                    disponibilidade: produto.metadata.available ? 'Em estoque' : 'Indisponível',
                    similaridade: produto.score,
                    url: produto.metadata.url || null
                }))
            };

            // Log da resposta formatada
            console.log('Resposta formatada para a Vapi:', JSON.stringify(resposta, null, 2));
            console.log('=== FIM DO PROCESSAMENTO DE BUSCA DE PRODUTOS ===');
            
            return resposta;
        } catch (error) {
            console.error('Erro na busca de produtos no serviço Vapi:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }
}

export default VapiService;
