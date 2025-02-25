// src/routes/webhook.js
import express from 'express';
import { getChat } from '../services/conversationService.js';
import { processAudioMessage } from '../services/audioService.js';
import { sendAudioReceiptConfirmation } from '../services/zapiService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /webhook
 * Recebe mensagens (texto, áudio ou imagem) e inicia o processamento da conversa.
 */
router.post("/webhook", async (req, res, next) => {
  try {
    // Loga o payload recebido do webhook
    logger.info("Webhook recebido", { payload: req.body });
    
    const { type, fromMe, chatLid, text, phone, audio, media } = req.body;
    
    if (type === "ReceivedCallback" && fromMe === false && phone) {
      // Verificar se é uma mensagem de áudio
      if (audio?.audioUrl) {
        logger.info(`Recebido áudio do usuário ${phone} (${audio.seconds}s)`);
        // Enviar confirmação imediata de que recebemos o áudio
        await sendAudioReceiptConfirmation(phone);
        // Processar o áudio
        await processAudioMessage(chatLid, phone, audio.audioUrl);
      }
      // Verificar se é uma mensagem de texto
      else if (text?.message) {
        const message = text.message || "";
        logger.info(`Usuário ${phone} → Sofia: "${message}"`);
        await getChat(chatLid, phone, message);
      }
      // Outros tipos de mídia (como imagem)
      else if (media?.url) {
        logger.info(`Recebido mídia do usuário ${phone}: ${media.type}`);
        // Chamar função específica para o tipo de mídia
      }
    }
    
    // Sempre retorna 200 para o webhook, mesmo que ocorram problemas
    res.sendStatus(200);
  } catch (error) {
    logger.error("Erro no webhook", { error: error.message });
    // Sempre retorna 200 para o webhook
    res.sendStatus(200);
    next(error);
  }
});

export default router;
