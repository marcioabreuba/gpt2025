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

// Função para adicionar prefixo às chaves Redis
const prefixKey = (key) => `SoleTerra:${key}`;

// Sobrescreve métodos do cliente Redis para adicionar prefixo automaticamente
const originalGet = redisClient.get;
redisClient.get = async function(key) {
  return originalGet.call(this, prefixKey(key));
};

const originalSet = redisClient.set;
redisClient.set = async function(key, value, ...args) {
  return originalSet.call(this, prefixKey(key), value, ...args);
};

const originalDel = redisClient.del;
redisClient.del = async function(key) {
  return originalDel.call(this, prefixKey(key));
};

const originalKeys = redisClient.keys;
redisClient.keys = async function(pattern) {
  return originalKeys.call(this, prefixKey(pattern));
};

const originalRPush = redisClient.rPush;
redisClient.rPush = async function(key, ...values) {
  return originalRPush.call(this, prefixKey(key), ...values);
};

// Adicione outros métodos conforme necessário

export default redisClient;
