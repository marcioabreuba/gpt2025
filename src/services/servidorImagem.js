import { get_products_info_by_image } from "./shopifyService";

export async function processImage(imageUrl) {
  try {
    // Busca produtos similares na imagem
    const basicDescription = await get_products_info_by_image(imageUrl);
    return basicDescription;
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    throw new Error('Erro no processamento da imagem');
  }
}
