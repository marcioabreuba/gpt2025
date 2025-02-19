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
const BUFFER_DELAY = 10000;
const TOKEN_LIMIT = 200000;

export async function getChat(userId, phone, message, imageUrl, caption = '') {
  try {
    if (!userId || (!message && !imageUrl)) {
      throw new Error('userId e message ou imageUrl são obrigatórios');
    }

    // Inicializa buffer de mensagens do usuário, se não existir
    if (!messageBuffers.has(userId)) {
      messageBuffers.set(userId, []);
    }

    // Armazena mensagens no buffer
    messageBuffers.get(userId).push(imageUrl ? { type: 'image', imageUrl, caption } : { type: 'text', message });

    // Reseta o timeout caso já exista um
    if (bufferTimeouts.has(userId)) {
      clearTimeout(bufferTimeouts.get(userId));
    }

    // Configura um novo timeout para processar mensagens acumuladas
    bufferTimeouts.set(userId, setTimeout(async () => {
      try {
        const bufferedMessages = messageBuffers.get(userId);
        messageBuffers.delete(userId);
        bufferTimeouts.delete(userId);

        const currentDate = moment().tz(config.timezone).format('DD/MM/YYYY');
        let threadId = await redisClient.get(`threadId:${userId}`);

        // Se não existir uma thread, cria uma nova
        if (!threadId) {
          const greeting = getTimeBasedGreeting();
          const initialMessage = `${greeting} [Data: ${currentDate}]`;
          const thread = await createThread(userId, initialMessage);
          threadId = thread.id;
          await redisClient.set(`threadId:${userId}`, threadId);
          await storeMessageInConversation(userId, threadId, { role: 'user', content: initialMessage, timestamp: Date.now() });
        } else {
          // Verifica o uso de tokens para evitar estouro do limite
          const totalTokens = await getTokenUsage(threadId);
          if (totalTokens > TOKEN_LIMIT) {
            const summarizedContext = await summarizeContext(threadId);
            const newThread = await createThread(userId, 'Continuação da conversa anterior. Contexto resumido:');
            threadId = newThread.id;
            await redisClient.set(`threadId:${userId}`, threadId);
            await addMessageWithRetry(threadId, summarizedContext);
          }
        }

        // Processa mensagens armazenadas
        for (const item of bufferedMessages) {
          if (item.type === 'text') {
            const formattedMessage = `${item.message} [Data: ${currentDate}]`;
            if (formattedMessage.toLowerCase().includes('apagar thread_id')) {
              await handleDeleteThread(userId);
              await sendReplyZAPI(phone, "Thread apagado com sucesso!");
              return;
            }
            await storeMessageInConversation(userId, threadId, { role: 'user', content: formattedMessage, timestamp: Date.now() });
            await addMessageWithRetry(threadId, formattedMessage);
          } else if (item.type === 'image') {
            try {
              const description = await processImage(item.imageUrl, item.caption);
              const instruction = `Descrição da imagem: ${description}`;
              await storeMessageInConversation(userId, threadId, { role: 'user', content: instruction, timestamp: Date.now() });
              await addMessageWithRetry(threadId, instruction);
            } catch (error) {
              console.error('Erro ao processar imagem:', error);
            }
          }
        }

        // Executa a interação com a OpenAI
        const run = await openai.beta.threads.runs.create(threadId, { assistant_id: config.openai.assistantId });
        await waitForRunCompletion(threadId, run.id);
        
        const messagesResponse = await openai.beta.threads.messages.list(threadId);
        const messages = messagesResponse.data.sort((a, b) => new Date(a.created_at || a.created) - new Date(b.created_at || b.created));
        const assistantMessage = messages.filter(m => m.role === 'assistant').pop();

        if (!assistantMessage) {
          throw new Error('Nenhuma mensagem do assistente encontrada.');
        }

        let assistantResponse = assistantMessage.content[0].text.value.replace(/\*\*(.*?)\*\*/g, '*$1*');
        await storeMessageInConversation(userId, threadId, { role: 'assistant', content: assistantResponse, timestamp: Date.now() });
        await sendReplyZAPI(phone, assistantResponse);
      } catch (error) {
        console.error('Erro ao processar mensagens:', error);
      }
    }, BUFFER_DELAY));
  } catch (error) {
    console.error('Erro no getChat:', error);
    throw error;
  }
}
