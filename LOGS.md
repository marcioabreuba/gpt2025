# Sistema de Logs do Projeto

Este documento descreve o sistema de logs aprimorado do projeto, que foi desenvolvido para tornar o código mais limpo e facilitar a depuração.

## Níveis de Log

O sistema utiliza os seguintes níveis de log, em ordem de gravidade:

1. **error** `[!]`: Para erros críticos que afetam o funcionamento da aplicação.
2. **warn** `[*]`: Para avisos importantes que não interrompem o funcionamento, mas merecem atenção.
3. **info** `[→]`: Para informações gerais sobre o estado e fluxo da aplicação.
4. **debug** `[#]`: Para informações detalhadas úteis durante a depuração.
5. **trace** `[+]`: Para informações extremamente detalhadas e dados de rastreamento.
6. **success** `[✓]`: Para confirmação de operações concluídas com sucesso.

## Formato Visual

Cada log contém:
- Timestamp em formato legível (YYYY-MM-DD HH:mm:ss)
- Número sequencial do log (para fácil referência)
- Símbolo indicando o nível do log 
- Nível do log em letras maiúsculas
- Mensagem principal
- Metadados adicionais (quando existentes)

Exemplo:
```
2023-08-20 15:30:45 [0001] [→] [INFO]: Servidor iniciado na porta 3000
```

## Configuração

O nível de log pode ser configurado de duas maneiras:

1. **Variável de ambiente**: Configure `LOG_LEVEL` no arquivo `.env` com um dos valores acima.
2. **Configuração padrão**: Se não especificado, o nível padrão é `info`.

Exemplo:
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
// Mensagens de erro (fundo vermelho)
logger.error('Erro crítico ao processar pagamento');

// Avisos (fundo amarelo)
logger.warn('Token de acesso expirando em 1 hora');

// Informações normais (fundo azul)
logger.info('Servidor iniciado na porta 3000');

// Informações de depuração (verde)
logger.debug('Processando payload:', { id: 123, status: 'pending' });

// Rastreamento detalhado (lilás)
logger.trace('Detalhes completos da requisição:', request);

// Mensagens de sucesso (fundo verde)
logger.success('Operação concluída com sucesso');
```

### Mensagens em Destaque

Para mensagens que precisam de maior visibilidade:

```javascript
// Destaque padrão (fundo azul)
logger.destaque('INICIANDO PROCESSO DE SINCRONIZAÇÃO');

// Destaque de erro (fundo vermelho)
logger.destaqueErro('FALHA CRÍTICA NA CONEXÃO');

// Destaque de sucesso (fundo verde)
logger.destaqueSucesso('SINCRONIZAÇÃO COMPLETA');

// Destaque de aviso (fundo amarelo)
logger.destaqueAviso('PERFORMANCE DEGRADADA');
```

### Mensagens Estruturadas

Para melhor análise, você pode passar objetos estruturados:

```javascript
logger.info('Processamento concluído', { 
  duration: 125, 
  itemsProcessed: 50,
  success: true
});
```

### Logs de Conversação

Para registrar mensagens da conversa com usuários:

```javascript
// Mensagem do usuário para a Sofia
logger.userMessage('5511999998888', 'Quero saber sobre meu pedido');

// Resposta da Sofia para o usuário
logger.iaMessage('5511999998888', 'Vou buscar informações sobre seu pedido');
```

## Compatibilidade com console.log

O sistema sobrescreve os métodos nativos do `console` para usar o logger:

- `console.log` → `logger.info` ou `logger.success` (detecta automaticamente)
- `console.error` → `logger.error`
- `console.warn` → `logger.warn`
- `console.info` → `logger.info`
- `console.debug` → `logger.debug`

Em ambiente de desenvolvimento (`NODE_ENV=development`), os logs também serão exibidos no console original.

## Arquivos de Log

Os logs são salvos em diferentes arquivos:

- `logs/application.log`: Todos os logs de nível `info` ou superior
- `logs/error.log`: Apenas logs de nível `error`
- `logs/debug.log`: Logs de nível `debug` ou superior
- `logs/conversation.log`: Registros específicos de conversas

## Boas Práticas

1. **Use o nível adequado**: Não use `info` para mensagens de depuração
2. **Seja específico**: Forneça contexto suficiente em cada mensagem
3. **Evite dados sensíveis**: Não logue senhas, tokens ou dados pessoais
4. **Estruture seus logs**: Use objetos para dados complexos ao invés de strings concatenadas
5. **Seja consistente**: Mantenha um padrão nas mensagens de log

## Exemplos de Uso em Produção

```javascript
// ❌ Ruim: muitos detalhes em produção
logger.info("Embeddings gerados:", embeddings);

// ✅ Bom: resumo em produção
logger.info("Embeddings gerados com sucesso", { count: embeddings.length });

// ✅ Bom: detalhes apenas em debug
logger.debug("Detalhes dos embeddings:", embeddings);
``` 