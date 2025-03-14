# Gestão de Arquivos e Vector Stores no Projeto

Este documento explica como os arquivos e vector stores são gerenciados neste projeto para enriquecer as respostas do assistente OpenAI.

## Configuração Atual

### Arquivos Anexados Diretamente ao Assistente

Atualmente, o projeto está configurado para trabalhar com **arquivos anexados diretamente ao assistente** na interface da OpenAI. Esta é a configuração mais simples, onde os arquivos são gerenciados diretamente pela interface da plataforma OpenAI.

**Vantagens:**
- Interface intuitiva
- Não requer código adicional
- Gestão simplificada

**Limitações:**
- Número limitado de arquivos por assistente (capacidade menor que vector stores)
- Não permite reutilização da base de conhecimento entre múltiplos assistentes
- Gerenciamento manual pela interface da OpenAI

### Verificando a Configuração Atual

Para verificar a configuração atual do seu assistente, incluindo os arquivos anexados, execute:

```bash
npm run check:assistant
```

Este comando irá mostrar:
- Informações do assistente
- Ferramentas habilitadas
- Arquivos anexados diretamente
- Recomendações sobre a configuração

## Configuração Alternativa: Vector Stores

O projeto também inclui implementação para utilizar **vector stores** da OpenAI, uma abordagem mais avançada que permite armazenar até 10.000 arquivos (contra o limite menor da abordagem direta).

Esta configuração não está ativa no momento, mas pode ser habilitada se necessário.

**Vantagens dos Vector Stores:**
- Suporte a até 10.000 arquivos por vector store
- Reutilização da base de conhecimento entre múltiplos assistentes e threads
- Gerenciamento programático via API
- Melhor controle sobre os arquivos e metadados

**Arquivos de Implementação:**
- `src/services/openaiVectorStore.js`: Serviço para gerenciar vector stores
- `src/scripts/initVectorStore.js`: Script para inicializar um vector store
- `src/scripts/migratePineconeToOpenAI.js`: Script para migrar dados do Pinecone

## Alternando Entre as Configurações

### Para continuar usando arquivos anexados diretamente (configuração atual):

Não é necessário fazer nada. A aplicação já está configurada para trabalhar desta forma.

### Para migrar para vector stores:

1. Descomente as variáveis de ambiente em `.env`:
   ```
   VECTOR_STORE_NAME=Base de Conhecimento Sofia
   # OPENAI_VECTOR_STORE_ID será preenchido pelo script
   ```

2. Restaure o código em `src/services/conversationService.js` que anexa o vector store à thread.

3. Execute o script de inicialização:
   ```bash
   npm run init:vector-store
   ```
   
4. OU, se quiser migrar dados do Pinecone:
   ```bash
   npm run migrate:pinecone
   ```

## Dicas para Gerenciar Arquivos no Assistente

### Como Adicionar Arquivos ao Assistente

1. Acesse a [plataforma OpenAI](https://platform.openai.com/)
2. Navegue até "Assistants" e selecione seu assistente
3. Na seção "Files", clique em "Upload file"
4. Selecione os arquivos que deseja adicionar (PDFs, documentos, etc.)
5. Verifique se a ferramenta "file_search" está habilitada

### Formatos Suportados

- PDF (.pdf)
- Texto (.txt)
- Word (.doc, .docx)
- CSV (.csv)
- JSON (.json)
- Markdown (.md)

### Boas Práticas

1. **Nomes de arquivos informativos**: Use nomes que descrevam claramente o conteúdo.
2. **Arquivos otimizados**: Documentos bem estruturados e com texto pesquisável.
3. **Tamanho razoável**: Arquivos muito grandes podem ser menos eficientes.
4. **Conteúdo relevante**: Inclua apenas informações que serão úteis para as respostas.

## Resumo

Para a maioria dos casos de uso com um volume moderado de arquivos, a configuração atual (arquivos anexados diretamente) é suficiente e mais simples. Se o projeto crescer e precisar de uma base de conhecimento maior, a implementação de vector stores já está disponível para ser ativada.

Para verificar a configuração atual do seu assistente, use:
```bash
npm run check:assistant
``` 