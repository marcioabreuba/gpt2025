import OpenAI from 'openai';
import dotenv from 'dotenv';
import config from '../config.js';

// Carregando variáveis de ambiente
dotenv.config();

// Inicializa o cliente OpenAI
const openai = new OpenAI({ apiKey: config.openai.apiKey });

// ID do assistente a ser verificado
const ASSISTANT_ID = config.openai.assistantId;

/**
 * Função para verificar a configuração do assistente
 */
async function checkAssistantConfiguration() {
  console.log('🔍 Verificando configuração do assistente OpenAI...');
  
  try {
    // Obtém informações do assistente
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    
    console.log('\n📊 INFORMAÇÕES DO ASSISTENTE');
    console.log('=========================');
    console.log(`ID: ${assistant.id}`);
    console.log(`Nome: ${assistant.name}`);
    console.log(`Modelo: ${assistant.model}`);
    console.log(`Criado em: ${new Date(assistant.created_at * 1000).toLocaleString()}`);
    
    // Verifica as ferramentas habilitadas
    console.log('\n🔧 FERRAMENTAS HABILITADAS');
    console.log('=========================');
    
    if (assistant.tools && assistant.tools.length > 0) {
      assistant.tools.forEach(tool => {
        console.log(`• ${tool.type}`);
      });
    } else {
      console.log('Nenhuma ferramenta habilitada');
    }
    
    // Verifica se file_search está habilitado
    const hasFileSearch = assistant.tools && assistant.tools.some(tool => tool.type === 'file_search');
    
    if (hasFileSearch) {
      console.log('\n📁 CONFIGURAÇÃO DE FILE_SEARCH');
      console.log('=============================');
      
      // Verifica se há vector stores configurados
      if (assistant.tool_resources && assistant.tool_resources.file_search) {
        const vectorStoreIds = assistant.tool_resources.file_search.vector_store_ids || [];
        
        if (vectorStoreIds.length > 0) {
          console.log(`Vector stores anexados: ${vectorStoreIds.length}`);
          
          for (const vsId of vectorStoreIds) {
            try {
              const vectorStore = await openai.beta.vector_stores.retrieve(vsId);
              console.log(`• ${vectorStore.name} (${vsId})`);
              console.log(`  - Arquivos: ${vectorStore.file_counts.processed} processados, ${vectorStore.file_counts.in_progress} em processamento, ${vectorStore.file_counts.error} com erro`);
            } catch (error) {
              console.log(`• ${vsId} - Erro ao obter detalhes: ${error.message}`);
            }
          }
        } else {
          console.log('Nenhum vector store anexado ao assistente');
        }
      } else {
        console.log('file_search habilitado, mas sem vector stores configurados');
      }
    }
    
    // Verifica arquivos anexados diretamente ao assistente
    console.log('\n📄 ARQUIVOS ANEXADOS DIRETAMENTE');
    console.log('================================');
    
    const files = await openai.beta.assistants.files.list(ASSISTANT_ID);
    
    if (files.data && files.data.length > 0) {
      console.log(`Total de arquivos: ${files.data.length}`);
      
      for (const file of files.data) {
        // Obtém detalhes do arquivo
        try {
          const fileDetails = await openai.files.retrieve(file.file_id);
          console.log(`• ${fileDetails.filename} (${file.file_id})`);
          console.log(`  - Tamanho: ${(fileDetails.bytes / 1024).toFixed(2)} KB`);
          console.log(`  - Criado em: ${new Date(fileDetails.created_at * 1000).toLocaleString()}`);
        } catch (error) {
          console.log(`• ${file.file_id} - Erro ao obter detalhes: ${error.message}`);
        }
      }
    } else {
      console.log('Nenhum arquivo anexado diretamente ao assistente');
    }
    
    console.log('\n✅ Verificação concluída!');
    
    // Sugestões de otimização
    console.log('\n💡 RECOMENDAÇÕES');
    console.log('===============');
    
    if (!hasFileSearch && files.data && files.data.length > 0) {
      console.log('• Você tem arquivos anexados, mas a ferramenta file_search não está habilitada.');
      console.log('  Considere habilitar file_search para que o assistente possa pesquisar nos arquivos.');
    }
    
    if (hasFileSearch && (!files.data || files.data.length === 0) && 
        (!assistant.tool_resources || !assistant.tool_resources.file_search || 
         !assistant.tool_resources.file_search.vector_store_ids || 
         assistant.tool_resources.file_search.vector_store_ids.length === 0)) {
      console.log('• Você tem file_search habilitado, mas não há arquivos ou vector stores configurados.');
      console.log('  Adicione arquivos ao assistente ou configure um vector store.');
    }
    
  } catch (error) {
    console.error(`❌ Erro ao verificar assistente: ${error.message}`);
    console.error(error.stack);
  }
}

// Executar o script
checkAssistantConfiguration(); 