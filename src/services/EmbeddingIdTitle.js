import Redis from 'ioredis';
import config from '../config.js';
import OpenAI from 'openai';

// Inicializa o Redis com a URL definida no config.js
const redis = new Redis(config.redis.url);

// Configuração da OpenAI
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Enfileira os produtos na fila "produtosQueue".
 * Cada item contém apenas { id, title }.
 *
 * @param {Array} produtos - Array de produtos.
 */
export const enqueueProdutos = async (produtos) => {
  // Se 'produtos' não for um array, converte-o utilizando Object.values
  const produtosArray = Array.isArray(produtos) ? produtos : Object.values(produtos);

  for (const produto of produtosArray) {
    const { id, title } = produto;
    // Armazena o produto como string JSON na fila
    await redis.rpush('produtosQueue', JSON.stringify({ id, title }));
  }
  console.log(`${produtosArray.length} produtos enfileirados.`);
};

/**
 * Processa a fila: retira o produto da fila, gera o embedding
 * e realiza o tratamento desejado.
 * 
 * Caso haja erro, re-adiciona o item na fila para nova tentativa.
 */
export const processQueue = async () => {
  while (true) {
    // Retira o primeiro item da fila (lista "produtosQueue")
    const produtoJSON = await redis.lpop('produtosQueue');
    if (!produtoJSON) {
      console.log('Fila vazia. Aguardando itens...');
      // Aguarda 5 segundos antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    const produto = JSON.parse(produtoJSON);
    try {
      // Gera o embedding utilizando apenas o título do produto.
      // O modelo 'text-embedding-ada-002' retorna um vetor de 1536 dimensões.
      const response = await openai.createEmbedding({
        model: 'text-embedding-ada-002',
        input: produto.title,
      });
      const embedding = response.data.data[0].embedding;
      console.log(`Embedding gerado para o produto ${produto.id}`);

      // Aqui você pode armazenar o embedding no banco ou realizar outra ação desejada.
      // Exemplo:
      // await salvarEmbeddingNoBanco(produto.id, embedding);

    } catch (error) {
      console.error(`Erro ao gerar embedding para o produto ${produto.id}:`, error);
      // Re-adiciona o item na fila para tentar novamente futuramente
      await redis.rpush('produtosQueue', produtoJSON);
    }
  }
};
