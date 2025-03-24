import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

class CarrinhoNaoPagoService {
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

  async buscarCarrinhosNaoPagos() {
    try {
      logger.info('Iniciando busca de carrinhos não pagos', {
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
      logger.info(`Encontrados ${carrinhos?.length || 0} carrinhos não pagos`, {
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
              customerRaw: carrinho.customer // Log do objeto customer completo para debug
            }
          });

          await this.salvarCarrinho(carrinho);
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

      return { 
        success: true, 
        message: `Processamento concluído: ${sucessos} carrinhos salvos com sucesso, ${falhas} falhas.`,
        data: {
          total: carrinhos?.length || 0,
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
          }))
        }
      };
    } catch (error) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message;

      logger.error('Erro ao buscar carrinhos não pagos:', {
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
        suggestao: 'Houve um erro ao buscar os carrinhos. Por favor, verifique as permissões da API no painel da Yampi.'
      };
    }
  }

  async salvarCarrinho(carrinhoData) {
    try {
      // Verifica se o carrinho já existe
      const carrinhoExistente = await prisma.carrinhosAbandonados.findUnique({
        where: { cartId: carrinhoData.id.toString() }
      });

      // Processando produtos para incluir mais informações
      const produtos = carrinhoData.items?.data?.map(item => ({
        id: item.id,
        sku: item.sku_id,
        produto_id: item.product_id,
        titulo: item.sku?.data?.title,
        quantidade: item.quantity,
        preco: item.price,
        preco_desconto: item.sku?.data?.price_discount,
        variacao: item.sku?.data?.variations?.[0]?.value,
        url_compra: item.sku?.data?.purchase_url
      })) || [];

      // Extraindo dados do cliente com validação
      const customer = carrinhoData.customer?.data || {};
      const telefone = customer.phone?.formated_number || null;

      // Calculando data de expiração (24 horas a partir da criação)
      const dataCriacao = new Date(carrinhoData.created_at);
      const dataExpiracao = new Date(dataCriacao.getTime() + 24 * 60 * 60 * 1000);

      const dadosCarrinho = {
        cartId: carrinhoData.id.toString(),
        token: carrinhoData.token,
        clienteEmail: customer.email || null,
        clienteNome: customer.name || null,
        clienteTelefone: telefone,
        valorTotal: parseFloat(carrinhoData.totalizers?.total || 0),
        valorSubtotal: parseFloat(carrinhoData.totalizers?.subtotal || 0),
        valorFrete: parseFloat(carrinhoData.totalizers?.shipment || 0),
        valorDesconto: parseFloat(carrinhoData.totalizers?.discount || 0),
        quantidadeItens: parseInt(carrinhoData.totalizers?.total_items || 0),
        produtos: produtos,
        utm_source: carrinhoData.utm_source,
        utm_medium: carrinhoData.utm_medium,
        utm_campaign: carrinhoData.utm_campaign,
        tipoCarrinho: "nao_pago",
        status: "pendente",
        dataExpiracao: dataExpiracao,
        ultimaAtividade: new Date()
      };

      if (carrinhoExistente) {
        // Atualiza o carrinho existente
        await prisma.carrinhosAbandonados.update({
          where: { cartId: carrinhoData.id.toString() },
          data: dadosCarrinho
        });

        logger.info(`Carrinho ${carrinhoData.id} atualizado com sucesso`, {
          valor: dadosCarrinho.valorTotal,
          itens: dadosCarrinho.quantidadeItens,
          origem: dadosCarrinho.utm_source,
          campanha: dadosCarrinho.utm_campaign,
          cliente: {
            nome: dadosCarrinho.clienteNome,
            email: dadosCarrinho.clienteEmail,
            telefone: dadosCarrinho.clienteTelefone
          }
        });
      } else {
        // Cria um novo registro
        await prisma.carrinhosAbandonados.create({
          data: dadosCarrinho
        });

        logger.info(`Novo carrinho ${carrinhoData.id} criado com sucesso`, {
          valor: dadosCarrinho.valorTotal,
          itens: dadosCarrinho.quantidadeItens,
          origem: dadosCarrinho.utm_source,
          campanha: dadosCarrinho.utm_campaign,
          cliente: {
            nome: dadosCarrinho.clienteNome,
            email: dadosCarrinho.clienteEmail,
            telefone: dadosCarrinho.clienteTelefone
          }
        });
      }

      return dadosCarrinho;
    } catch (error) {
      logger.error(`Erro ao salvar carrinho ${carrinhoData.id}:`, {
        error: error.message,
        carrinho: carrinhoData.id,
        stack: error.stack
      });
      throw error;
    }
  }

  async atualizarStatusCarrinho(cartId, novoStatus) {
    try {
      const carrinho = await prisma.carrinhosAbandonados.update({
        where: { cartId: cartId.toString() },
        data: {
          status: novoStatus,
          ultimaAtividade: new Date()
        }
      });

      logger.info(`Status do carrinho ${cartId} atualizado para ${novoStatus}`);
      return carrinho;
    } catch (error) {
      logger.error(`Erro ao atualizar status do carrinho ${cartId}:`, {
        error: error.message,
        novoStatus,
        stack: error.stack
      });
      throw error;
    }
  }
}

export default new CarrinhoNaoPagoService(); 