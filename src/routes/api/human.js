import express from 'express';
import redisClient from '../../redisClient.js';
import { isInHumanMode, processHandoffCommand, sendHumanMessage } from '../../services/humanHandoffService.js';
import config from '../../config.js';
import logger from '../../utils/logger.js';

const router = express.Router();

/**
 * Middleware para verificar autenticação do operador humano
 */
const authenticateOperator = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== config.adminApiKey) {
    return res.status(401).json({ error: 'Acesso não autorizado' });
  }
  
  next();
};

/**
 * POST /api/human/send
 * Endpoint para o operador humano enviar mensagens para um usuário específico
 */
router.post('/human/send', authenticateOperator, async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios: phone, message' 
      });
    }
    
    // Obtém o userId/chatLid baseado no telefone
    const userIdKey = `userId:${phone}`;
    const userId = await redisClient.get(userIdKey);
    
    if (!userId) {
      return res.status(404).json({ 
        error: 'Usuário não encontrado, verifique se já existe uma conversa' 
      });
    }
    
    // Verifica o ID do thread
    const threadId = await redisClient.get(`threadId:${userId}`);
    
    if (!threadId) {
      return res.status(404).json({ 
        error: 'Thread de conversa não encontrado' 
      });
    }
    
    // Verifica se é um comando de alternância
    if (await processHandoffCommand(message, phone, threadId)) {
      return res.json({ success: true, action: 'handoff_command_processed' });
    }
    
    // Verifica se está no modo humano
    const humanModeActive = await isInHumanMode(phone);
    
    if (!humanModeActive) {
      return res.status(400).json({ 
        error: 'Operador não está no modo de atendimento humano para este usuário',
        tip: 'Envie "Olá aqui é a Helena" para ativar o modo humano primeiro' 
      });
    }
    
    // Envia a mensagem humana
    await sendHumanMessage(userId, phone, message, threadId);
    
    res.json({ success: true, phone, message });
  } catch (error) {
    logger.error('Erro ao enviar mensagem humana via API:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/human/active
 * Retorna a lista de usuários atualmente no modo de atendimento humano
 */
router.get('/human/active', authenticateOperator, async (req, res) => {
  try {
    // Busca todos os keys no Redis que começam com o prefixo de modo humano
    const keys = await redisClient.keys('human_mode:*');
    
    // Extrai apenas o número de telefone do padrão human_mode:{phone}
    const activePhones = keys.map(key => key.replace('human_mode:', ''));
    
    res.json({
      count: activePhones.length,
      phones: activePhones
    });
  } catch (error) {
    logger.error('Erro ao buscar atendimentos humanos ativos:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 