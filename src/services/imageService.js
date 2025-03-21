// Serviço otimizado para download e processamento de imagens, incluindo a geração de uma descrição usando OpenAI

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Faz o download da imagem a partir de uma URL e salva localmente.
 * @param {string} url - URL da imagem.
 * @returns {Promise<string>} - Caminho para o arquivo da imagem baixada.
 */
export async function downloadImage(url) {
  try {
    const imagePath = path.join(__dirname, `../temp/image_${Date.now()}.jpg`);
    
    // Garantir que a pasta temp existe
    const tempDir = path.dirname(imagePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const writer = fs.createWriteStream(imagePath);
    
    // Configurando cabeçalhos para autenticação no Z-API
    const headers = {};
    
    // Adicionar Client-Token da Z-API para autenticação
    if (config.zapi.clientToken) {
      headers['Client-Token'] = config.zapi.clientToken;
    }
    
    // Para URLs do backblaze (storage da Z-API) pode ser necessário um token adicional
    // Se o url contém backblazeb2.com ou temp-file-download
    if (url.includes('backblazeb2.com') || url.includes('temp-file-download')) {
      // Pode ser necessário usar um token específico dependendo da configuração do Z-API
      // headers['Authorization'] = `Bearer ${config.zapi.token}`;
      
      // Ou, alternativamente, tentar acessar através da API do Z-API
      // Modificar a URL para usar o endpoint de mídia do Z-API
      const mediaId = url.split('/').pop().split('==.')[0] + '==';
      url = `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.token}/media/${mediaId}`;
    }
    
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers
    });
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(imagePath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Erro ao baixar imagem:', error);
    throw new Error('Falha no download da imagem');
  }
}

/**
 * Envia a imagem para a API do OpenAI e obtém uma descrição.
 * @param {string} imagePath - Caminho local da imagem.
 * @param {string} caption - Legenda adicional (opcional).
 * @returns {Promise<string>} - Descrição retornada pela API.
 */
export async function describeImage(imagePath, caption = '') {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: `Descreva a imagem enviada pelo usuário. ${caption}` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
      }
    ];

    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      max_tokens: 1000
    });

    return response.choices[0]?.message?.content || 'Descrição não disponível';
  } catch (error) {
    console.error('Erro ao descrever imagem:', error);
    throw new Error('Falha ao processar a descrição da imagem');
  }
}

/**
 * Analisa uma imagem e determina o tipo de conteúdo (produto, comprovante, etc.)
 * @param {string} imagePath - Caminho local da imagem.
 * @returns {Promise<Object>} - Tipo de imagem e detalhes identificados.
 */
export async function analyzeImageContent(imagePath) {
  try {
    console.log("🔍 INÍCIO: Analisando conteúdo da imagem com GPT-4o...");
    console.log("📄 Imagem sendo analisada:", imagePath);
    
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Usando um prompt específico para identificar o tipo de imagem e extrair texto visível
    const messages = [
      {
        role: "user",
        content: [
          { 
            type: "text", 
            text: "Analise esta imagem com ATENÇÃO ESPECIAL a qualquer TEXTO ou NOME visível nela. Identifique se é: 1) Um produto (qual categoria e NOME EXATO do produto se visível na imagem), 2) Um comprovante de pagamento (extraia data, valor e ID), ou 3) Outro tipo. Se for um produto, busque cuidadosamente qualquer nome ou identificador do produto que esteja escrito/impresso na imagem. Retorne em formato JSON com a estrutura: {tipo: 'produto|comprovante|outro', detalhes: {...}}" 
          },
          { 
            type: "image_url", 
            image_url: { url: `data:image/jpeg;base64,${base64Image}` } 
          }
        ]
      }
    ];

    console.log("📤 Enviando imagem para análise com GPT-4o...");
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" }
    });

    console.log("📥 Resposta recebida do GPT-4o");
    
    const analysisResult = JSON.parse(response.choices[0]?.message?.content || '{"tipo":"outro"}');
    
    // Log específico para mostrar o tipo de conteúdo identificado
    console.log(`🏷️ Tipo de conteúdo identificado: ${analysisResult.tipo}`);
    
    // Log detalhado para produtos
    if (analysisResult.tipo === "produto") {
      console.log("🛍️ PRODUTO DETECTADO nas seguintes informações:");
      console.log("📝 Categoria:", analysisResult.detalhes?.categoria || "Não especificada");
      console.log("📝 Nome do produto:", analysisResult.detalhes?.nome || "Não encontrado");
      console.log("📝 Descrição:", analysisResult.detalhes?.descricao || "Não disponível");
      
      // Adicionar campo de nome para compatibilidade se não existir
      if (!analysisResult.detalhes.nome && analysisResult.detalhes.descricao) {
        // Verificar se a descrição parece conter um nome de produto
        const possibleName = analysisResult.detalhes.descricao.split('.')[0].trim();
        if (possibleName.length < 50) { // Se for curto o suficiente para ser um nome
          console.log("🔄 Extraindo possível nome do produto da descrição:", possibleName);
          analysisResult.detalhes.nome = possibleName;
        }
      }
    }
    
    console.log("📊 Resultado completo da análise:", JSON.stringify(analysisResult, null, 2));
    return analysisResult;
  } catch (error) {
    console.error('❌ Erro ao analisar conteúdo da imagem:', error);
    return { tipo: "erro", detalhes: error.message };
  }
}

/**
 * Processa imagem de produto: busca produtos similares no catálogo
 * @param {string} productCategory - Categoria do produto identificado
 * @param {string} description - Descrição detalhada do produto
 * @returns {Promise<string>} - Links para produtos similares
 */
export async function findSimilarProducts(productCategory, description) {
  try {
    // Recuperar produtos do catálogo via API do Shopify
    const productsResponse = await getProductsByCategory(productCategory);
    
    // Usar a IA para encontrar os mais similares com base na descrição
    const messages = [
      {
        role: "user",
        content: `Tenho um catálogo com ${productsResponse.length} produtos. 
                  Um cliente enviou uma imagem de um produto descrito como: "${description}".
                  Encontre os 3 produtos mais similares neste catálogo:
                  ${JSON.stringify(productsResponse)}`
      }
    ];
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages
    });
    
    return response.choices[0]?.message?.content || 'Não encontrei produtos similares.';
  } catch (error) {
    console.error('Erro ao buscar produtos similares:', error);
    return 'Não foi possível encontrar produtos similares no momento.';
  }
}

/**
 * Processa a imagem: faz o download, obtém a descrição e remove o arquivo temporário.
 * @param {string} imageUrl - URL da imagem.
 * @param {string} caption - Legenda adicional (opcional).
 * @returns {Promise<string>} - Descrição da imagem.
 */
export async function processImage(imageUrl, caption = '') {
  let imagePath;
  try {
    imagePath = await downloadImage(imageUrl);
    
    // Analisar o tipo de conteúdo da imagem
    const analysis = await analyzeImageContent(imagePath);
    
    // Processar de acordo com o tipo
    if (analysis.tipo === 'produto') {
      // Se o cliente está procurando um produto
      const productInfo = await findSimilarProducts(
        analysis.detalhes.categoria, 
        analysis.detalhes.descricao
      );
      
      return `[Imagem de produto] ${analysis.detalhes.descricao}. 
              Produtos similares encontrados: ${productInfo}`;
              
    } else if (analysis.tipo === 'comprovante') {
      // Se for um comprovante de pagamento
      return `[Comprovante de pagamento] 
              Data: ${analysis.detalhes.data}, 
              Valor: ${analysis.detalhes.valor}, 
              ID Transação: ${analysis.detalhes.id}`;
              
    } else {
      // Descrição genérica para outros tipos de imagem
      const basicDescription = await describeImage(imagePath, caption);
      return basicDescription;
    }
    
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    throw new Error('Erro no processamento da imagem');
  } finally {
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
}
