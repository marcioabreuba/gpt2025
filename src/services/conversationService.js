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
import { isAssistantPaused, storeChatLidForPhone } from './assistantController.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const messageBuffers = new Map();
const bufferTimeouts = new Map();
const BUFFER_DELAY = 20000;
const TOKEN_LIMIT = 200000;

// Mapa para controlar threads ativos
const activeThreads = new Map();
// Mapa para controlar processamentos em andamento por telefone
const processingQueue = new Map();
// Fila de mensagens pendentes (quando o usuário envia mensagem durante processamento)
const pendingMessages = new Map();
// Timestamp da última limpeza forçada
let lastForceCleanupTime = Date.now();

// Função para forçar a limpeza dos maps de processamento
export function forceResetProcessingState() {
  console.log("=== FORÇANDO RESET DO ESTADO DE PROCESSAMENTO ===");
  console.log(`Antes do reset: ${processingQueue.size} processamentos em fila, ${activeThreads.size} threads ativos`);
  
  const phoneNumbers = Array.from(processingQueue.keys());
  const threadIds = Array.from(activeThreads.keys());
  
  processingQueue.clear();
  activeThreads.clear();
  lastForceCleanupTime = Date.now();
  
  console.log(`Estado de processamento resetado! Liberados: ${phoneNumbers.join(', ')}`);
  console.log(`Threads liberados: ${threadIds.join(', ')}`);
  console.log("=== RESET CONCLUÍDO ===");
  
  return { 
    clearedPhones: phoneNumbers,
    clearedThreads: threadIds
  };
}

// Verificação periódica para identificar processamentos travados (executa a cada 5 minutos)
setInterval(() => {
  const now = Date.now();
  // Verifica se há processamentos ativos há mais de 10 minutos
  const MAX_PROCESSING_TIME = 10 * 60 * 1000; // 10 minutos
  
  if (processingQueue.size > 0 || activeThreads.size > 0) {
    console.log(`Verificando processamentos travados: ${processingQueue.size} em fila, ${activeThreads.size} threads ativos`);
    
    if (now - lastForceCleanupTime > MAX_PROCESSING_TIME) {
      console.log("Detectada possível condição de bloqueio. Realizando limpeza automática...");
      forceResetProcessingState();
    }
  }
}, 5 * 60 * 1000); // 5 minutos

// Função para processar a próxima mensagem pendente de um telefone
function processNextPendingMessage(phone) {
  if (pendingMessages.has(phone) && pendingMessages.get(phone).length > 0) {
    console.log(`Processando próxima mensagem pendente para ${phone}. Restantes: ${pendingMessages.get(phone).length}`);
    
    const nextMessage = pendingMessages.get(phone).shift();
    if (pendingMessages.get(phone).length === 0) {
      pendingMessages.delete(phone);
    }
    
    // Processa a próxima mensagem da fila imediatamente, sem buffer de delay
    setTimeout(() => {
      getChat(
        nextMessage.userId, 
        nextMessage.phone, 
        nextMessage.message, 
        nextMessage.imageUrl, 
        nextMessage.caption, 
        nextMessage.isAudioTranscription
      );
    }, 500); // Pequeno delay para garantir que o estado seja limpo corretamente
    
    return true;
  }
  
  return false;
}

// Verificação periódica para processar mensagens pendentes (a cada 30 segundos)
setInterval(() => {
  // Verifica se há telefones com mensagens pendentes e sem processamento ativo
  const phonesWithPendingMessages = Array.from(pendingMessages.keys());
  
  if (phonesWithPendingMessages.length > 0) {
    console.log(`Verificando ${phonesWithPendingMessages.length} telefones com mensagens pendentes`);
    
    for (const phone of phonesWithPendingMessages) {
      // Se não há processamento ativo para este telefone, processa a próxima mensagem
      if (!processingQueue.has(phone)) {
        processNextPendingMessage(phone);
      }
    }
  }
}, 30 * 1000); // 30 segundos

/**
 * Processa mensagens do usuário e retorna respostas do assistente.
 * @param {string} userId - ID do usuário/chat.
 * @param {string} phone - Número de telefone do usuário.
 * @param {string} message - Mensagem de texto do usuário.
 * @param {string} imageUrl - URL da imagem enviada pelo usuário.
 * @param {string} caption - Legenda da imagem.
 * @param {boolean} isAudioTranscription - Indica se a mensagem é uma transcrição de áudio.
 * @returns {Promise<Object>} - Status do processamento.
 */
export async function getChat(userId, phone, message, imageUrl, caption = '', isAudioTranscription = false) {
  try {
    // A mensagem já é registrada no webhook, não precisamos registrar novamente aqui
    // Removendo para evitar duplicação
    // logger.userMessage(phone, message);

    if (!userId || (!message && !imageUrl)) {
      throw new Error('userId e message ou imageUrl são obrigatórios');
    }

    // Sempre registra o mapeamento de telefone para chatLid
    if (phone && userId) {
      storeChatLidForPhone(phone, userId);
    }

    // Comandos especiais são processados imediatamente
    if (message) {
      // Comando para forçar reset do estado de processamento
      if (message.toLowerCase().includes('force_reset')) {
        const resetResult = forceResetProcessingState();
        await sendReplyZAPI(phone, `🔄 Estado de processamento resetado com sucesso!\n${resetResult.clearedPhones.length} telefones liberados\n${resetResult.clearedThreads.length} threads liberados`);
        return { status: "reset_complete" };
      }
      
      // Comando para apagar thread
      if (message.toLowerCase().includes('apagar thread_id')) {
        // Para este comando específico, ignoramos o estado do processamento em fila
        // para garantir que sempre seja executado
        await handleDeleteThread(userId);
        await sendReplyZAPI(phone, "Histórico resetado com sucesso! 😊");
        return { status: "thread_deleted" };
      }
    }

    // Inicializa buffer de mensagens do usuário
    if (!messageBuffers.has(userId)) {
      messageBuffers.set(userId, []);
    }

    // Armazena mensagens no buffer com phone, mesmo que o assistente esteja pausado
    messageBuffers.get(userId).push({
      type: imageUrl ? 'image' : 'text',
      content: imageUrl || message,
      meta: { 
        phone, 
        caption,
        isAudioTranscription,
      }
    });

    // Reseta o timeout existente
    if (bufferTimeouts.has(userId)) {
      clearTimeout(bufferTimeouts.get(userId));
    }

    // Se o assistente estiver pausado, apenas armazena a mensagem na thread, mas não gera resposta
    if (message && isAssistantPaused(phone)) {
      console.log(`Assistente pausado para ${phone}. Armazenando mensagem na thread sem gerar resposta.`);
      
      bufferTimeouts.set(userId, setTimeout(async () => {
        try {
          const bufferedMessages = messageBuffers.get(userId);
          if (!bufferedMessages || bufferedMessages.length === 0) {
            console.log(`Não há mensagens para armazenar para ${userId}`);
            return;
          }
          
          // Fazemos uma cópia e limpamos o buffer imediatamente
          const messagesToProcess = [...bufferedMessages];
          messageBuffers.delete(userId);
          bufferTimeouts.delete(userId);
          
          console.log(`Armazenando ${messagesToProcess.length} mensagens para ${userId} (modo pausado)`);

          const currentDate = moment().tz(config.timezone).format('DD/MM/YYYY');
          const threadId = await redisClient.get(`threadId:${userId}`);

          // Cria novo thread se necessário
          if (threadId) {
            // Processamos as mensagens bufferizadas apenas para armazená-las
            let textMessages = [];
            let imageProcessed = false;
            
            for (const item of messagesToProcess) {
              if (item.type === 'text') {
                let formattedMessage = item.content;
                
                if (item.meta.isAudioTranscription) {
                  formattedMessage = `[Transcrição de áudio]: ${formattedMessage} [Data: ${currentDate}] [Phone: ${phone}]`;
                } else {
                  formattedMessage = `${formattedMessage} [Data: ${currentDate}] [Phone: ${phone}]`;
                }
                
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
                    console.error(`Falha ao adicionar imagem ao thread ${threadId} (modo pausado)`);
                  } else {
                    imageProcessed = true;
                  }
                } catch (error) {
                  console.error('Erro no processamento de imagem (modo pausado):', error);
                }
              }
            }
            
            // Consolidamos todas as mensagens de texto em uma única, se houver várias
            if (textMessages.length > 0) {
              const consolidatedMessage = textMessages.join("\n\n");
              console.log(`Mensagem consolidada para ${userId} (modo pausado): ${consolidatedMessage}`);
              
              await storeMessageInConversation(userId, threadId, {
                role: 'user',
                content: consolidatedMessage,
                timestamp: Date.now()
              });
              
              await addMessageWithRetry(threadId, consolidatedMessage);
            }
            
            console.log(`Mensagens armazenadas com sucesso na thread ${threadId} (modo pausado)`);
          } else {
            // Se não existe thread, criamos uma nova
            const greeting = getTimeBasedGreeting();
            const initialMessage = `${greeting} [Data: ${currentDate}] [Phone: ${phone}]`;
            const thread = await createThread(userId, initialMessage);
            const newThreadId = thread.id;
            
            await redisClient.set(`threadId:${userId}`, newThreadId);
            await storeMessageInConversation(userId, newThreadId, { 
              role: 'user', 
              content: initialMessage, 
              timestamp: Date.now() 
            });
            
            console.log(`Nova thread ${newThreadId} criada para ${userId} (modo pausado)`);
            
            // No caso de ser uma nova thread, já armazenamos a primeira mensagem acima
          }
        } catch (error) {
          console.error('Erro ao armazenar mensagem no modo pausado:', error);
        }
      }, 1000)); // Delay reduzido para armazenar mais rapidamente, já que não vamos gerar resposta
      
      return { status: "assistant_paused_message_stored" };
    }

    // Verifica se o processamento está travado há muito tempo
    if (processingQueue.has(phone)) {
      const MAX_WAIT_TIME = 5 * 60 * 1000; // 5 minutos
      const now = Date.now();
      
      // Se o processamento estiver ativo há mais de 5 minutos, fazemos reset
      if (!processingQueue.get(phone).startTime || 
          (now - processingQueue.get(phone).startTime > MAX_WAIT_TIME)) {
        console.log(`Detectado processamento travado para ${phone}. Resetando estado...`);
        processingQueue.delete(phone);
      } else {
        // Em vez de ignorar a mensagem, adicionamos à fila de processamento pendente
        if (!pendingMessages.has(phone)) {
          pendingMessages.set(phone, []);
        }
        
        pendingMessages.get(phone).push({
          userId,
          phone,
          message,
          imageUrl,
          caption,
          isAudioTranscription,
          timestamp: Date.now()
        });
        
        console.log(`Processamento em andamento para ${phone}, mensagem adicionada à fila pendente. Total: ${pendingMessages.get(phone).length}`);
        return { status: "queued" };
      }
    }

    // Reseta o timeout existente
    if (bufferTimeouts.has(userId)) {
      clearTimeout(bufferTimeouts.get(userId));
    }

    // Novo timeout para processamento
    bufferTimeouts.set(userId, setTimeout(async () => {
      // Evita processamento duplicado - se já estiver processando para este usuário, não inicia novo
      if (processingQueue.has(phone)) {
        // Em vez de ignorar o buffer, adicionamos todas as mensagens à fila pendente
        if (!pendingMessages.has(phone)) {
          pendingMessages.set(phone, []);
        }
        
        // Obtemos as mensagens atuais no buffer
        const bufferedMessages = messageBuffers.get(userId) || [];
        
        if (bufferedMessages.length > 0) {
          // Criamos uma entrada consolidada para todas as mensagens no buffer atual
          pendingMessages.get(phone).push({
            userId,
            phone,
            message: bufferedMessages.some(m => m.type === 'text') ? 
              bufferedMessages
                .filter(m => m.type === 'text')
                .map(m => m.content)
                .join('\n\n') : 
              null,
            imageUrl: bufferedMessages.find(m => m.type === 'image')?.content || null,
            caption: bufferedMessages.find(m => m.type === 'image')?.meta.caption || '',
            isAudioTranscription: false,
            timestamp: Date.now()
          });
          
          console.log(`Processamento já em andamento para ${phone}, ${bufferedMessages.length} mensagens adicionadas à fila pendente. Total: ${pendingMessages.get(phone).length}`);
        }
        
        // Limpamos o buffer atual
        messageBuffers.delete(userId);
        return;
      }
      
      // Marca este telefone como tendo um processamento em andamento com timestamp
      processingQueue.set(phone, { startTime: Date.now() });
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
            
            // Armazenamos mensagens de texto para processar juntas
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
          
          // Definição da ferramenta get_orders_info (fornecida pelo usuário)
          const getOrdersInfoToolDefinition = {
            "name": "get_orders_info",
            "description": "Obtém status de pedido. Só use se o cliente fornecer #pedido (4‑8 dígitos) **OU** CPF (11 dígitos) e mencionar pedido/rastreio.",
            "strict": false,
            "parameters": {
              "type": "object",
              //"additionalProperties": false, 
              "properties": {
                "order_number": {
                  "type": "string",
                  "pattern": "^#?\\d{4,8}$",
                  "description": "Número do pedido (4-8 dígitos, ex: 1234, #567890). Extrair SOMENTE se o usuário fornecer explicitamente."
                },
                "cpf": {
                  "type": "string",
                  "pattern": "^\\d{11}$",
                  "description": "CPF do cliente (11 dígitos, ex: 12345678900). Extrair SOMENTE se o usuário fornecer explicitamente."
                }
              },
              "required": [] 
            }
          };

          // Definição da ferramenta get_products_info (fornecida pelo usuário)
          const getProductsInfoToolDefinition = {
            "name": "get_products_info",
            "description": "Retorna um array com os nomes dos produtos encontrados na mensagem da loja Shopify",
            "strict": true,
            "parameters": {
              "type": "object",
              "required": [
                "endpoint",
                "nomes_produtos"
              ],
              "properties": {
                "endpoint": {
                  "type": "string",
                  "description": "O endpoint para obter as informações sobre os produtos"
                },
                "nomes_produtos": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "Array com os nomes dos produtos encontrados na mensagem"
                }
              },
              "additionalProperties": false
            }
          };

          // Regex para detectar intenção de pedido
          const orderPromptRegex = /(pedido|rastreio|tracking|status|#\d{4,8}|\b\d{11}\b)/i; // Escapado para string JS

          // Lista de ferramentas ativas para esta chamada
          let activeTools = [];

          // ** SEMPRE adicionar get_products_info **
          activeTools.push({ 
            type: "function", 
            function: getProductsInfoToolDefinition 
          });

          // ** Adicionar get_orders_info SOMENTE se a regex encontrar correspondência **
          let messageContentToCheck = "";
          if (textMessages.length > 0) {
            messageContentToCheck = textMessages.join("\n\n"); // Usa o conteúdo das mensagens de texto
          }

          // Adiciona a ferramenta get_orders_info SOMENTE se a regex encontrar correspondência na mensagem
          if (messageContentToCheck && orderPromptRegex.test(messageContentToCheck)) {
              console.log("Intenção de pedido detectada. Habilitando a ferramenta get_orders_info.");
              // Envolver a definição da ferramenta na estrutura esperada pela API
              activeTools.push({ 
                type: "function", 
                function: getOrdersInfoToolDefinition 
              });
          } else {
              console.log("Nenhuma intenção de pedido detectada. A ferramenta get_orders_info NÃO será oferecida.");
          }

          // Adicione aqui outras ferramentas que devam estar sempre ativas ou baseadas em outras condições, se houver.
          // Ex: const getProductsTool = { ... }; activeTools.push(getProductsTool);

          const run = await openai.beta.threads.runs.create(threadId, { 
            assistant_id: config.openai.assistantId,
            tools: activeTools // Passa a lista dinâmica de ferramentas
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
        
        // Processa mensagens pendentes, se houver
        if (pendingMessages.has(phone) && pendingMessages.get(phone).length > 0) {
          console.log(`Existem ${pendingMessages.get(phone).length} mensagens pendentes para ${phone}. Processando agora...`);
          processNextPendingMessage(phone);
        }
      }
    }, BUFFER_DELAY));

    return { status: "buffered" };
  } catch (error) {
    console.error('Erro crítico no getChat:', error);
    throw error;
  }
}