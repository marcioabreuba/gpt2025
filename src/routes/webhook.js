// src/routes/webhook.js
import express from 'express';
import { getChat } from '../services/conversationService.js';
import { processAudioMessage } from '../services/audioService.js';
// import { sendAudioReceiptConfirmation } from '../services/zapiService.js';
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
    
    const { type, fromMe, chatLid, text, phone, audio, image } = req.body;
    
    if (type === "ReceivedCallback" && fromMe === false && phone) {
      // Verificar se é uma imagem
      if (image?.imageUrl) {
        const caption = image.caption || '';
        logger.info(`Recebido imagem do usuário ${phone} ${caption ? `com legenda: "${caption}"` : 'sem legenda'}`);
        
        // Processar imagem com legenda (se houver)
        await getChat(chatLid, phone, null, image.imageUrl, caption);
      }
      // Verificar se é uma mensagem de áudio
      else if (audio?.audioUrl) {
        logger.info(`Recebido áudio do usuário ${phone} (${audio.seconds}s)`);
        await processAudioMessage(chatLid, phone, audio.audioUrl);
      }
      // Verificar se é uma mensagem de texto
      else if (text?.message) {
        const message = text.message || "";
        logger.info(`Usuário ${phone} → Sofia: "${message}"`);
        await getChat(chatLid, phone, message);
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
