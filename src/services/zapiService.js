// Serviço para enviar mensagens via Z-API (por exemplo, para WhatsApp)

import axios from 'axios';
import config from '../config.js';

/**
 * Envia uma mensagem para um número de telefone utilizando a Z-API.
 * @param {string} phone - Número de telefone de destino.
 * @param {string} message - Conteúdo da mensagem.
 */
export async function sendReplyZAPI(phone, message) {
  try {
    const url = `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.token}/send-text`;
    const payload = { phone, message };
    const response = await axios.post(url, payload, {
      headers: { "Client-Token": config.zapi.clientToken }
    });
    console.log("Resposta enviada via Z-API:", response.data);
  } catch (error) {
    const errMsg = error.response?.data || error.message;
    console.error("Erro ao enviar mensagem via Z-API:", errMsg);
  }
}
