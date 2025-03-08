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
import { processImage } from './servidorImagem.js';
import { sendReplyZAPI } from './zapiService.js';
import OpenAI from 'openai';
import logger from '../utils/logger.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const messageBuffers = new Map();
const bufferTimeouts = new Map();
const BUFFER_DELAY = 10000;
const TOKEN_LIMIT = 200000;

export async function getChat(userId, phone, message, imageUrl, caption = '', isAudioTranscription = false) {
  try {
    // A mensagem já é registrada no webhook, não precisamos registrar novamente aqui
    // Removendo para evitar duplicação
    // logger.userMessage(phone, message);

    if (!userId || (!message && !imageUrl)) {
      throw new Error('userId e message ou imageUrl são obrigatórios');
    }

    // Inicializa buffer de mensagens do usuário
    if (!messageBuffers.has(userId)) {
      messageBuffers.set(userId, []);
    }

    // Armazena mensagens no buffer com phone
    messageBuffers.get(userId).push({
      type: imageUrl ? 'image' : 'text',
      content: imageUrl || message,
      meta: { 
        phone, 
        caption,
        isAudioTranscription
      }
    });

    // Reseta o timeout existente
    if (bufferTimeouts.has(userId)) {
      clearTimeout(bufferTimeouts.get(userId));
    }

    // Novo timeout para processamento
    bufferTimeouts.set(userId, setTimeout(async () => {
      try {
        const bufferedMessages = messageBuffers.get(userId);
        messageBuffers.delete(userId);
        bufferTimeouts.delete(userId);

        const currentDate = moment().tz(config.timezone).format('DD/MM/YYYY');
        let threadId = await redisClient.get(`threadId:${userId}`);

        // Cria novo thread se necessário
        if (!threadId) {
          const greeting = getTimeBasedGreeting();
          const initialMessage = `${greeting} [Data: ${currentDate}] [Phone: ${phone}]`;
          const thread = await createThread(userId, initialMessage);
          threadId = thread.id;
          await redisClient.set(`threadId:${userId}`, threadId);
          await storeMessageInConversation(userId, threadId, { 
            role: 'user', 
            content: initialMessage, 
            timestamp: Date.now() 
          });
        } else {
          // Verificação de limite de tokens
          const totalTokens = await getTokenUsage(threadId);
          if (totalTokens > TOKEN_LIMIT) {
            const summarizedContext = await summarizeContext(threadId);
            const newThread = await createThread(userId, 
              `[Continuação] [Phone: ${phone}] Contexto: ${summarizedContext}`
            );
            threadId = newThread.id;
            await redisClient.set(`threadId:${userId}`, threadId);
            await addMessageWithRetry(threadId, summarizedContext);
          }
        }

        // Processa mensagens bufferizadas
        for (const item of bufferedMessages) {
          if (item.type === 'text') {
            let formattedMessage = item.content;
            
            if (item.meta.isAudioTranscription) {
              formattedMessage = `[Transcrição de áudio]: ${formattedMessage} [Data: ${currentDate}] [Phone: ${phone}]`;
            } else {
              formattedMessage = `${formattedMessage} [Data: ${currentDate}] [Phone: ${phone}]`;
            }
            
            if (formattedMessage.toLowerCase().includes('apagar thread_id')) {
              await handleDeleteThread(userId);
              await sendReplyZAPI(phone, "Histórico resetado com sucesso! 😊");
              return;
            }

            await storeMessageInConversation(userId, threadId, {
              role: 'user',
              content: formattedMessage,
              timestamp: Date.now()
            });
            await addMessageWithRetry(threadId, formattedMessage);

          } else if (item.type === 'image') {
            try {
              const description = await processImage(item.content);
              const instruction = `[Imagem] ${description} [Phone: ${phone}]`;
              
              await storeMessageInConversation(userId, threadId, {
                role: 'user',
                content: instruction,
                timestamp: Date.now()
              });
              await addMessageWithRetry(threadId, instruction);
            } catch (error) {
              console.error('Erro no processamento de imagem:', error);
              await sendReplyZAPI(phone, "Ops! Não consegui entender essa imagem. 🫣 Pode descrever brevemente?");
            }
          }
        }

        // Executa interação com OpenAI
        const run = await openai.beta.threads.runs.create(threadId, { 
          assistant_id: config.openai.assistantId 
        });
        
        await waitForRunCompletion(threadId, run.id);

        // Obtém e processa resposta
        const messagesResponse = await openai.beta.threads.messages.list(threadId);
        const messages = messagesResponse.data
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        const assistantMessage = messages
          .filter(m => m.role === 'assistant')
          .pop();

        if (!assistantMessage) {
          throw new Error('Nenhuma resposta do assistente encontrada');
        }

        let response = assistantMessage.content[0].text.value
          .replace(/\*\*/g, '*') // Formatação simplificada
          .replace(/\[links protegidos\]/g, ''); // Limpeza de placeholders
          
        // Remove citações de fontes da OpenAI
        response = response
          .replace(/【\d+:\d+†source】/g, '') // Padrão 【n:n†source】
          .replace(/【\d+†source】/g, '')     // Padrão 【n†source】
          .replace(/\[\d+\]/g, '')           // Padrão [n]
          .replace(/\(Citation: \d+\)/g, '')  // Padrão (Citation: n)
          .replace(/\s{2,}/g, ' ')           // Remove espaços extras
          .trim();

        await storeMessageInConversation(userId, threadId, {
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        });

        // Registrar a resposta que será enviada
        console.log(`IA → ${phone}: ${response}`);

        // Envia resposta via WhatsApp
        await sendReplyZAPI(phone, response);

      } catch (error) {
        console.error('Erro no processamento:', error);
        await sendReplyZAPI(phone, 
          "Estou tendo dificuldades técnicas... 🛠️ Por favor, tente novamente mais tarde! 😊"
        );
      }
    }, BUFFER_DELAY));

  } catch (error) {
    console.error('Erro crítico no getChat:', error);
    await sendReplyZAPI(phone, 
      "Algo deu errado no meu sistema... ⚠️ Nossa equipe já foi notificada!"
    );
    throw error;
  }
}