import OpenAI from "openai";
import moment from "moment-timezone";
import config from "../config.js";
import redisClient from "../redisClient.js";
import { get_products_info } from "../services/shopifyService.js";
import { getOrderByNumber } from "../services/shopifyOrdersService.js";
import logger from "../utils/logger.js";

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

const TRAINING_DATA_KEY_PREFIX = 'training_priority:';

// Exportação correta de todas as funções
export function getTimeBasedGreeting() {
  const now = moment().tz("America/Sao_Paulo");
  return now.hours() < 12 ? "Bom dia" : now.hours() < 18 ? "Boa tarde" : "Boa noite";
}

export async function createThread(userId, content) {
  const thread = await openai.beta.threads.create({
    messages: [{ role: "user", content }],
    metadata: { userId }
  });
  return thread;
}

/**
 * Armazena uma mensagem no histórico de conversação no Redis.
 * @param {string} userId - ID do usuário.
 * @param {string} threadId - ID do thread de conversa.
 * @param {object} message - Objeto de mensagem com role, content e timestamp.
 */
export async function storeMessageInConversation(userId, threadId, message) {
  try {
    if (!userId || !threadId || !message) return;
    
    const conversationKey = `conversation:${userId}`;
    const messageWithId = {
      ...message,
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      threadId
    };
    
    // Adiciona a mensagem à lista de conversação
    await redisClient.rpush(conversationKey, JSON.stringify(messageWithId));
    
    // Se for uma mensagem enviada por um humano (Helena), marca a conversa para treinamento prioritário
    if (message.isHuman) {
      await redisClient.set(`${TRAINING_DATA_KEY_PREFIX}${threadId}`, 'true');
      console.log(`Thread ${threadId} marcado para treinamento prioritário (intervenção humana)`);
    }
    
    return messageWithId;
  } catch (error) {
    console.error('Erro ao armazenar mensagem na conversação:', error);
  }
}

export async function addMessageWithRetry(threadId, message, maxRetries = 3, initialDelay = 1000) {
  let retries = 0;
  let lastError = null;
  let delay = initialDelay;
  
  while (retries < maxRetries) {
    try {
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: message
      });
      
      console.log(`Mensagem adicionada ao thread ${threadId} na tentativa ${retries + 1}`);
      return true;
    } catch (error) {
      retries++;
      lastError = error;
      
      // Verifica se o erro é por um run ativo
      const isRunActiveError = error.message && error.message.includes("while a run") && error.message.includes("is active");
      
      if (isRunActiveError) {
        console.log(`Tentativa ${retries} falhou: ${error.message}`);
        
        // Aumenta o tempo de espera exponencialmente
        delay = initialDelay * Math.pow(2, retries - 1);
        
        // Espera antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Para outros tipos de erro, pode não fazer sentido continuar tentando
        console.error(`Erro não recuperável ao adicionar mensagem: ${error.message}`);
        break;
      }
    }
  }
  
  const errorMessage = `Falha após ${retries} tentativas: ${lastError ? lastError.message : 'Erro desconhecido'}`;
  console.error(errorMessage);
  
  // Em vez de lançar exceção que pode derrubar a aplicação, retornamos false para indicar falha
  return false;
}

export async function getTokenUsage(threadId) {
  try {
    const runsResponse = await openai.beta.threads.runs.list(threadId);
    return runsResponse.data.reduce((total, run) => total + (run.usage?.total_tokens || 0), 0);
  } catch (error) {
    console.error(`Erro ao obter uso de tokens: ${error.message}`);
    throw error;
  }
}

export async function summarizeContext(threadId) {
  try {
    const messages = await openai.beta.threads.messages.list(threadId);
    const context = messages.data.map(msg => ({
      role: msg.role,
      content: msg.content[0]?.text?.value
    }));

    const summary = await openai.chat.completions.create({
      model: config.openai.model || "gpt-4",
      messages: [{
        role: "user",
        content: "Resuma esta conversa mantendo: produtos mencionados, links importantes e últimas 3 mensagens."
      }, ...context],
      max_tokens: 2000
    });

    return summary.choices[0].message.content.trim();
  } catch (error) {
    console.error("Erro ao resumir contexto:", error.message);
    throw error;
  }
}

export async function waitForRunCompletion(threadId, runId, maxRetries = 30, delay = 8000) {
  let retries = 0;
  const maxDelayMs = 20000; // 20 segundos máximo de espera entre tentativas
  let currentDelay = delay;
  
  while (retries < maxRetries) {
    try {
      console.log(`Verificando status do run ${runId} (tentativa ${retries + 1}/${maxRetries})`);
      const run = await openai.beta.threads.runs.retrieve(threadId, runId);
      
      if (run.status === "completed") {
        console.log(`Run ${runId} completado com sucesso`);
        return { success: true, run };
      }
      
      if (run.status === "requires_action") {
        console.log(`Run ${runId} requer ação (tool calls)`);
        await handleToolCalls(threadId, run);
      } else if (run.status === "failed") {
        console.error(`Run ${runId} falhou: ${run.last_error?.message || 'Erro desconhecido'}`);
        return { success: false, error: run.last_error };
      } else if (run.status === "cancelled") {
        console.log(`Run ${runId} foi cancelado`);
        return { success: false, error: { message: 'Run cancelado' } };
      } else if (run.status === "expired") {
        console.log(`Run ${runId} expirou`);
        return { success: false, error: { message: 'Run expirou' } };
      } else {
        console.log(`Run ${runId} em andamento, status: ${run.status}`);
      }
      
      retries++;
      // Aumenta o tempo de espera exponencialmente com limite máximo
      currentDelay = Math.min(delay * (1.5 ** retries), maxDelayMs);
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    } catch (error) {
      console.error(`Erro ao verificar run ${runId}: ${error.message}`);
      retries++;
      
      if (retries >= maxRetries) {
        console.error(`Atingido máximo de tentativas (${maxRetries}) para o run ${runId}`);
        return { success: false, error: { message: `Run não concluído após ${maxRetries} tentativas: ${error.message}` } };
      }
      
      // Aguarda antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }
  
  console.error(`Tempo máximo excedido para o run ${runId}`);
  return { success: false, error: { message: `Run não concluído após ${maxRetries} tentativas` } };
}

async function handleToolCalls(threadId, run) {
  const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
  if (!toolCalls || toolCalls.length === 0) return;

  const toolOutputs = [];

  for (const toolCall of toolCalls) {
    let output;
    
    try {
      console.log(`Tool call: ${JSON.stringify(toolCall)}`);
      
      switch(toolCall.function.name) {
        case "get_products_info":
          console.log("toolCall", toolCall);
          output = await handleProductsInfo(toolCall);
          break;
        case "get_orders_info":
          output = await handleOrdersInfo(threadId, toolCall);
          break;
        default:
          console.error(`Função não implementada: ${toolCall.function.name}`);
          output = { error: `Função ${toolCall.function.name} não implementada` };
      }

      toolOutputs.push({
        tool_call_id: toolCall.id,
        output: JSON.stringify(output || {})
      });
    } catch (error) {
      console.error(`Erro ao processar tool call ${toolCall.id}: ${error.message}`);
      toolOutputs.push({
        tool_call_id: toolCall.id,
        output: JSON.stringify({ error: error.message })
      });
    }
  }

  await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
    tool_outputs: toolOutputs
  });
}

async function handleProductsInfo(toolCall) {
  const { nomes_produtos } = JSON.parse(toolCall.function.arguments);
  console.log("nomes_produtos", nomes_produtos);
  return get_products_info(nomes_produtos);
}

async function handleOrdersInfo(threadId, toolCall) {
  console.log("Tool call:", toolCall);
  console.log("threadId:", threadId);
  const args = JSON.parse(toolCall.function.arguments);
  const { endpoint } = args;
  let order_number = args.order_number || null;
  let cpf = args.cpf || null;
  
  // Se o valor foi enviado como CPF mas parece ser um número de pedido (curto, até 10 dígitos)
  // Transfere para order_number e limpa o CPF
  if (cpf && !order_number && cpf.length <= 10 && /^\d+$/.test(cpf)) {
    console.log(`Valor '${cpf}' enviado como CPF parece ser um número de pedido. Tratando como order_number.`);
    order_number = cpf;
    cpf = null;
  }
  
  // Removendo a extração automática do número de telefone do WhatsApp
  // const phone = await extractPhoneFromContext(threadId);
  
  // Passa apenas número do pedido e CPF para getOrderByNumber
  // Não envia mais o telefone extraído do WhatsApp
  return getOrderByNumber(endpoint, order_number, null, cpf);
}

async function extractPhoneFromContext(threadId) {
  const messages = await openai.beta.threads.messages.list(threadId);
  const phoneMessage = messages.data.find(m => 
    m.content[0]?.text?.value.includes('[Phone:')
  );
  return phoneMessage?.content[0]?.text?.value.match(/\[Phone: (.*?)\]/)?.[1];
}

export async function handleDeleteThread(userId) {
  const threadId = await redisClient.get(`threadId:${userId}`);
  if (threadId) {
    await redisClient.del(`threadId:${userId}`);
    console.log(`Thread ${threadId} removido do Redis`);
  }
}