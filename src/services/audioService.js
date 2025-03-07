import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import config from '../config.js';
import { getChat } from './conversationService.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Faz o download do arquivo de áudio a partir da URL.
 * @param {string} url - URL do arquivo de áudio.
 * @returns {Promise<string>} - Caminho para o arquivo de áudio baixado.
 */
export async function downloadAudio(url) {
  try {
    const audioPath = path.join(__dirname, `../temp/audio_${Date.now()}.ogg`);
    
    // Garantir que a pasta temp existe
    const tempDir = path.dirname(audioPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const writer = fs.createWriteStream(audioPath);
    
    // Adiciona cabeçalhos de autenticação para Z-API, se necessário
    const headers = {};
    if (config.zapi.clientToken) {
      headers['Client-Token'] = config.zapi.clientToken;
    }

    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(audioPath));
      writer.on('error', reject);
    });
  } catch (error) {
    logger.error('Erro ao baixar áudio:', error);
    throw new Error('Falha no download do áudio');
  }
}

/**
 * Transcreve um arquivo de áudio para texto usando a API Whisper da OpenAI.
 * @param {string} audioPath - Caminho para o arquivo de áudio.
 * @returns {Promise<string>} - Texto transcrito.
 */
export async function transcribeAudio(audioPath) {
  try {
    logger.info(`Iniciando transcrição do áudio: ${audioPath}`);
    
    const audioFile = fs.createReadStream(audioPath);
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "pt", // Define português como idioma para melhor precisão
      response_format: "text"
    });
    
    logger.info(`Áudio transcrito com sucesso: "${transcription}"`);
    return transcription;
  } catch (error) {
    logger.error('Erro na transcrição do áudio:', error);
    throw new Error('Falha ao transcrever áudio');
  }
}

/**
 * Processa uma mensagem de áudio: baixa, transcreve e envia para processamento.
 * @param {string} userId - ID do usuário/chat.
 * @param {string} phone - Número de telefone do usuário.
 * @param {string} audioUrl - URL do arquivo de áudio.
 * @returns {Promise<void>}
 */
export async function processAudioMessage(userId, phone, audioUrl) {
  let audioPath;
  try {
    logger.info(`Processando áudio do usuário ${phone}: ${audioUrl}`);
    
    // 1. Download do áudio
    audioPath = await downloadAudio(audioUrl);
    
    // 2. Transcrição do áudio para texto
    const transcription = await transcribeAudio(audioPath);
    
    // 3. Adicione a mensagem transcrita ao log (apenas uma vez)
    // Nota: O log de [ÁUDIO] já é feito no webhook
    // O conteúdo específico da transcrição é registrado aqui
    if (transcription) {
      // Registramos apenas em debug para evitar poluição do log principal
      logger.debug(`Transcrição do áudio: ${transcription}`);
    }
    
    // 4. Processa o texto transcrito como uma mensagem normal
    await getChat(userId, phone, transcription);
    
  } catch (error) {
    logger.error('Erro ao processar mensagem de áudio:', error);
    throw new Error('Erro no processamento da mensagem de áudio');
  } finally {
    // Limpa o arquivo temporário
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      logger.debug(`Arquivo temporário removido: ${audioPath}`);
    }
  }
} 