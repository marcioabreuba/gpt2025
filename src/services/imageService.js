// Serviço otimizado para download e processamento de imagens, incluindo a geração de uma descrição usando OpenAI

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import OpenAI from "openai";
import sharp from 'sharp'; // Importar a biblioteca Sharp

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
    console.log("📥 Iniciando download da imagem de:", url);
    const imagePath = path.join(__dirname, `../temp/image_${Date.now()}.jpg`);
    
    // Garantir que a pasta temp existe
    const tempDir = path.dirname(imagePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Determinar se é uma URL do Backblaze/Z-API
    if (url.includes('backblazeb2.com') || url.includes('temp-file-download')) {
      console.log("🔄 Detectada URL de mídia do Z-API, usando método direto...");
      
      // MÉTODO 1: Direto do servidor de mídia Backblaze
      try {
        console.log("🔄 Tentativa 1: Download direto da Backblaze");
        const response = await axios({
          url: url,
          method: 'GET',
          responseType: 'arraybuffer',
          headers: {
            'Accept': 'image/*'
          },
          timeout: 30000,
        });
        
        // Verificar se recebemos dados de imagem
        if (response.data && response.data.length > 1000) {  // mínimo de 1KB
          fs.writeFileSync(imagePath, Buffer.from(response.data));
          console.log(`✅ Download direto bem-sucedido (${response.data.length} bytes)`);
          return imagePath;
        } else {
          console.log(`⚠️ Resposta muito pequena: ${response.data?.length || 0} bytes`);
          throw new Error("Arquivo de mídia recebido muito pequeno");
        }
      } catch (error) {
        console.warn("⚠️ Falha no download direto:", error.message);
        // Continuar para o próximo método
      }
      
      // MÉTODO 2: Através da API Z-API usando mediaId
      try {
        console.log("🔄 Tentativa 2: Download via API Z-API");
        
        // Extrair o mediaId da URL
        let mediaId;
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1];
        
        if (filename.includes('==.')) {
          mediaId = filename.split('==.')[0] + '==';
        } else if (filename.includes('==')) {
          mediaId = filename;
        } else {
          mediaId = filename.replace(/\.[^/.]+$/, ""); // Remove extensões
        }
        
        console.log("🔑 MediaID extraído:", mediaId);
        
        // URL da API Z-API
        const apiUrl = `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.token}/media/${mediaId}`;
        console.log("🌐 URL da API Z-API:", apiUrl);
        
        const response = await axios({
          url: apiUrl,
          method: 'GET',
          responseType: 'arraybuffer',
          headers: {
            'Client-Token': config.zapi.clientToken
          },
          timeout: 30000
        });
        
        // Verificar se recebemos dados de imagem
        if (response.data && response.data.length > 1000) {
          fs.writeFileSync(imagePath, Buffer.from(response.data));
          console.log(`✅ Download via Z-API bem-sucedido (${response.data.length} bytes)`);
          return imagePath;
        } else {
          console.log(`⚠️ Resposta muito pequena: ${response.data?.length || 0} bytes`);
          throw new Error("Arquivo de mídia recebido muito pequeno");
        }
      } catch (error) {
        console.warn("⚠️ Falha no download via Z-API:", error.message);
        // Continuar para o próximo método
      }
      
      // MÉTODO 3: Último recurso - usar fetch com URL raw
      try {
        console.log("🔄 Tentativa 3: Download via fetch como último recurso");
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
        }
        
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 1000) {
          throw new Error(`Arquivo muito pequeno: ${buffer.byteLength} bytes`);
        }
        
        fs.writeFileSync(imagePath, Buffer.from(buffer));
        console.log(`✅ Download via fetch bem-sucedido (${buffer.byteLength} bytes)`);
        return imagePath;
      } catch (error) {
        console.error("❌ Todas as tentativas de download falharam:", error.message);
        throw new Error("Falha em todos os métodos de download");
      }
    } else {
      // URL normal (não Z-API)
      console.log("🔄 URL normal detectada, usando método padrão");
      
      try {
        const response = await axios({
          url: url,
          method: 'GET',
          responseType: 'arraybuffer',
          timeout: 30000
        });
        
        if (response.data && response.data.length > 1000) {
          fs.writeFileSync(imagePath, Buffer.from(response.data));
          console.log(`✅ Download padrão bem-sucedido (${response.data.length} bytes)`);
          return imagePath;
        } else {
          throw new Error(`Arquivo muito pequeno: ${response.data?.length || 0} bytes`);
        }
      } catch (error) {
        console.error("❌ Erro no download padrão:", error.message);
        throw error;
      }
    }
  } catch (error) {
    console.error('❌ ERRO FATAL no download da imagem:', error);
    throw new Error(`Falha no download da imagem: ${error.message}`);
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
  let processedImagePath = null;
  
  try {
    console.log("🔍 INÍCIO: Analisando conteúdo da imagem com GPT-4o...");
    console.log("📄 Imagem sendo analisada:", imagePath);
    
    // Verificar se o arquivo existe e é válido
    try {
      const stats = fs.statSync(imagePath);
      if (stats.size < 1000) { // Mínimo de 1KB para ser uma imagem válida
        throw new Error(`Arquivo de imagem muito pequeno (${stats.size} bytes). Provavelmente corrompido.`);
      }
    } catch (fileError) {
      console.error("❌ Erro ao verificar arquivo:", fileError.message);
      throw new Error("Arquivo de imagem inválido ou inacessível");
    }
    
    // Processar e converter a imagem para um formato compatível (JPEG)
    try {
      // Criar nome para imagem processada
      processedImagePath = path.join(__dirname, `../temp/processed_${Date.now()}.jpg`);
      console.log("🔄 Convertendo imagem para formato compatível...");
      
      // Usar Sharp para converter para JPEG
      await sharp(imagePath)
        .jpeg({ quality: 90 })
        .toFile(processedImagePath);
        
      console.log("✅ Imagem convertida com sucesso para:", processedImagePath);
      
      // Verificar se a imagem processada é válida
      const processedStats = fs.statSync(processedImagePath);
      if (processedStats.size < 1000) {
        throw new Error(`Imagem processada muito pequena (${processedStats.size} bytes)`);
      }
    } catch (conversionError) {
      console.error("⚠️ Erro na conversão da imagem:", conversionError);
      console.log("⚠️ Usando imagem original sem conversão");
      processedImagePath = imagePath; // Usar a original se a conversão falhar
    }
    
    // MÉTODO ALTERNATIVO: Se a imagem original for URL do Backblaze, usar URL diretamente
    if (processedImagePath === imagePath && (imagePath.includes('backblaze') || imagePath.includes('temp-file-download'))) {
      console.log("🔄 Tentando usar a URL da imagem diretamente com a API OpenAI...");
      
      // Se a imagem local falhou e é do tipo URL externa, tentar usar URL diretamente
      try {
        // Aqui usamos a URL diretamente em vez da imagem local
        const imageUrl = imagePath;
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
                image_url: { url: imageUrl } 
              }
            ]
          }
        ];
        
        console.log("📤 Enviando URL da imagem para análise com GPT-4o...");
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          response_format: { type: "json_object" }
        });
        
        console.log("📥 Resposta recebida do GPT-4o via URL");
        
        const analysisResult = JSON.parse(response.choices[0]?.message?.content || '{"tipo":"outro"}');
        
        console.log(`🏷️ Tipo de conteúdo identificado via URL: ${analysisResult.tipo}`);
        return analysisResult;
      } catch (urlAnalysisError) {
        console.error("❌ Erro ao analisar imagem via URL:", urlAnalysisError);
        throw new Error("Falha no processamento da imagem, tanto local quanto via URL");
      }
    }
    
    // Usar a imagem processada
    const imageBuffer = fs.readFileSync(processedImagePath);
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
  } finally {
    // Limpar imagem processada se diferente da original
    if (processedImagePath && processedImagePath !== imagePath && fs.existsSync(processedImagePath)) {
      try {
        fs.unlinkSync(processedImagePath);
        console.log("🧹 Arquivo temporário de conversão removido");
      } catch (cleanupError) {
        console.error("⚠️ Erro ao remover arquivo temporário:", cleanupError);
      }
    }
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
