// src/routes/webhook.js
import express from 'express';
import { getChat } from '../services/conversationService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /webhook
 * Recebe mensagens (texto ou imagem) e inicia o processamento da conversa.
 */
router.post("/webhook", async (req, res, next) => {
  try {
    // Loga o payload recebido do webhook
    logger.info("Webhook recebido", { payload: req.body });
    
    const { type, fromMe, chatLid, text, phone } = req.body;
    if (type === "ReceivedCallback" && fromMe === false && phone) {
      const message = text?.message || "";
      // Loga a mensagem recebida do usuário
      logger.info("Mensagem recebida do usuário", { chatLid, phone, message });
      await getChat(chatLid, phone, message);
    }
    res.sendStatus(200);
  } catch (error) {
    logger.error("Erro no webhook", { error: error.message });
    next(error);
  }
});

export default router;
