# Sistema de Logs - Versão Simples

Este documento descreve o sistema de logs simples do projeto.

## Níveis de Log

O sistema utiliza os níveis padrão do Winston:

- **error**: Para erros críticos
- **warn**: Para avisos importantes
- **info**: Para informações gerais (nível padrão)
- **debug**: Para informações detalhadas
- **silly**: Para rastreamento detalhado

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

O nível de log pode ser definido pela variável de ambiente:
```
LOG_LEVEL=debug
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