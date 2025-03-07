# Sistema de Logs - Versão Simplificada

Este documento descreve o sistema de logs simplificado do projeto, sem dependências externas.

## Níveis de Log

O sistema utiliza os seguintes níveis:

- **ERROR**: Para erros críticos
- **WARN**: Para avisos importantes
- **INFO**: Para informações gerais (nível padrão)
- **DEBUG**: Para informações detalhadas (ativado via variável de ambiente)
- **TRACE**: Para informações extremamente detalhadas (ativado via variável de ambiente)

## Formato dos Logs

Cada log contém:
- Data e hora (YYYY-MM-DD HH:mm:ss)
- Nível do log em maiúsculas
- Mensagem

Exemplo:
```
2023-08-20 15:30:45 [INFO] Servidor iniciado na porta 3000
```

## Configuração

Os níveis de log podem ser ativados pela variável de ambiente:
```
# Mostra INFO, WARN e ERROR (padrão)
LOG_LEVEL=info

# Mostra também DEBUG
LOG_LEVEL=debug

# Mostra também TRACE (mais detalhado)
LOG_LEVEL=trace
```

## Como usar o Logger

### Importação

```javascript
import logger from '../utils/logger.js';
```

### Uso Básico

```javascript
// Mensagens de erro
logger.error('Erro ao conectar');

// Avisos
logger.warn('Token expirando');

// Informações gerais
logger.info('Servidor iniciado');

// Informações de depuração
logger.debug('Processando dados');

// Informações de rastreamento muito detalhadas
logger.trace('Valores completos', objetoDetalhado);
```

### Logs de Conversação

Para registrar mensagens da conversa com usuários:

```javascript
// Mensagem do usuário para a Sofia
logger.userMessage('5511999998888', 'Quero saber sobre meu pedido');

// Resposta da Sofia para o usuário
logger.iaMessage('5511999998888', 'Vou buscar informações sobre seu pedido');
```

As conversas são salvas em um arquivo específico (`logs/conversation.log`) com formato simplificado:

```
2023-08-20 15:30:45 👤 5511999998888 → Sofia: "Quero saber sobre meu pedido"
2023-08-20 15:30:47 🤖 Sofia → 5511999998888: "Vou buscar informações sobre seu pedido"
```

## Arquivos de Log

Os logs são salvos em:
- `logs/application.log`: Todos os logs
- `logs/error.log`: Apenas logs de erro
- `logs/conversation.log`: Apenas trocas de mensagens entre usuários e o sistema

## Compatibilidade com console.log

Os métodos console.* são redirecionados para o logger:

- `console.log` → `logger.info`
- `console.error` → `logger.error`
- `console.warn` → `logger.warn`
- `console.info` → `logger.info`
- `console.debug` → `logger.debug`

## Filtro de Avisos de Depreciação

O sistema filtra automaticamente avisos de depreciação do Node.js, como:
- Avisos sobre o módulo `punycode`
- Outros avisos de depreciação com prefixo `[DEP`

## Prevenção de Log Duplicado

As mensagens de conversação são registradas apenas:
- No arquivo específico de conversas
- No console com ícones distintos (📱 e 🔄)
- Não são duplicadas no log de aplicação geral

## Vantagens desta Implementação

1. **Zero dependências externas** - não depende de bibliotecas como Winston
2. **Código leve e fácil de entender** - implementação direta
3. **Desempenho aprimorado** - usa recursos nativos do Node.js
4. **Formato consistente** - mantém o mesmo formato de logs visual
5. **Evita duplicação** - cada mensagem é registrada apenas uma vez 