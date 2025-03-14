// Define e exporta um rate limiter para limitar requisições por período
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo de 100 requisições por IP
  message: "Muitas solicitações criadas a partir deste dispositivo, por favor, tente novamente após 15 minutos"
});

export default limiter;
