import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

class CarrinhoAbandonadoService {
  constructor() {
    this.apiUrl = 'https://api.dooki.com.br/v2';
    this.alias = process.env.YAMPI_ALIAS?.trim();
    this.token = process.env.YAMPI_TOKEN?.trim();
    this.secretKey = process.env.YAMPI_SECRET_KEY?.trim();

    // Validação das credenciais
    if (!this.alias || !this.token || !this.secretKey) {
      logger.error('Credenciais da Yampi não configuradas:', {
        alias: !!this.alias,
        token: !!this.token,
        secretKey: !!this.secretKey
      });
      throw new Error('Credenciais da Yampi não configuradas corretamente no arquivo .env');
    }

    // Configuração global do axios para a API da Yampi
    this.axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'User-Token': this.token,
        'User-Secret-Key': this.secretKey
      }
    };
  }

  async verificarAutenticacao() {
    try {
      logger.info('Verificando credenciais da Yampi', {
        alias: this.alias,
        apiUrl: this.apiUrl,
        hasToken: !!this.token,
        hasSecretKey: !!this.secretKey
      });

      // Fazendo uma requisição simples para verificar a autenticação
      const response = await axios.get(
        `${this.apiUrl}/${this.alias}/catalog/categories`,
        this.axiosConfig
      );

      logger.info('Autenticação Yampi bem-sucedida', {
        status: response.status,
        message: 'Credenciais válidas',
        alias: this.alias
      });

      return {
        success: true,
        message: 'Autenticação bem-sucedida',
        data: {
          status: response.status,
          alias: this.alias,
          hasValidToken: true
        }
      };
    } catch (error) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message;

      // Log detalhado do erro para debug
      logger.error('Erro na verificação de autenticação Yampi:', {
        error: errorMessage,
        status: statusCode,
        alias: this.alias,
        requestHeaders: this.axiosConfig.headers,
        responseData: error.response?.data
      });

      let sugestao = 'Verifique seus tokens da Yampi no painel administrativo e atualize seu arquivo .env';

      if (statusCode === 401) {
        sugestao = 'Token ou chave secreta inválidos. Por favor:\n' +
                  '1. Acesse o painel da Yampi\n' +
                  '2. Vá em Configurações > Integrações > API\n' +
                  '3. Copie o User-Token e o User-Secret-Key\n' +
                  '4. Atualize o arquivo .env com:\n' +
                  '   YAMPI_TOKEN=seu_user_token\n' +
                  '   YAMPI_SECRET_KEY=seu_user_secret_key';
      } else if (statusCode === 404) {
        sugestao = `Alias '${this.alias}' não encontrado. Verifique se YAMPI_ALIAS está correto no arquivo .env`;
      }

      return {
        success: false,
        error: errorMessage,
        details: error.response?.data,
        suggestao: sugestao,
        credenciais: {
          alias: this.alias,
          hasToken: !!this.token,
          hasSecretKey: !!this.secretKey,
          headers: this.axiosConfig.headers
        }
      };
    }
  }

  async buscarCarrinhosAbandonados() {
    try {
      logger.info('Iniciando busca de carrinhos abandonados', {
        url: `${this.apiUrl}/${this.alias}/checkout/carts`,
        alias: this.alias
      });

      // Configuração atualizada conforme documentação da Yampi
      const config = {
        ...this.axiosConfig,
        params: {
          limit: 100,
          include: 'customer,items.sku,totalizers',
          skipCache: true,
          status: 'waiting_payment', // Buscando carrinhos com pagamento pendente
          sort: '-created_at' // Ordenando por data de criação decrescente
        }
      };

      // Log da configuração para debug
      logger.info('Configuração da requisição:', {
        url: `${this.apiUrl}/${this.alias}/checkout/carts`,
        headers: this.axiosConfig.headers,
        params: config.params
      });

      const response = await axios.get(
        `${this.apiUrl}/${this.alias}/checkout/carts`,
        config
      );

      // Log da resposta raw para debug
      logger.info('Resposta da API:', {
        status: response.status,
        hasData: !!response.data,
        totalCarrinhos: response.data?.data?.length,
        primeiroCarrinho: response.data?.data?.[0] ? {
          id: response.data.data[0].id,
          hasCustomer: !!response.data.data[0].customer?.data,
          customerData: response.data.data[0].customer?.data
        } : null
      });

      const carrinhos = response.data.data;
      
      // Log detalhado dos carrinhos encontrados
      logger.info(`Encontrados ${carrinhos?.length || 0} carrinhos abandonados`, {
        carrinhos: carrinhos?.map(c => ({
          id: c.id,
          valor: c.totalizers?.total,
          itens: c.items?.data?.length,
          origem: c.utm_source || 'Não identificada',
          campanha: c.utm_campaign,
          temDadosCliente: !!c.customer?.data,
          dadosCliente: c.customer?.data ? {
            nome: c.customer.data.name,
            email: c.customer.data.email,
            telefone: c.customer.data.phone
          } : null
        }))
      });
      
      let sucessos = 0;
      let falhas = 0;
      
      // Processando carrinhos com try/catch individual
      for (const carrinho of carrinhos || []) {
        try {
          // Log detalhado do carrinho antes do processamento
          logger.info(`Processando carrinho ${carrinho.id}:`, {
            carrinho: {
              id: carrinho.id,
              customer: carrinho.customer?.data,
              items: carrinho.items?.data?.length,
              totalizers: carrinho.totalizers,
              customerRaw: carrinho.customer
            }
          });

          await this.salvarCarrinho(carrinho, "abandonado");
          sucessos++;
        } catch (error) {
          falhas++;
          logger.error(`Falha ao processar carrinho ${carrinho.id}:`, {
            error: error.message,
            carrinho: carrinho.id,
            temCliente: !!carrinho.customer?.data,
            stack: error.stack
          });
          continue;
        }
      }

      // Agora vamos buscar os pedidos não pagos
      logger.info('Iniciando busca de pedidos não pagos', {
        url: `${this.apiUrl}/${this.alias}/orders`,
        alias: this.alias
      });

      const configPedidos = {
        ...this.axiosConfig,
        params: {
          limit: 100,
          include: 'customer,items.sku,totalizers,transactions',
          skipCache: true,
          status: 'pending', // Alterado de financial_status para status
          sort: '-created_at'
        }
      };

      const responsePedidos = await axios.get(
        `${this.apiUrl}/${this.alias}/orders`,
        configPedidos
      );

      const pedidos = responsePedidos.data.data;
      
      logger.info(`Encontrados ${pedidos?.length || 0} pedidos não pagos`, {
        pedidos: pedidos?.map(p => ({
          id: p.id,
          valor: p.value_total || p.totalizers?.total,
          itens: p.items?.data?.length,
          origem: p.utm_source || 'Não identificada',
          campanha: p.utm_campaign,
          temDadosCliente: !!p.customer?.data,
          dadosCliente: p.customer?.data ? {
            nome: p.customer.data.name,
            email: p.customer.data.email,
            telefone: p.customer.data.phone
          } : null,
          status: p.status,
          transactions: p.transactions?.data
        }))
      });

      // Processando pedidos não pagos
      for (const pedido of pedidos || []) {
        try {
          // Calculando o valor total do pedido usando os campos corretos da API
          const valorTotal = pedido.value_total || pedido.totalizers?.total || pedido.items?.data?.reduce((acc, item) => acc + (item.price * item.quantity), 0) || 0;
          const valorSubtotal = pedido.value_products || pedido.totalizers?.subtotal || valorTotal;
          const valorFrete = pedido.value_shipment || pedido.totalizers?.shipment || 0;
          const valorDesconto = pedido.value_discount || pedido.totalizers?.discount || 0;
          const quantidadeItens = pedido.items_count || pedido.totalizers?.total_items || pedido.items?.data?.length || 0;

          // Adicionando os valores ao pedido antes de salvar
          pedido.totalizers = {
            total: valorTotal,
            subtotal: valorSubtotal,
            shipment: valorFrete,
            discount: valorDesconto,
            total_items: quantidadeItens
          };

          // Log dos valores antes de salvar
          logger.info(`Valores do pedido ${pedido.id}:`, {
            valorTotal,
            valorSubtotal,
            valorFrete,
            valorDesconto,
            quantidadeItens,
            rawData: {
              value_total: pedido.value_total,
              value_products: pedido.value_products,
              value_shipment: pedido.value_shipment,
              value_discount: pedido.value_discount,
              items_count: pedido.items_count,
              totalizers: pedido.totalizers,
              items: pedido.items?.data,
              transactions: pedido.transactions?.data
            }
          });

          await this.salvarCarrinho(pedido, "nao_pago");
          sucessos++;
        } catch (error) {
          falhas++;
          logger.error(`Falha ao processar pedido ${pedido.id}:`, {
            error: error.message,
            pedido: pedido.id,
            temCliente: !!pedido.customer?.data,
            stack: error.stack,
            dadosPedido: {
              value_total: pedido.value_total,
              value_products: pedido.value_products,
              value_shipment: pedido.value_shipment,
              value_discount: pedido.value_discount,
              items_count: pedido.items_count,
              totalizers: pedido.totalizers,
              items: pedido.items?.data,
              transactions: pedido.transactions?.data
            }
          });
          continue;
        }
      }

      return { 
        success: true, 
        message: `Processamento concluído: ${sucessos} registros salvos com sucesso, ${falhas} falhas.`,
        data: {
          total: (carrinhos?.length || 0) + (pedidos?.length || 0),
          sucessos,
          falhas,
          carrinhos: carrinhos?.map(c => ({
            id: c.id,
            valor: c.totalizers?.total,
            itens: c.items?.data?.length,
            origem: c.utm_source || 'Não identificada',
            campanha: c.utm_campaign,
            cliente: c.customer?.data ? {
              nome: c.customer.data.name,
              email: c.customer.data.email,
              telefone: c.customer.data.phone
            } : null
          })),
          pedidos: pedidos?.map(p => ({
            id: p.id,
            valor: p.totalizers?.total,
            itens: p.items?.data?.length,
            origem: p.utm_source || 'Não identificada',
            campanha: p.utm_campaign,
            cliente: p.customer?.data ? {
              nome: p.customer.data.name,
              email: p.customer.data.email,
              telefone: p.customer.data.phone
            } : null
          }))
        }
      };
    } catch (error) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message;

      logger.error('Erro ao buscar carrinhos e pedidos:', {
        error: errorMessage,
        status: statusCode,
        response: error.response?.data,
        requestHeaders: this.axiosConfig.headers,
        url: `${this.apiUrl}/${this.alias}/checkout/carts`
      });
      
      return { 
        success: false, 
        error: errorMessage,
        details: error.response?.data,
        suggestao: 'Houve um erro ao buscar os carrinhos e pedidos. Por favor, verifique as permissões da API no painel da Yampi.'
      };
    }
  }

  async salvarCarrinho(dados, tipo) {
    try {
      // Log inicial dos dados recebidos
      logger.info(`Iniciando salvamento do ${tipo === 'abandonado' ? 'carrinho' : 'pedido'} ${dados.id}:`, {
        tipo,
        id: dados.id,
        temCustomer: !!dados.customer?.data,
        temItems: !!dados.items?.data,
        temTotalizers: !!dados.totalizers
      });

      // Verifica se o carrinho/pedido já existe
      const registroExistente = await prisma.carrinhosAbandonados.findUnique({
        where: { cartId: dados.id.toString() }
      });

      // Processando produtos para incluir mais informações
      const produtos = dados.items?.data?.map(item => ({
        id: item.id,
        sku: item.sku_id,
        produto_id: item.product_id,
        titulo: item.sku?.data?.title || item.title,
        quantidade: item.quantity,
        preco: item.price,
        preco_desconto: item.sku?.data?.price_discount,
        variacao: item.sku?.data?.variations?.[0]?.value,
        url_compra: item.sku?.data?.purchase_url
      })) || [];

      // Extraindo dados do cliente com validação
      const customer = dados.customer?.data || {};
      const telefone = customer.phone?.formated_number || null;

      // Calculando data de expiração (24 horas a partir da criação)
      let dataCriacao;
      try {
        dataCriacao = dados.created_at ? new Date(dados.created_at) : new Date();
        if (isNaN(dataCriacao.getTime())) {
          dataCriacao = new Date();
        }
      } catch (error) {
        logger.warn(`Data de criação inválida para ${tipo === 'abandonado' ? 'carrinho' : 'pedido'} ${dados.id}, usando data atual`, {
          created_at: dados.created_at,
          error: error.message
        });
        dataCriacao = new Date();
      }

      const dataExpiracao = new Date(dataCriacao.getTime() + 24 * 60 * 60 * 1000);

      // Processando valores com validação
      const valorTotal = parseFloat(dados.totalizers?.total || 0);
      const valorSubtotal = parseFloat(dados.totalizers?.subtotal || 0);
      const valorFrete = parseFloat(dados.totalizers?.shipment || 0);
      const valorDesconto = parseFloat(dados.totalizers?.discount || 0);
      const quantidadeItens = parseInt(dados.totalizers?.total_items || 0);

      const dadosRegistro = {
        cartId: dados.id.toString(),
        token: dados.cart_token || dados.token || null,
        clienteEmail: customer.email || null,
        clienteNome: customer.name || null,
        clienteTelefone: telefone,
        valorTotal: valorTotal,
        valorSubtotal: valorSubtotal,
        valorFrete: valorFrete,
        valorDesconto: valorDesconto,
        quantidadeItens: quantidadeItens,
        produtos: produtos,
        utm_source: dados.utm_source || null,
        utm_medium: dados.utm_medium || null,
        utm_campaign: dados.utm_campaign || null,
        tipoCarrinho: tipo,
        status: "pendente",
        dataExpiracao: dataExpiracao,
        ultimaAtividade: new Date()
      };

      // Log dos dados processados antes de salvar
      logger.info(`Dados processados do ${tipo === 'abandonado' ? 'carrinho' : 'pedido'} ${dados.id}:`, {
        valorTotal,
        valorSubtotal,
        valorFrete,
        valorDesconto,
        quantidadeItens,
        dataCriacao: dataCriacao.toISOString(),
        dataExpiracao: dataExpiracao.toISOString(),
        token: dadosRegistro.token,
        cliente: {
          email: dadosRegistro.clienteEmail,
          nome: dadosRegistro.clienteNome,
          telefone: dadosRegistro.clienteTelefone
        },
        produtos: produtos.map(p => ({
          id: p.id,
          titulo: p.titulo,
          quantidade: p.quantidade,
          preco: p.preco
        }))
      });

      let resultado;
      if (registroExistente) {
        // Atualiza o registro existente
        resultado = await prisma.carrinhosAbandonados.update({
          where: { cartId: dados.id.toString() },
          data: dadosRegistro
        });
      } else {
        // Cria um novo registro
        resultado = await prisma.carrinhosAbandonados.create({
          data: dadosRegistro
        });
      }

      logger.info(`${tipo === 'abandonado' ? 'Carrinho' : 'Pedido'} ${dados.id} salvo com sucesso`, {
        valor: resultado.valorTotal,
        itens: resultado.quantidadeItens,
        origem: resultado.utm_source,
        campanha: resultado.utm_campaign,
        cliente: {
          nome: resultado.clienteNome,
          email: resultado.clienteEmail,
          telefone: resultado.clienteTelefone
        }
      });

      return resultado;
    } catch (error) {
      logger.error(`Erro ao processar ${tipo === 'abandonado' ? 'carrinho' : 'pedido'} ${dados.id}:`, {
        error: error.message,
        stack: error.stack,
        registro: dados.id,
        dados: {
          totalizers: dados.totalizers,
          items: dados.items?.data?.length,
          customer: !!dados.customer?.data,
          rawData: dados
        }
      });
      throw error;
    }
  }
}

export default new CarrinhoAbandonadoService(); 