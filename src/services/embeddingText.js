const axios = require('axios');

/**
 * Função para gerar embeddings de texto usando OpenAI
 */
async function embeddingText(content) {
    const response = await axios.post('https://api.openai.com/v1/embeddings', {
        input: content,
        model: 'text-embedding-ada-002'
    }, {
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    return response.data.data[0].embedding;
}

export default embeddingText;
