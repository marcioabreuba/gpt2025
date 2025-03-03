const axios = require('axios');

/**
 * Função para gerar embeddings de imagem usando Jina AI
 */
async function embeddingImage(imageUrl) {
    const response = await axios.post('https://api.jina.ai/embedding', {
        url: imageUrl
    }, {
        headers: { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` }
    });
    return response.data.embedding;
}

module.exports = embeddingImage;
