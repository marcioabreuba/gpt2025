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
import cleanCitations from '../utils/cleanCitations.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const messageBuffers = new Map();
const bufferTimeouts = new Map();
const BUFFER_DELAY = 10000;
const TOKEN_LIMIT = 200000;

// Mapa para controlar threads ativos
const activeThreads = new Map();
// Mapa para controlar processamentos em andamento por telefone
const processingQueue = new Map();

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
        // Verifica se já existe um processamento ativo para este telefone
        if (processingQueue.has(phone)) {
          console.log(`Já existe um processamento em fila para ${phone}, aguardando...`);
          
          // Aguarda até que o processamento anterior seja concluído
          await new Promise(resolve => {
            const checkInterval = setInterval(() => {
              if (!processingQueue.has(phone)) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 1000); // Verifica a cada segundo
          });
        }
        
        // Marca este telefone como tendo um processamento em fila
        processingQueue.set(phone, true);
        console.log(`Iniciando processamento em fila para ${phone}`);
        
        try {
          const bufferedMessages = messageBuffers.get(userId);
          if (!bufferedMessages || bufferedMessages.length === 0) {
            console.log(`Não há mensagens para processar para ${userId}`);
            return;
          }
          
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

          // Espera se houver um run ativo neste thread
          if (activeThreads.has(threadId)) {
            console.log(`Thread ${threadId} está ocupado, aguardando...`);
            
            await new Promise(resolve => {
              const checkInterval = setInterval(() => {
                if (!activeThreads.has(threadId)) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 1000);
            });
          }
          
          // Marca este thread como ocupado
          activeThreads.set(threadId, true);
          console.log(`Thread ${threadId} marcado como ocupado`);

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

          // Limpa as citações da resposta, logs e ajusta formatação
          const cleanedResponse = cleanCitations(assistantMessage.content[0].text.value);

          await storeMessageInConversation(userId, threadId, {
            role: 'assistant',
            content: cleanedResponse,
            timestamp: Date.now()
          });

          // Registrar a resposta que será enviada
          console.log(`IA → ${phone}: ${cleanedResponse}`);

          // Envia resposta via WhatsApp - usar a resposta já limpa
          await sendReplyZAPI(phone, cleanedResponse);
          
          return cleanedResponse;
        } catch (error) {
          console.error('Erro no processamento:', error);
          await sendReplyZAPI(phone, 
            "Estou tendo dificuldades técnicas... 🛠️ Por favor, tente novamente mais tarde! 😊"
          );
          throw error;
        } finally {
          // Independente do resultado, marca o thread como livre
          if (threadId) {
            activeThreads.delete(threadId);
            console.log(`Thread ${threadId} marcado como livre`);
          }
          // Libera o processamento em fila
          processingQueue.delete(phone);
          console.log(`Processamento em fila concluído para ${phone}`);
        }
      } catch (error) {
        // Garante que o processamento em fila é liberado mesmo em caso de erro
        processingQueue.delete(phone);
        console.error(`Erro no processamento em fila: ${error.message}`);
      }
    }, BUFFER_DELAY));

    return { status: "buffered" };
  } catch (error) {
    console.error('Erro crítico no getChat:', error);
    throw error;
  }
}