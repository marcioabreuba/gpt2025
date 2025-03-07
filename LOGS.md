# Sistema de Logs - Versão Robusta

Este documento descreve o sistema de logs do projeto, com foco em simplicidade e robustez.

## Níveis de Log

O sistema utiliza os seguintes níveis, em ordem de prioridade:

- **ERROR**: Para erros críticos
- **WARN**: Para avisos importantes
- **INFO**: Para informações gerais (nível padrão)
- **DEBUG**: Para informações detalhadas
- **TRACE**: Para informações extremamente detalhadas

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
2023-08-20 15:30:45.123 [INFO] Consulta realizada
{
  "duracao": 325,
  "tipo": "shopify",
  "resultado": "sucesso"
}
```

## Arquivos de Log

Os logs são salvos em arquivos específicos:
- `logs/app.log`: Todos os logs da aplicação
- `logs/error.log`: Apenas logs de erro (para facilitar a detecção de problemas)
- `logs/chat.log`: Conversas entre usuários e o sistema

## Configuração

O nível de log pode ser configurado através da variável de ambiente `LOG_LEVEL`:

```
# No arquivo .env
LOG_LEVEL=info  # Valores: error, warn, info, debug, trace
```

## Como usar o Logger

### Uso Básico

```javascript
import logger from '../utils/logger.js';

// Logs simples
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
```

### Logs de Conversação

```javascript
// Mensagem do usuário para a Sofia
logger.userMessage('5511999998888', 'Quero saber sobre meu pedido');

// Resposta da Sofia para o usuário
logger.iaMessage('5511999998888', 'Vou buscar informações sobre seu pedido');
```

## Compatibilidade com console.log

Todos os métodos do console são redirecionados para o logger:

```javascript
console.log('Isso vai para logger.info');
console.error('Isso vai para logger.error');
console.warn('Isso vai para logger.warn');
console.info('Isso vai para logger.info');
console.debug('Isso vai para logger.debug');
```

## Vantagens deste Sistema

1. **Simplicidade**: Código direto e fácil de entender
2. **Performance**: Usa operações síncronas de baixo overhead
3. **Robustez**: Tratamento de erros em todas as operações
4. **Flexibilidade**: Suporte a metadados estruturados
5. **Visibilidade**: Logs coloridos no console e organizados por arquivo
6. **Facilidade de depuração**: Separação dos erros em arquivo próprio 