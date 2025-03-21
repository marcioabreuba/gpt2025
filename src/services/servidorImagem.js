import { get_products_info_by_image } from "./shopifyService.js";
import { analyzeImageContent, downloadImage } from "./imageService.js";
import fs from 'fs';
import logger from '../utils/logger.js';

export async function processImage(imageUrl) {
  try {
    console.log("🔍 INÍCIO DO PROCESSAMENTO - servidorImagem.js");
    console.log("🔗 URL da imagem recebida:", imageUrl);
    
    // Primeiro, vamos tentar analisar o conteúdo da imagem para extrair texto
    let imagePath;
    let textAnalysis = null;
    let textExtractionSuccess = false;
    
    try {
      // Baixar a imagem com tratamento de erro aprimorado
      imagePath = await downloadImage(imageUrl);
      console.log("📥 Imagem baixada com sucesso em:", imagePath);
      
      // Verificar se o arquivo existe e tem tamanho válido
      const stats = fs.statSync(imagePath);
      if (stats.size < 100) { // Se arquivo for muito pequeno, provavelmente está corrompido
        throw new Error(`Arquivo de imagem inválido ou muito pequeno: ${stats.size} bytes`);
      }
      
      // Tentar extrair texto/informações da imagem usando GPT-4o
      textAnalysis = await analyzeImageContent(imagePath);
      console.log("📝 ANÁLISE DE TEXTO DA IMAGEM:", JSON.stringify(textAnalysis, null, 2));
      
      // Verificar se a análise foi bem-sucedida (não é um erro)
      if (textAnalysis.tipo !== 'erro') {
        textExtractionSuccess = true;
        
        // Ver se há nome de produto na análise
        if (textAnalysis.tipo === 'produto' && textAnalysis.detalhes?.nome) {
          console.log("✅ NOME DE PRODUTO ENCONTRADO NO TEXTO:", textAnalysis.detalhes.nome);
        }
      } else {
        console.log("⚠️ Análise de texto falhou, mas continuaremos com busca visual");
      }
    } catch (error) {
      console.error("❌ Erro ao analisar texto da imagem:", error.message);
      console.log("⚠️ Prosseguindo com busca visual mesmo assim");
    } finally {
      // Limpar arquivo temporário
      if (imagePath && fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
          console.log("🧹 Arquivo temporário de imagem removido");
        } catch (cleanupError) {
          console.error("⚠️ Erro ao remover arquivo temporário:", cleanupError);
        }
      }
    }

    // Busca produtos similares na imagem (usando embeddings visuais)
    console.log("🔍 Iniciando busca por similaridade visual...");
    const visualSearchResults = await get_products_info_by_image(imageUrl, textAnalysis);
    console.log("🎯 RESULTADO FINAL DA BUSCA VISUAL:", 
              visualSearchResults.substring(0, 150) + 
              (visualSearchResults.length > 150 ? "..." : ""));
    
    // Comparar resultado de busca visual com análise de texto (se disponível)
    if (textExtractionSuccess && textAnalysis.tipo === 'produto') {
      console.log("⚖️ COMPARAÇÃO: Texto extraído vs. Busca visual");
      console.log("📝 Texto sugeriu:", textAnalysis.detalhes?.nome || textAnalysis.detalhes?.descricao || "N/A");
      console.log("🖼️ Busca visual encontrou produto com título que contém:", 
                  visualSearchResults.includes("Título:") ? 
                  visualSearchResults.split("Título:")[1].split(".")[0] : "Não encontrado");
      
      // TODO: Futura implementação - combinar resultados de texto e visual para melhorar a precisão
    }
    
    console.log("🏁 FIM DO PROCESSAMENTO - servidorImagem.js");
    return visualSearchResults;
  } catch (error) {
    console.error('❌ ERRO GERAL no processamento da imagem:', error);
    logger.error('Erro detalhado no processamento de imagem:', error);
    throw new Error('Erro no processamento da imagem');
  }
}
