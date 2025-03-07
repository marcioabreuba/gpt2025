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
    console.log("Webhook recebido", req.body);
    
    const { type, fromMe, chatLid, text, phone, audio, image } = req.body;
    
    if (type === "ReceivedCallback" && fromMe === false && phone) {
      // Verificar se é uma imagem
      if (image?.imageUrl) {
        const caption = image.caption || '';
        console.log(`Recebido imagem do usuário ${phone} ${caption ? `com legenda: "${caption}"` : 'sem legenda'}`);
        
        // Registrando a mensagem de imagem
        if (caption) {
          console.log(`Usuário ${phone}: [IMAGEM] ${caption}`);
        } else {
          console.log(`Usuário ${phone}: [IMAGEM sem legenda]`);
        }
        
        // Processar imagem com legenda (se houver)
        await getChat(chatLid, phone, null, image.imageUrl, caption);
      }
      // Verificar se é uma mensagem de áudio
      else if (audio?.audioUrl) {
        console.log(`Recebido áudio do usuário ${phone} (${audio.seconds}s)`);
        console.log(`Usuário ${phone}: [ÁUDIO ${audio.seconds}s]`);
        
        await processAudioMessage(chatLid, phone, audio.audioUrl);
      }
      // Verificar se é uma mensagem de texto
      else if (text?.message) {
        const message = text.message || "";
        console.log(`Usuário ${phone}: ${message}`);
        
        await getChat(chatLid, phone, message);
      }
    }
    
    // Sempre retorna 200 para o webhook, mesmo que ocorram problemas
    res.sendStatus(200);
  } catch (error) {
    console.error("Erro no webhook", error.message);
    // Sempre retorna 200 para o webhook
    res.sendStatus(200);
    next(error);
  }
});

export default router;
