// Cria e exporta o cliente Redis, utilizando as configurações definidas
import redis from 'redis';
import config from './config.js';

const redisClient = redis.createClient({
  url: config.redis.url
});

// Loga erros do Redis
redisClient.on('error', err => console.error('Redis error:', err));

// Conecta ao Redis e exporta o cliente para uso nos demais módulos
await redisClient.connect();

export default redisClient;
