# Sistema de Logs - Visão Completa do Sistema

Este documento descreve o sistema de logs do projeto, criado para fornecer visibilidade total de todas as operações.

## Níveis de Log

O sistema utiliza os seguintes níveis, em ordem de prioridade:

- **ERROR**: Para erros críticos
- **WARN**: Para avisos importantes
- **INFO**: Para informações gerais (nível padrão)
- **DEBUG**: Para informações detalhadas
- **TRACE**: Para informações extremamente detalhadas
- **SYSTEM**: Logs internos de sistema, sempre registrados

## Formato dos Logs

Cada log contém:
- Data e hora completa (YYYY-MM-DD HH:mm:ss.SSS)
- Nível do log em maiúsculas
- Mensagem principal
- Metadados estruturados (quando fornecidos)

Exemplo:
```
2023-08-20 15:30:45.123 [INFO] Servidor iniciado na porta 3000
```

Exemplo com metadados:
```
2023-08-20 15:30:45.123 [SYSTEM] Exclusão de thread concluída
{
  "userId": "184606284366064@lid",
  "threadId": "thread_abc123",
  "status": "sucesso"
}
```

## Arquivos de Log

Os logs são salvos em arquivos específicos:
- `logs/app.log`: Logs gerais da aplicação (depende do nível configurado)
- `logs/error.log`: Apenas logs de erro
- `logs/debug.log`: Logs detalhados (níveis DEBUG e TRACE)
- `logs/chat.log`: Conversas entre usuários e o sistema
- `logs/full.log`: **REGISTRO COMPLETO DE TUDO**, independente do nível

## Configuração

O nível de log pode ser configurado através da variável de ambiente `LOG_LEVEL`:

```
# No arquivo .env
LOG_LEVEL=info  # Valores: error, warn, info, debug, trace
```

**Importante**: Independente do nível configurado, TODAS as operações são sempre registradas no arquivo `full.log` para possibilitar depuração completa.

## Como usar o Logger

### Uso Básico

```javascript
import logger from '../utils/logger.js';

// Logs simples por nível
logger.error('Erro ao conectar ao banco de dados');
logger.warn('Token expirando em 24 horas');
logger.info('Servidor iniciado na porta 3000');
logger.debug('Processando payload recebido');
logger.trace('Dados completos da requisição', { headers, body });

// Logs com metadados estruturados
logger.info('Operação concluída', { 
  duracao: 125, 
  status: 'sucesso',
  itens: 50
});

// Logs de sistema (sempre registrado, independente do nível)
logger.system('Evento interno importante', {
  operacao: 'sincronização',
  detalhes: { ... }
});
```

### Logs de Conversação

```javascript
// Mensagem do usuário para a Sofia
logger.userMessage('5511999998888', 'Quero saber sobre meu pedido');

// Resposta da Sofia para o usuário
logger.iaMessage('5511999998888', 'Vou buscar informações sobre seu pedido');
```

## Visualizando Operações Internas do Sistema

Para ver TODAS as operações do sistema, incluindo detalhes internos como execução de funções e processamento de comandos, você deve:

1. Consultar o arquivo `logs/full.log`, que contém absolutamente tudo
2. Alternativamente, definir `LOG_LEVEL=trace` para ver o máximo de detalhes no console e nos outros arquivos

## Compatibilidade com console.log

Todos os métodos do console são redirecionados para o logger:

```javascript
console.log('Isso vai para logger.info');
console.error('Isso vai para logger.error');
console.warn('Isso vai para logger.warn');
console.info('Isso vai para logger.info');
console.debug('Isso vai para logger.debug');
console.system('Isso vai para logger.system); // NOVA função
```

## Vantagens deste Sistema

1. **Visibilidade Total**: Nenhuma operação do sistema fica oculta
2. **Registro Duplo**: Arquivos específicos por nível + arquivo completo
3. **Performance**: Otimizado para ter baixo impacto no sistema
4. **Detalhamento**: Metadados estruturados para análise posterior
5. **Flexibilidade**: Controle do que aparece no console vs. o que é registrado em arquivo
6. **Segurança**: Mesmo em caso de falha, tenta ao máximo preservar os logs 