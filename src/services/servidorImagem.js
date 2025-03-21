import { get_products_info_by_image } from "./shopifyService.js";
import { analyzeImageContent, downloadImage } from "./imageService.js";
import fs from 'fs';
import logger from '../utils/logger.js';

export async function processImage(imageUrl) {
  try {
    console.log("🔍 INÍCIO DO PROCESSAMENTO - servidorImagem.js");
    console.log("🔗 URL da imagem recebida:", imageUrl);
    
    // Primeiro, vamos tentar analisar o conteúdo da imagem para extrair texto
    let imagePath = null;
    let textAnalysis = null;
    let textExtractionSuccess = false;
    
    try {
      // Baixar a imagem com tratamento de erro aprimorado
      try {
        imagePath = await downloadImage(imageUrl);
        console.log("📥 Imagem baixada com sucesso em:", imagePath);
        
        // Verificar se o arquivo tem tamanho válido
        const stats = fs.statSync(imagePath);
        if (stats.size < 1000) { // Se arquivo for muito pequeno
          console.warn(`⚠️ Arquivo de imagem baixado é muito pequeno: ${stats.size} bytes. Pode estar corrompido.`);
        }
      } catch (downloadError) {
        console.error("❌ Erro ao baixar imagem:", downloadError.message);
        // Não abortar, tentar analisar diretamente com a URL
        console.log("🔍 Tentando analisar a imagem diretamente pela URL");
        // Nesse caso, passamos a URL como imagePath
        imagePath = imageUrl;
      }
      
      // Tentar extrair texto/informações da imagem usando GPT-4o
      textAnalysis = await analyzeImageContent(imagePath);
      console.log("📝 ANÁLISE DE TEXTO DA IMAGEM:", JSON.stringify(textAnalysis, null, 2));
      
      // Verificar se a análise foi bem-sucedida (não é um erro)
      if (textAnalysis.tipo !== 'erro') {
        textExtractionSuccess = true;
        
        // Ver se há nome de produto na análise
        if (textAnalysis.tipo === 'produto' && (textAnalysis.detalhes?.nome_exato || textAnalysis.detalhes?.nome)) {
          const productName = textAnalysis.detalhes?.nome_exato || textAnalysis.detalhes?.nome;
          console.log("✅ NOME DE PRODUTO ENCONTRADO NO TEXTO:", productName);
          console.log("🔍 Este nome será usado prioritariamente na busca de produtos");
        }
      } else {
        console.log("⚠️ Análise de texto falhou, mas continuaremos com busca visual");
      }
    } catch (error) {
      console.error("❌ Erro ao analisar texto da imagem:", error.message);
      console.log("⚠️ Prosseguindo com busca visual mesmo assim");
    } finally {
      // Limpar arquivo temporário somente se não for a URL original
      if (imagePath && imagePath !== imageUrl && fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
          console.log("🧹 Arquivo temporário de imagem removido");
        } catch (cleanupError) {
          console.error("⚠️ Erro ao remover arquivo temporário:", cleanupError);
        }
      }
    }

    // Busca produtos similares na imagem (usando embeddings visuais)
    console.log("🔍 Iniciando busca por produtos...");
    const searchResults = await get_products_info_by_image(imageUrl, textAnalysis);
    console.log("🎯 RESULTADO FINAL DA BUSCA:", 
              searchResults.substring(0, 150) + 
              (searchResults.length > 150 ? "..." : ""));
    
    // Comparar resultado de busca visual com análise de texto (se disponível)
    if (textExtractionSuccess && textAnalysis.tipo === 'produto') {
      const productName = textAnalysis.detalhes?.nome_exato || textAnalysis.detalhes?.nome;
      console.log("⚖️ COMPARAÇÃO: Texto extraído vs. Resultado final");
      console.log("📝 Texto extraído sugeriu:", productName || "N/A");
      
      // Verificar se o resultado contém a indicação de busca por texto bem-sucedida
      if (searchResults.includes("🏷️ Produto identificado pelo nome:")) {
        console.log("✅ SUCESSO: Produto encontrado usando o nome extraído do texto");
      } else if (searchResults.includes("🖼️ Produto similar encontrado por BUSCA VISUAL")) {
        console.log("ℹ️ Nome extraído não encontrou resultados, mas busca visual encontrou similares");
      }
    }
    
    console.log("🏁 FIM DO PROCESSAMENTO - servidorImagem.js");
    return searchResults;
  } catch (error) {
    console.error('❌ ERRO GERAL no processamento da imagem:', error);
    logger.error('Erro detalhado no processamento de imagem:', error);
    throw new Error('Erro no processamento da imagem');
  }
}
