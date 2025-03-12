// src/routes/webhook.js
import express from 'express';
import { getChat } from '../services/conversationService.js';
import { processAudioMessage } from '../services/audioService.js';
// import { sendAudioReceiptConfirmation } from '../services/zapiService.js';
import logger from '../utils/logger.js';
import { handleAssistantCommand, storeChatLidForPhone } from '../services/assistantController.js';

const router = express.Router();

// Mapa para rastrear o último chatLid associado a cada número de telefone
const phoneToChat = new Map();

/**
 * POST /webhook
 * Recebe mensagens (texto, áudio ou imagem) e inicia o processamento da conversa.
 */
router.post("/webhook", async (req, res, next) => {
  try {
    // Loga o payload recebido do webhook
    console.log("Webhook recebido", req.body);
    
    const { type, fromMe, chatLid, text, phone, audio, image, instanceId } = req.body;
    
    // Se recebemos uma mensagem de usuário com chatLid, armazenamos para referência futura
    if (type === "ReceivedCallback" && !fromMe && phone && chatLid) {
      // Armazena o mapeamento de telefone para chatLid
      phoneToChat.set(phone, chatLid);
      // Transfere essa informação para o controlador do assistente
      storeChatLidForPhone(phone, chatLid);
    }
    
    // Tratamento para mensagens enviadas pelo próprio número da IA (Helena)
    if (type === "ReceivedCallback" && fromMe === true && phone && text?.message) {
      const message = text.message || "";
      console.log(`Mensagem da IA (próprio número): ${message}`);
      
      // Verifica se é um comando de controle da assistente
      // Recupera o último chatLid conhecido para este número
      const lastChatLid = phoneToChat.get(phone) || null;
      console.log(`Usando chatLid ${lastChatLid} para o telefone ${phone}`);
      
      const commandResult = await handleAssistantCommand(phone, message, lastChatLid);
      if (commandResult.handled) {
        console.log(`Comando processado: ${commandResult.status}`);
        res.sendStatus(200);
        return;
      }
    }
    
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
        await getChat(chatLid, phone, null, image.imageUrl, caption, false, instanceId);
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
        
        await getChat(chatLid, phone, message, null, null, false, instanceId);
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
