# Manual Completo de Migração e Configuração de Novas Instâncias

## Introdução

Este manual foi criado para facilitar o processo de criação de novas instâncias do sistema, permitindo que você configure facilmente um ambiente paralelo para testes, desenvolvimento ou produção. O processo foi automatizado para minimizar erros e garantir uma configuração correta.

## Visão Geral do Processo

O processo de migração consiste nas seguintes etapas:

1. **Criação de cópia da estrutura de código** - Usando o script automatizado
2. **Configuração de novos serviços externos** - OpenAI, ZAPI, Render, etc.
3. **Configuração do ambiente da nova instância** - Variáveis de ambiente
4. **Inicialização e teste da nova instância** - Instalação e execução
5. **Envio do código para o GitHub em uma nova branch** - Para controle de versão
6. **Migração de dados (opcional)** - Transferência de dados existentes

## Pré-requisitos

Antes de iniciar o processo, certifique-se de ter:

- Node.js versão 14 ou superior instalado
- Yarn instalado (recomendado em vez de NPM)
- Git instalado
- Acesso a todos os serviços externos utilizados pelo sistema:
  - OpenAI (para criar novo Assistant)
  - Z-API (para criar nova instância de WhatsApp)
  - Render.com (para hospedar a nova instância)
  - PostgreSQL (Neon, Supabase ou outro provedor)
  - Redis (pode ser o mesmo, mas com prefixos diferentes)
  - Pinecone (pode ser o mesmo, mas com índice diferente)

## 1. Automação da Criação de Nova Instância

### 1.1 Executando o Script de Automação

O script `automatizar_nova_instancia.js` foi criado para facilitar o processo de criação de uma nova instância. 

**Como executar o script:**

No Windows, você pode:
- Abrir o Prompt de Comando (CMD)
- Navegar até a pasta do projeto usando `cd caminho/para/sua/pasta` 
- Executar o script com:
  ```bash
  node automatizar_nova_instancia.js
  ```

OU simplesmente:
- Dar um duplo clique no arquivo `iniciar_migracao.bat`

No Linux/Mac, você pode:
- Abrir o Terminal
- Navegar até a pasta do projeto
- Executar:
  ```bash
  ./iniciar_migracao.sh
  ```
  (Pode ser necessário tornar o arquivo executável com `chmod +x iniciar_migracao.sh`)

### 1.2 O Que Significa Cada Informação Solicitada

O script solicitará duas informações principais:

1. **Prefixo**: Um identificador único para a nova instância, como "loja2", "teste" ou qualquer nome curto.
   - **Exemplo**: `loja2`
   - **Para que serve**: Este prefixo será usado para:
     - Nomear seu índice Pinecone como `loja2-products`
     - Adicionar prefixo às tabelas no banco de dados (`loja2_Orders`, `loja2_QueueTraining`)
     - Separar as chaves no Redis (`loja2:threadId:...`)

2. **Pasta de Destino**: O caminho completo onde sua nova instância será criada no seu computador.
   - **Exemplo**: `C:/Projetos/minha-loja2` ou `/home/usuario/projetos/loja2`
   - **Por padrão**: `../nova_instancia` (uma pasta acima da pasta atual)
   - **Para que serve**: É onde todo o código da nova instância será copiado e modificado

**Exemplo prático:**
```
Digite o prefixo para a nova instância (padrão: store): loja2
Digite o caminho para a pasta de destino (padrão: ../nova_instancia): C:/Projetos/minha-loja2
```

3. **Confirmação**: Digite `s` para confirmar e iniciar o processo.

### 1.3 Verificando a Estrutura Criada

Após a execução do script, navegue até a pasta de destino que você especificou. Você deve encontrar:

- Todos os arquivos do projeto original
- Um arquivo `.env.template` com instruções de configuração
- Um arquivo `MANUAL_NOVA_INSTANCIA.md` com instruções específicas
- Modificações nos arquivos `src/redisClient.js` e `prisma/schema.prisma` para suportar prefixos

## 2. Configuração de Novos Serviços

### 2.1 Criando um Novo Assistant na OpenAI

1. Acesse sua conta na [OpenAI Platform](https://platform.openai.com/assistants)
2. Clique em "Create assistant"
3. Configure o novo assistente com as mesmas configurações do assistente original:
   - Nome: (mesmo nome ou um nome que identifique a nova instância)
   - Modelo: GPT-4o (ou o mesmo modelo do assistente original)
   - Instruções: Copie as instruções do assistente original
   - Ferramentas: Ative as mesmas ferramentas do assistente original
   - Arquivos: Faça upload dos mesmos arquivos do assistente original
4. Após criar o assistente, copie o ID (formato: asst_xyz...) para usar no arquivo `.env`

### 2.2 Criando uma Nova Instância ZAPI

1. Acesse sua conta na [Z-API](https://app.z-api.io/)
2. Clique em "Criar Instância"
3. Dê um nome à nova instância (ex: "WhatsApp Loja 2")
4. Siga as instruções para autenticar a nova instância via QR Code
5. Após a autenticação, vá até a seção "API" e copie:
   - Instance ID
   - Token
   - Client Token

### 2.3 Configurando o Banco de Dados

#### Opção 1: Criar um Novo Banco de Dados (Recomendado)

1. Acesse seu provedor de PostgreSQL (Neon, Supabase, etc.)
2. Crie um novo banco de dados
3. Copie a URL de conexão fornecida pelo provedor

**Exemplo na Neon:**
- Acesse [console.neon.tech](https://console.neon.tech/)
- Crie um novo projeto
- Crie um novo banco de dados
- Copie a string de conexão (parece com: `postgresql://usuario:senha@ep-xyz.us-east-1.aws.neon.tech/nome_banco?sslmode=require`)

#### Opção 2: Usar o Mesmo Banco com Tabelas Diferentes

Se optar por usar o mesmo banco de dados, o script já configurou o Prisma para usar prefixos nas tabelas. Não é necessário alterar a URL, mas você precisa garantir que o usuário do banco tenha permissões para criar novas tabelas.

### 2.4 Configurando o Pinecone (Vector Store)

1. Acesse sua conta no [Pinecone](https://app.pinecone.io/)
2. Crie um novo índice:
   - Nome: `[prefixo]-products` (ex: `loja2-products`)
   - Dimensões: Use o mesmo valor do índice original (geralmente 1536 para embeddings da OpenAI)
   - Métrica: Use a mesma métrica do índice original (geralmente "cosine")

## 3. Configurando o Arquivo .env

Após configurar todos os serviços, você precisa atualizar o arquivo `.env.template`:

1. Navegue até a pasta da nova instância (ex: `C:/Projetos/minha-loja2`)
2. Renomeie o arquivo `.env.template` para `.env`
3. Abra o arquivo em um editor de texto (como Notepad, VS Code, etc.)
4. Atualize as seguintes variáveis:
   - `ASSISTANT_ID`: ID do novo assistente OpenAI (ex: `asst_abc123...`)
   - `ZAPI_INSTANCE_ID`: ID da nova instância ZAPI (ex: `3DCC5112A15410384CB6...`)
   - `ZAPI_TOKEN`: Token da nova instância ZAPI
   - `ZAPI_CLIENT_TOKEN`: Client Token da nova instância ZAPI
   - `SERVER_LINK`: URL do novo serviço no Render (ex: `https://loja2.onrender.com`)
   - `DATABASE_URL`: URL de conexão do novo banco de dados (se você criou um novo)
   - `PINECONE_INDEX`: Nome do novo índice Pinecone (ex: `loja2-products`)

## 4. Inicializando a Nova Instância Localmente

### 4.1 Instalando Dependências

No diretório da nova instância, abra um terminal ou prompt de comando e execute:

```bash
yarn
```

> **Nota**: Recomendamos o uso do Yarn como gerenciador de pacotes para garantir compatibilidade completa com o projeto original.

### 4.2 Executando Migrações do Banco de Dados

Execute as migrações do Prisma para criar as tabelas necessárias:

```bash
npx prisma migrate dev --name init
```

### 4.3 Iniciando o Servidor Localmente (Opcional)

Se quiser testar localmente, inicie o servidor com:

```bash
node start.js
```

## 5. Enviando para o GitHub em uma Nova Branch

Este é um passo crucial que permite manter versões separadas do seu código no GitHub.

### 5.1 Inicialização do Git na Nova Instância

Abra um terminal na pasta da nova instância (ex: `C:/Projetos/minha-loja2`) e execute:

```bash
# Inicialize um repositório Git (se ainda não for um)
git init
```

### 5.2 Conectando ao Repositório Remoto do GitHub

```bash
# Substitua URL_DO_SEU_REPOSITORIO pela URL do seu repositório GitHub
# Exemplo: https://github.com/seu-usuario/seu-repositorio.git
git remote add origin URL_DO_SEU_REPOSITORIO

# Verifique se o remote foi adicionado corretamente
git remote -v
```

### 5.3 Criando uma Nova Branch

Crie uma nova branch com o mesmo nome do prefixo que você escolheu:

```bash
# Substitua 'loja2' pelo prefixo que você escolheu
git checkout -b loja2
```

### 5.4 Adicionando os Arquivos e Enviando para o GitHub

```bash
# Adicione todos os arquivos
git add .

# Faça commit das mudanças
git commit -m "Nova instância: loja2"

# Envie a nova branch para o GitHub
git push -u origin loja2
```

### 5.5 Verificando no GitHub

1. Acesse seu repositório no GitHub
2. Você verá uma mensagem sobre a branch recém-enviada
3. Clique em "Compare & pull request" se quiser mesclar com a branch principal, ou simplesmente deixe como uma branch separada

## 6. Configurando o Render.com com a Nova Branch

### 6.1 Criando um Novo Web Service no Render

1. Acesse sua conta no [Render.com](https://dashboard.render.com/)
2. Clique em "New" e selecione "Web Service"
3. Conecte ao seu repositório GitHub
4. **Importante**: Na seção "Branch", selecione a nova branch que você criou (ex: `loja2`)
5. Configure o serviço:
   - Nome: (escolha um nome que identifique a nova instância, ex: "app-loja2")
   - Ambiente: Node
   - Comando de início: `node start.js`
   - Plano: Selecione o plano apropriado
6. Adicione as variáveis de ambiente do arquivo `.env` (preenchendo os valores corretos)
7. Clique em "Create Web Service"
8. Copie a URL do serviço (ex: https://app-loja2.onrender.com) e atualize a variável `SERVER_LINK` no arquivo `.env`

## 7. Migração de Dados (Opcional)

Se desejar migrar dados da instância original para a nova, você pode:

### 7.1 Exportando Produtos da Instância Original

1. Acesse a API de administração da instância original
2. Use o endpoint `/api/products/export` para exportar todos os produtos

### 7.2 Importando Produtos na Nova Instância

1. Acesse a API de administração da nova instância
2. Use o endpoint `/api/products/import` para importar os produtos

## 8. Testes e Verificação

Após configurar a nova instância, realize os seguintes testes:

1. Verifique se o servidor está rodando corretamente (acessando a URL do Render)
2. Envie uma mensagem de teste para o WhatsApp conectado à nova instância
3. Verifique se o sistema responde corretamente
4. Teste a integração com a Shopify e outros serviços

## 9. Solução de Problemas Comuns

### 9.1 Problemas com o Banco de Dados

- **Erro de conexão**: Verifique se a URL está correta e se o banco está acessível
- **Erro de migração**: Verifique se o usuário tem permissões para criar tabelas

### 9.2 Problemas com o Redis

- **Erro de conexão**: Verifique se a URL e a senha estão corretas
- **Conflito de chaves**: Verifique se o prefixo está sendo aplicado corretamente

### 9.3 Problemas com o ZAPI

- **WhatsApp não conectado**: Verifique o status da instância no painel da ZAPI
- **Mensagens não recebidas**: Verifique se o webhook está configurado corretamente

### 9.4 Problemas com o Assistant OpenAI

- **Respostas inadequadas**: Verifique se as instruções e arquivos foram configurados corretamente
- **Erros de API**: Verifique se a chave API está válida e com créditos suficientes

### 9.5 Problemas com o Git e GitHub

- **Erro "fatal: remote origin already exists"**: Use `git remote rm origin` e depois adicione novamente
- **Erro ao fazer push**: Verifique se você tem permissão no repositório
- **Branch não aparece no GitHub**: Verifique se usou `git push -u origin nome-da-branch`

## 10. Exemplo Completo do Processo

Aqui está um exemplo completo do processo para criar uma nova instância chamada "loja2":

```bash
# 1. Execute o script de automação
node automatizar_nova_instancia.js
# Digite: loja2
# Digite: C:/Projetos/minha-loja2
# Digite: s

# 2. Configure os serviços externos (OpenAI, ZAPI, etc.)
# ... (Siga as instruções das seções 2.1-2.5)

# 3. Vá para a pasta da nova instância
cd C:/Projetos/minha-loja2

# 4. Atualize o arquivo .env com os novos valores
# ... (Renomeie .env.template para .env e edite)

# 5. Instale as dependências
yarn

# 6. Execute as migrações do banco de dados
npx prisma migrate dev --name init

# 7. Inicialize o Git
git init

# 8. Configure o repositório remoto
git remote add origin https://github.com/seu-usuario/seu-repositorio.git

# 9. Crie e mude para uma nova branch
git checkout -b loja2

# 10. Adicione os arquivos
git add .

# 11. Faça commit
git commit -m "Nova instância: loja2"

# 12. Envie para o GitHub
git push -u origin loja2

# 13. Configure o serviço no Render.com usando a branch loja2
# ... (Siga as instruções da seção 6)
```

## 11. Dicas para Gerenciamento de Múltiplas Instâncias

- **Nomenclatura clara**: Use nomes descritivos para identificar facilmente cada instância
- **Documentação**: Mantenha um registro de todas as instâncias e suas configurações
- **Monitoramento**: Configure alertas para cada instância separadamente
- **Backups**: Realize backups regulares de cada banco de dados
- **Gestão de custos**: Monitore o uso e custo de cada instância para evitar surpresas

## 12. Conclusão

Seguindo este manual, você deve ser capaz de criar e configurar novas instâncias do sistema de forma eficiente e com mínimo risco de erros. Este processo permite que você mantenha múltiplas instâncias para diferentes propósitos, como desenvolvimento, teste, homologação ou produção.

Para qualquer dúvida adicional, consulte a documentação técnica do projeto ou entre em contato com o suporte. 