import { get_products_info_by_image } from "./shopifyService.js";
import { analyzeImageContent } from "./imageService.js";
import fs from 'fs';
import { downloadImage } from "./imageService.js";
import logger from '../utils/logger.js';

export async function processImage(imageUrl) {
  try {
    console.log("🔍 INÍCIO DO PROCESSAMENTO - servidorImagem.js");
    console.log("🔗 URL da imagem recebida:", imageUrl);
    
    // Primeiro, vamos tentar analisar o conteúdo da imagem para extrair texto
    let imagePath;
    let textAnalysis = null;
    
    try {
      imagePath = await downloadImage(imageUrl);
      console.log("📥 Imagem baixada com sucesso em:", imagePath);
      
      // Tentar extrair texto/informações da imagem usando GPT-4o
      textAnalysis = await analyzeImageContent(imagePath);
      console.log("📝 ANÁLISE DE TEXTO DA IMAGEM:", JSON.stringify(textAnalysis, null, 2));
      
      // Ver se há nome de produto na análise
      if (textAnalysis.tipo === 'produto' && textAnalysis.detalhes?.nome) {
        console.log("✅ NOME DE PRODUTO ENCONTRADO NO TEXTO:", textAnalysis.detalhes.nome);
      }
    } catch (error) {
      console.error("❌ Erro ao analisar texto da imagem:", error.message);
    } finally {
      // Limpar arquivo temporário
      if (imagePath && fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Busca produtos similares na imagem (usando embeddings visuais)
    console.log("🔍 Iniciando busca por similaridade visual...");
    const visualSearchResults = await get_products_info_by_image(imageUrl, textAnalysis);
    console.log("🎯 RESULTADO FINAL DA BUSCA VISUAL:", visualSearchResults.substring(0, 100) + "...");
    
    // Comparar resultado de busca visual com análise de texto (se disponível)
    if (textAnalysis && textAnalysis.tipo === 'produto') {
      console.log("⚖️ COMPARAÇÃO: Texto extraído vs. Busca visual");
      console.log("📝 Texto sugeriu:", textAnalysis.detalhes?.nome || textAnalysis.detalhes?.descricao || "N/A");
      console.log("🖼️ Busca visual encontrou produto com título que contém:", 
                  visualSearchResults.includes("Título:") ? 
                  visualSearchResults.split("Título:")[1].split(".")[0] : "Não encontrado");
    }
    
    console.log("🏁 FIM DO PROCESSAMENTO - servidorImagem.js");
    return visualSearchResults;
  } catch (error) {
    console.error('❌ ERRO GERAL no processamento da imagem:', error);
    throw new Error('Erro no processamento da imagem');
  }
}
