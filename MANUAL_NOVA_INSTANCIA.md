# Manual para Criação de Nova Instância do Sistema

## 1. Pré-requisitos

Antes de prosseguir, certifique-se de ter os seguintes itens:

- Conta na OpenAI para criar um novo Assistant
- Conta no ZAPI para criar uma nova instância de WhatsApp
- Acesso ao Render.com para criar um novo serviço
- Acesso ao banco de dados PostgreSQL (Neon, Supabase ou outro provedor)
- Acesso ao Pinecone para criar um novo índice (opcional)

## 2. Configuração de Nova Instância (Passo a Passo)

### 2.1. Configurando o Banco de Dados

1. Acesse seu provedor de PostgreSQL (Neon, Supabase, etc.)
2. Crie um novo banco de dados ou um novo schema
3. Copie a URL de conexão fornecida pelo provedor
4. Substitua a variável `DATABASE_URL` no arquivo `.env.template`
5. Execute os comandos de migração do Prisma:

```bash
npx prisma migrate dev --name init
```

### 2.2. Configurando o OpenAI Assistant

1. Acesse https://platform.openai.com/assistants
2. Crie um novo assistente com a mesma configuração do assistente original
3. Copie o ID do assistente (formato: asst_xyz...)
4. Substitua a variável `ASSISTANT_ID` no arquivo `.env.template`

### 2.3. Configurando o ZAPI (WhatsApp)

1. Acesse sua conta no Z-API
2. Crie uma nova instância para conexão com WhatsApp
3. Siga as instruções para autenticar via QR Code
4. Obtenha os tokens necessários (Instance ID, Token e Client Token)
5. Substitua as variáveis `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN` e `ZAPI_CLIENT_TOKEN` no arquivo `.env.template`

### 2.4. Configurando o GitHub e Render

1. Inicialize um repositório Git nesta pasta:
   ```bash
   git init
   ```

2. Conecte ao seu repositório GitHub:
   ```bash
   git remote add origin https://github.com/seu-usuario/seu-repositorio.git
   ```

3. Crie uma nova branch com o nome "SoleTerra":
   ```bash
   git checkout -b SoleTerra
   ```

4. Adicione e envie os arquivos:
   ```bash
   git add .
   git commit -m "Nova instância: SoleTerra"
   git push -u origin SoleTerra
   ```

5. Acesse sua conta no Render.com
6. Crie um novo Web Service, apontando para o repositório Git
7. **Importante**: Selecione a branch "SoleTerra"
8. Configure as variáveis de ambiente usando o arquivo `.env.template`
9. Implante o serviço e obtenha a URL
10. Substitua a variável `SERVER_LINK` no arquivo `.env.template`

### 2.5. Configurando o Pinecone (Vector Store)

1. Acesse sua conta no Pinecone
2. Crie um novo índice com o nome `SoleTerra-products`
3. Certifique-se de que a variável `PINECONE_INDEX` está configurada corretamente no `.env.template`

## 3. Inicializando o Sistema

1. Renomeie o arquivo `.env.template` para `.env`
2. Instale as dependências com `yarn`
3. Execute o sistema com `node start.js`

## 4. Migrando Dados (Opcional)

Se quiser migrar dados da instância original para a nova:

1. Exporte produtos da instância original
2. Importe-os na nova instância usando a API de produtos

## 5. Exemplo Completo do Processo

```bash
# 1. Configure os serviços (OpenAI, ZAPI, etc.)
# ... (Siga as instruções acima)

# 2. Atualize o arquivo .env
mv .env.template .env
# Edite o arquivo .env com seus novos valores

# 3. Instale as dependências
yarn

# 4. Execute as migrações do Prisma
npx prisma migrate dev --name init

# 5. Configure o Git e envie para o GitHub
git init
git remote add origin https://github.com/seu-usuario/seu-repositorio.git
git checkout -b SoleTerra
git add .
git commit -m "Nova instância: SoleTerra"
git push -u origin SoleTerra

# 6. Configure o Render.com apontando para a branch "SoleTerra"
# ... (Siga as instruções da seção 2.4)
```

## 6. Considerações Importantes

1. Esta instância utiliza um prefixo `SoleTerra` para Redis e tabelas do banco de dados
2. Mantenha senhas e tokens em local seguro
3. Faça backups regulares do banco de dados

## 7. Solução de Problemas

Se encontrar algum problema durante a configuração, verifique:

1. Se todas as variáveis de ambiente estão configuradas corretamente
2. Se o banco de dados está acessível
3. Se os tokens da ZAPI, OpenAI e outros serviços estão válidos
4. Consulte os logs para identificar erros específicos

Para mais informações, consulte o README.md do projeto original.