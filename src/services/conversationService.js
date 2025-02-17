// src/services/conversationService.js

import moment from 'moment-timezone';
import config from '../config.js';
import redisClient from '../redisClient.js';
import {
  createThread,
  getTimeBasedGreeting,
  storeMessageInConversation,
  addMessageWithRetry,
  getTokenUsage,
  summarizeContext,
  handleDeleteThread,
  waitForRunCompletion
} from './openaiService.js';
import { processImage } from './imageService.js';
import { sendReplyZAPI } from './zapiService.js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const messageBuffers = new Map();
const bufferTimeouts = new Map();

/**
 * Processa as mensagens do usuário, enviando-as ao OpenAI e retornando
 * a resposta final do assistente via Z-API.
 * Converte **texto** em *texto* para exibir negrito no WhatsApp.
 *
 * @param {string} userId - Identificador único do usuário (chatLid, etc.)
 * @param {string} phone - Número de telefone para resposta via Z-API
 * @param {string} message - Mensagem de texto
 * @param {string} imageUrl - URL da imagem (se houver)
 * @param {string} caption - Legenda adicional (se houver)
 */
export async function getChat(userId, phone, message, imageUrl, caption = '') {
  try {
    // Se não houver userId ou mensagem/imagem, lança erro
    if (!userId || (!message && !imageUrl)) {
      throw new Error('userId e message ou imageUrl são obrigatórios');
    }

    // Inicializa o buffer de mensagens, se necessário
    if (!messageBuffers.has(userId)) {
      messageBuffers.set(userId, []);
    }

    // Adiciona a mensagem ou imagem ao buffer
    if (imageUrl) {
      messageBuffers.get(userId).push({ type: 'image', imageUrl, caption });
    } else {
      messageBuffers.get(userId).push({ type: 'text', message });
    }

    // Se já houver um timeout agendado para esse userId, limpa
    if (bufferTimeouts.has(userId)) {
      clearTimeout(bufferTimeouts.get(userId));
    }

    // Agenda o processamento das mensagens após 10 segundos
    bufferTimeouts.set(userId, setTimeout(async () => {
      const bufferedMessages = messageBuffers.get(userId);
      messageBuffers.delete(userId);
      bufferTimeouts.delete(userId);

      // Define a data atual
      const currentDate = moment().tz(config.timezone).format('DD/MM/YYYY');

      // Verifica se existe um thread no Redis
      let threadId = await redisClient.get(`threadId:${userId}`);

      if (!threadId) {
        // Se não existir, cria um novo thread
        const greeting = getTimeBasedGreeting();
        const initialMessage = `${greeting} [Data: ${currentDate}]`;
        const thread = await createThread(userId, initialMessage);
        threadId = thread.id;
        await redisClient.set(`threadId:${userId}`, threadId);

        // Armazena essa mensagem no histórico
        await storeMessageInConversation(userId, threadId, {
          role: 'user',
          content: initialMessage,
          timestamp: Date.now()
        });
      } else {
        // Se já houver thread, verifica uso de tokens
        const totalTokens = await getTokenUsage(threadId);
        if (totalTokens > 200000) {
          const summarizedContext = await summarizeContext(threadId);
          const newThread = await createThread(
            userId,
            'Esta é uma continuação da conversa anterior. Contexto resumido:'
          );
          threadId = newThread.id;
          await redisClient.set(`threadId:${userId}`, threadId);
          await addMessageWithRetry(threadId, summarizedContext);
        }
      }

      // Processa cada item do buffer (mensagens/imagens)
      for (const item of bufferedMessages) {
        if (item.type === 'text') {
          const formattedMessage = `${item.message} [Data: ${currentDate}]`;

          // Verifica comando de apagar thread
          if (formattedMessage.toLowerCase().includes('apagar thread_id')) {
            // Apaga o thread do Redis
            await handleDeleteThread(userId);

            // Envia mensagem de confirmação ao usuário
            await sendReplyZAPI(phone, "Thread apagado com sucesso!");

            return; // Sai da função após apagar e confirmar
          }

          // Se não for "apagar thread_id", segue o fluxo normal
          await storeMessageInConversation(userId, threadId, {
            role: 'user',
            content: formattedMessage,
            timestamp: Date.now()
          });

          await addMessageWithRetry(threadId, formattedMessage);

        } else if (item.type === 'image') {
          try {
            const description = await processImage(item.imageUrl, item.caption);
            const instruction = `Descrição da imagem: ${description}`;

            await storeMessageInConversation(userId, threadId, {
              role: 'user',
              content: instruction,
              timestamp: Date.now()
            });

            await addMessageWithRetry(threadId, instruction);
          } catch (error) {
            console.error('Erro ao processar imagem:', error);
          }
        }
      }

      // Cria um run para o assistente processar a conversa
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: config.openai.assistantId
      });

      // Aguarda a conclusão do run
      await waitForRunCompletion(threadId, run.id);

      // Obtém as mensagens do thread e ordena
      const messagesResponse = await openai.beta.threads.messages.list(threadId);
      const messages = messagesResponse.data;
      messages.sort((a, b) => new Date(a.created_at || a.created) - new Date(b.created_at || b.created));

      // Filtra as mensagens do assistente e pega a última
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      const assistantMessage = assistantMessages[assistantMessages.length - 1];

      if (!assistantMessage) {
        throw new Error('Nenhuma mensagem do assistente encontrada.');
      }

      console.log("assistantMessage:", JSON.stringify(assistantMessage, null, 2));
      let assistantResponse = assistantMessage.content[0].text.value;
      console.log("assistantResponse (bruto):", assistantResponse);

      // Converte **texto** em *texto* para exibir negrito no WhatsApp
      assistantResponse = assistantResponse.replace(/\*\*(.*?)\*\*/g, '*$1*');

      // Armazena a resposta no histórico
      await storeMessageInConversation(userId, threadId, {
        role: 'assistant',
        content: assistantResponse,
        timestamp: Date.now()
      });

      // Envia a resposta via Z-API
      await sendReplyZAPI(phone, assistantResponse);

    }, 10000));
  } catch (error) {
    console.error('Erro no getChat:', error);
    throw error;
  }
}
