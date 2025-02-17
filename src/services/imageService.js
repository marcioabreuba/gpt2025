// Serviço para download e processamento de imagens, incluindo a geração de uma descrição usando OpenAI

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Faz o download da imagem a partir de uma URL e salva localmente.
 * @param {string} url - URL da imagem.
 * @returns {string} - Caminho para o arquivo da imagem baixada.
 */
export async function downloadImage(url) {
  const imagePath = path.join(__dirname, 'temp_image.jpg');
  const writer = fs.createWriteStream(imagePath);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
      Authorization: `Bearer ${config.graphApiToken}`
    }
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(imagePath));
    writer.on('error', reject);
  });
}

/**
 * Envia a imagem para a API do OpenAI e obtém uma descrição da imagem.
 * @param {string} imagePath - Caminho local da imagem.
 * @param {string} caption - Legenda adicional (opcional).
 * @returns {string} - Descrição retornada pela API.
 */
export async function describeImage(imagePath, caption) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Eu sou uma IA intermediária que faz descrição de imagens. Aqui está a descrição da imagem enviada pelo usuário. ${caption}`
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`
          }
        }
      ]
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      max_tokens: 2000
    });
    console.log("Descrição da imagem:", response.choices[0].message.content);
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Erro ao descrever imagem:", error);
    throw error;
  }
}

/**
 * Processa a imagem: faz o download, obtém a descrição e remove o arquivo temporário.
 * @param {string} imageUrl - URL da imagem.
 * @param {string} caption - Legenda adicional (opcional).
 * @returns {string} - Descrição da imagem.
 */
export async function processImage(imageUrl, caption) {
  try {
    const imagePath = await downloadImage(imageUrl);
    const description = await describeImage(imagePath, caption);
    fs.unlinkSync(imagePath); // Remove o arquivo temporário após o processamento
    return description;
  } catch (error) {
    console.error("Erro ao processar imagem:", error);
    throw error;
  }
}
