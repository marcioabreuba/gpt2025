// src/services/openaiService.js

import OpenAI from "openai";
import moment from "moment-timezone";
import config from "../config.js";
import redisClient from "../redisClient.js";
import { get_products_info } from "../services/shopifyService.js"; // Importa a função

// Cria a instância do OpenAI com a API Key
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Retorna uma saudação baseada no horário (fuso horário America/Sao_Paulo).
 */
export function getTimeBasedGreeting() {
  const now = moment().tz("America/Sao_Paulo");
  if (now.hours() < 12) {
    return "Bom dia";
  } else if (now.hours() < 18) {
    return "Boa tarde";
  } else {
    return "Boa noite";
  }
}

/**
 * Cria um novo thread no OpenAI, recebendo userId e uma mensagem inicial.
 * Ajuste se quiser usar um modelo específico (ex.: "gpt-4o-mini").
 */
export async function createThread(userId, content) {
  const thread = await openai.beta.threads.create({
    messages: [{ role: "user", content }],
    metadata: { userId }
  });
  return thread;
}

/**
 * Armazena uma mensagem no Redis, no histórico de conversa.
 */
export async function storeMessageInConversation(userId, threadId, message) {
  const key = `conversation:${userId}:${threadId}`;
  await redisClient.rPush(key, JSON.stringify(message));
}

/**
 * Adiciona uma mensagem ao thread com re-tentativas (para evitar conflito com runs ativos).
 */
export async function addMessageWithRetry(threadId, message, maxRetries = 3, delay = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: message
      });
      console.log(`Mensagem adicionada ao thread ${threadId} na tentativa ${attempt}`);
      return; // Sai da função após sucesso
    } catch (error) {
      console.error(`Tentativa ${attempt} falhou: ${error.message}`);
      if (attempt === maxRetries) {
        throw new Error(`Falha ao adicionar mensagem após ${maxRetries} tentativas: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Obtém o total de tokens usados em todos os runs de um thread.
 */
export async function getTokenUsage(threadId) {
  try {
    const runsResponse = await openai.beta.threads.runs.list(threadId);
    let totalTokens = 0;
    for (const run of runsResponse.data) {
      if (run.usage && run.usage.total_tokens) {
        totalTokens += run.usage.total_tokens;
      }
    }
    console.log(`Total de tokens no thread ${threadId}: ${totalTokens}`);
    return totalTokens;
  } catch (error) {
    console.error(`Erro ao obter uso de tokens para o thread ${threadId}: ${error.message}`);
    throw error;
  }
}

/**
 * Gera um resumo do contexto do thread, chamando o modelo do OpenAI.
 */
export async function summarizeContext(threadId) {
  try {
    const messagesResponse = await openai.beta.threads.messages.list(threadId);
    const contextMessages = messagesResponse.data.map(msg => ({
      role: msg.role,
      content: msg.content[0].text.value
    }));

    const summaryResponse = await openai.chat.completions.create({
      model: config.openai.model || "gpt-4",
      messages: [
        {
          role: "user",
          content: "Resuma essa conversa. Inclua os nomes dos produtos, links, estoque e, ao final, as últimas 3 mensagens do usuário, sendo que a última deve ser a mais recente."
        },
        ...contextMessages
      ],
      max_tokens: 4000
    });

    return summaryResponse.choices[0].message.content.trim();
  } catch (error) {
    console.error("Erro ao resumir o contexto:", error.message);
    throw error;
  }
}

/**
 * Aguarda a conclusão de um run no OpenAI, re-tentando até maxRetries.
 * Se o modelo chamar a função "get_products_info", chamamos a função real
 * e retornamos o JSON ao modelo, para que ele possa responder ao usuário.
 */
export async function waitForRunCompletion(threadId, runId, maxRetries = 30, delay = 8000) {
  let retries = 0;
  let run;

  while (retries < maxRetries) {
    try {
      run = await openai.beta.threads.runs.retrieve(threadId, runId);

      if (run.status === "completed") {
        console.log(`Run ${runId} concluído com sucesso.`);
        return run;
      } else if (run.status === "requires_action") {
        const toolCall = run.required_action.submit_tool_outputs.tool_calls[0];
        if (toolCall && toolCall.function.name === "get_products_info") {
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (parseError) {
            console.error("Erro ao parsear arguments:", parseError.message);
          }

          const endpoint = args.endpoint || "";
          console.log("Chamando get_products_info com endpoint:", endpoint);

          // Chama a função real que obtém produtos da sua loja
          const productInfo = await get_products_info(endpoint);

          // Submete o resultado ao run
          await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
            tool_outputs: [
              {
                tool_call_id: toolCall.id,
                output: JSON.stringify(productInfo)
              }
            ]
          });
        }
      }
    } catch (error) {
      console.error("Erro ao recuperar run:", error.message);
      throw error;
    }

    console.log(`Tentativa ${retries} para o run ${runId}: status = ${run?.status}`);
    retries++;
    // Aguarda cada vez mais tempo (ex.: linear ou exponencial)
    await new Promise(resolve => setTimeout(resolve, delay * retries));
  }

  throw new Error(`Run ${runId} não concluído após ${maxRetries} tentativas.`);
}

/**
 * Apaga o thread do ponto de vista do seu sistema, removendo-o do Redis.
 * (A API atual não permite deletar o thread no OpenAI.)
 */
export async function handleDeleteThread(userId) {
  const threadId = await redisClient.get(`threadId:${userId}`);
  if (threadId) {
    try {
      console.log(`Removendo thread ${threadId} do Redis. (A API do OpenAI não permite deletar threads atualmente.)`);
      await redisClient.del(`threadId:${userId}`);
    } catch (error) {
      console.error(`Erro ao remover thread do Redis:`, error.message);
    }
  }
}
