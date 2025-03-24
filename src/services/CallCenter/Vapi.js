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
            // Validação básica da requisição
            if (!requisicao || typeof requisicao !== 'object') {
                throw new Error('Requisição inválida: deve ser um objeto');
            }

            // Log do início do processamento
            console.log('Iniciando busca de produtos no serviço Vapi:', requisicao.message.toolCalls[0].function.arguments);

            // Extrair o nome do produto da requisição
            const { Produto } = requisicao.message.toolCalls[0].function.arguments;

            // Buscar produtos similares no Pinecone
            const produtosSimilares = await PineconeService.buscarProdutosSimilares(Produto);
            
            console.log('Produto processado com sucesso no serviço Vapi');
            
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
            console.log('Resposta formatada para a Vapi:', resposta);
            
            return resposta;
        } catch (error) {
            console.error('Erro na busca de produtos no serviço Vapi:', error);
            throw error;
        }
    }
}

export default VapiService;
