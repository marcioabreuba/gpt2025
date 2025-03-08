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
      // Evita processamento duplicado - se já estiver processando para este usuário, não inicia novo
      if (processingQueue.has(phone)) {
        console.log(`Processamento já em andamento para ${phone}, ignorando buffer duplicado`);
        return;
      }
      
      // Marca este telefone como tendo um processamento em andamento
      processingQueue.set(phone, true);
      console.log(`Iniciando processamento em fila para ${phone}`);
      
      let threadId = null;
      
      try {
        const bufferedMessages = messageBuffers.get(userId);
        if (!bufferedMessages || bufferedMessages.length === 0) {
          console.log(`Não há mensagens para processar para ${userId}`);
          return;
        }
        
        // Fazemos uma cópia e limpamos o buffer imediatamente
        const messagesToProcess = [...bufferedMessages];
        messageBuffers.delete(userId);
        bufferTimeouts.delete(userId);
        
        console.log(`Processando ${messagesToProcess.length} mensagens para ${userId}`);

        const currentDate = moment().tz(config.timezone).format('DD/MM/YYYY');
        threadId = await redisClient.get(`threadId:${userId}`);

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
          
          // Aguarda até 60 segundos pela liberação do thread
          let waitTime = 0;
          const maxWaitTime = 60000; // 60 segundos
          const checkInterval = 1000; // 1 segundo
          
          while (activeThreads.has(threadId) && waitTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitTime += checkInterval;
          }
          
          if (activeThreads.has(threadId)) {
            console.log(`Tempo de espera excedido para thread ${threadId}, forçando liberação`);
            activeThreads.delete(threadId);
          }
        }
        
        // Marca este thread como ocupado
        activeThreads.set(threadId, true);
        console.log(`Thread ${threadId} marcado como ocupado`);

        // Processa mensagens bufferizadas
        let textMessages = [];
        let imageProcessed = false;
        
        // Primeiro, processamos comandos especiais e imagens
        for (const item of messagesToProcess) {
          if (item.type === 'text') {
            let formattedMessage = item.content;
            
            if (item.meta.isAudioTranscription) {
              formattedMessage = `[Transcrição de áudio]: ${formattedMessage} [Data: ${currentDate}] [Phone: ${phone}]`;
            } else {
              formattedMessage = `${formattedMessage} [Data: ${currentDate}] [Phone: ${phone}]`;
            }
            
            // Se for comando para apagar thread, processamos imediatamente
            if (formattedMessage.toLowerCase().includes('apagar thread_id')) {
              await handleDeleteThread(userId);
              await sendReplyZAPI(phone, "Histórico resetado com sucesso! 😊");
              return;
            }
            
            // Armazenamos outras mensagens de texto para processar juntas
            textMessages.push(formattedMessage);
            
          } else if (item.type === 'image' && !imageProcessed) {
            try {
              const description = await processImage(item.content);
              const instruction = `[Imagem] ${description} [Phone: ${phone}]`;
              
              await storeMessageInConversation(userId, threadId, {
                role: 'user',
                content: instruction,
                timestamp: Date.now()
              });
              
              // Para imagens, adicionamos imediatamente ao thread
              const addSuccess = await addMessageWithRetry(threadId, instruction);
              if (!addSuccess) {
                console.error(`Falha ao adicionar imagem ao thread ${threadId}`);
                await sendReplyZAPI(phone, "Ops! Não consegui entender essa imagem. 🫣 Pode descrever brevemente?");
                // Continuamos o processamento mesmo se falhar a adição da imagem
              } else {
                imageProcessed = true;
              }

            } catch (error) {
              console.error('Erro no processamento de imagem:', error);
              await sendReplyZAPI(phone, "Ops! Não consegui entender essa imagem. 🫣 Pode descrever brevemente?");
            }
          }
        }
        
        // Consolidamos todas as mensagens de texto em uma única, se houver várias
        if (textMessages.length > 0) {
          const consolidatedMessage = textMessages.join("\n\n");
          console.log(`Mensagem consolidada para ${userId}: ${consolidatedMessage}`);
          
          await storeMessageInConversation(userId, threadId, {
            role: 'user',
            content: consolidatedMessage,
            timestamp: Date.now()
          });
          
          const addSuccess = await addMessageWithRetry(threadId, consolidatedMessage);
          if (!addSuccess) {
            console.error(`Falha ao adicionar mensagem ao thread ${threadId}, abortando processamento`);
            throw new Error('Falha ao adicionar mensagem ao thread');
          }
        }

        // Executa interação com OpenAI apenas se houver mensagens de texto ou imagem
        if (textMessages.length > 0 || imageProcessed) {
          const run = await openai.beta.threads.runs.create(threadId, { 
            assistant_id: config.openai.assistantId 
          });
          
          const runResult = await waitForRunCompletion(threadId, run.id);
          
          if (!runResult.success) {
            console.error(`Falha ao completar run: ${runResult.error?.message || 'Erro desconhecido'}`);
            throw new Error(`Falha ao processar mensagem: ${runResult.error?.message}`);
          }

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
        } else {
          console.log(`Nenhuma mensagem processável encontrada para ${userId}`);
        }
      } catch (error) {
        console.error('Erro no processamento:', error);
        
        try {
          await sendReplyZAPI(phone, 
            "Estou tendo dificuldades técnicas... 🛠️ Por favor, tente novamente mais tarde! 😊"
          );
        } catch (sendError) {
          console.error('Erro ao enviar mensagem de erro:', sendError);
        }
      } finally {
        // Independente do resultado, marca o thread como livre (se existir)
        if (threadId) {
          activeThreads.delete(threadId);
          console.log(`Thread ${threadId} marcado como livre`);
        }
        
        // Libera o processamento em fila
        processingQueue.delete(phone);
        console.log(`Processamento em fila concluído para ${phone}`);
      }
    }, BUFFER_DELAY));

    return { status: "buffered" };
  } catch (error) {
    console.error('Erro crítico no getChat:', error);
    throw error;
  }
}