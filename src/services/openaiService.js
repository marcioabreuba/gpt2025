import OpenAI from "openai";
import moment from "moment-timezone";
import config from "../config.js";
import redisClient from "../redisClient.js";
import { get_products_info } from "../services/shopifyService.js";
import { getOrderByNumber } from "../services/shopifyOrdersService.js";

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

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

export async function storeMessageInConversation(userId, threadId, message) {
  const key = `conversation:${userId}:${threadId}`;
  await redisClient.rPush(key, JSON.stringify(message));
}

export async function addMessageWithRetry(threadId, message, maxRetries = 3, delay = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: message
      });
      console.log(`Mensagem adicionada ao thread ${threadId} na tentativa ${attempt}`);
      return;
    } catch (error) {
      console.error(`Tentativa ${attempt} falhou: ${error.message}`);
      if (attempt === maxRetries) throw new Error(`Falha após ${maxRetries} tentativas: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
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
  while (retries++ < maxRetries) {
    try {
      const run = await openai.beta.threads.runs.retrieve(threadId, runId);
      
      if (run.status === "completed") return run;
      if (run.status === "requires_action") {
        await handleToolCalls(threadId, run);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay * retries));
    } catch (error) {
      console.error(`Erro no run ${runId}: ${error.message}`);
      if (retries === maxRetries) throw new Error(`Run não concluído após ${maxRetries} tentativas`);
    }
  }
}

async function handleToolCalls(threadId, run) {
  const toolCall = run.required_action.submit_tool_outputs.tool_calls[0];
  if (!toolCall) return;

  let output;
  switch(toolCall.function.name) {
    case "get_products_info":
      output = await handleProductsInfo(toolCall);
      break;
    case "get_orders_info":
      output = await handleOrdersInfo(threadId, toolCall);
      break;
    default:
      throw new Error(`Função não implementada: ${toolCall.function.name}`);
  }

  await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
    tool_outputs: [{
      tool_call_id: toolCall.id,
      output: JSON.stringify(output)
    }]
  });
}

async function handleProductsInfo(toolCall) {
  const { endpoint } = JSON.parse(toolCall.function.arguments);
  return get_products_info(endpoint);
}

async function handleOrdersInfo(threadId, toolCall) {
  console.log("Tool call:", toolCall);
  console.log("threadId:", threadId);
  const { endpoint, order_number, cpf } = JSON.parse(toolCall.function.arguments);
  const phone = await extractPhoneFromContext(threadId);
  return getOrderByNumber(endpoint, order_number || cpf, phone);
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