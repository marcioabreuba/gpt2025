# Serviço de Alternância entre IA e Atendimento Humano

Este documento descreve a implementação do serviço de alternância entre atendimento automatizado pela IA (Sofia) e atendimento humano (Helena).

## Visão Geral

O sistema permite:

1. Por padrão, a IA (Sofia) responde normalmente aos usuários
2. Um operador humano pode assumir a conversa enviando a mensagem "Olá aqui é a Helena"
3. Quando no modo humano, todas as mensagens são enviadas diretamente pelo operador, não pela IA
4. O operador pode devolver o controle para a IA enviando "Vou passar pra Sofia"
5. Todo o histórico de mensagens (IA e humanas) é mantido na mesma thread
6. Conversas com intervenção humana são marcadas para treinamento prioritário

## Componentes Implementados

### 1. Serviço de Alternância Humana (`humanHandoffService.js`)

- `isInHumanMode(phone)`: Verifica se um telefone está no modo de atendimento humano
- `enableHumanMode(phone, threadId)`: Ativa o modo de atendimento humano
- `disableHumanMode(phone)`: Desativa o modo de atendimento humano
- `processHandoffCommand(message, phone, threadId)`: Processa comandos de alternância
- `sendHumanMessage(userId, phone, message, threadId)`: Envia mensagem do operador humano

### 2. Modificações no Serviço de Conversação (`conversationService.js`)

- Adicionamos verificações para detectar se o telefone está no modo humano
- Implementamos mapeamento de telefone para userId para facilitar o operador

### 3. Modificação no Webhook (`webhook.js`)

- Atualizado para processar mensagens do operador humano
- Verifica se está no modo humano para diferenciar mensagens da IA e do operador

### 4. API para Operador Humano (`human.js`)

- `POST /api/human/send`: Endpoint para o operador enviar mensagens
- `GET /api/human/active`: Lista telefones atualmente no modo humano

## Como Usar

### Ativar Modo Humano

Envie a mensagem: `Olá aqui é a Helena` para o número do usuário que deseja atender.

### Desativar Modo Humano

Envie a mensagem: `Vou passar pra Sofia` para retornar o controle à IA.

### Enviar Mensagem via API

```
POST /api/human/send
Headers: 
  Content-Type: application/json
  x-api-key: <API_KEY_ADMIN>
Body:
{
  "phone": "5511999999999",
  "message": "Olá, como posso ajudar?"
}
```

### Verificar Atendimentos Ativos

```
GET /api/human/active
Headers: 
  x-api-key: <API_KEY_ADMIN>
```

## Detalhes Técnicos

- Todas as mensagens são armazenadas no mesmo histórico de conversa
- Utilizamos o Redis para armazenar o estado de modo humano (`human_mode:{phone}`)
- Mensagens humanas são marcadas com `isHuman: true` para identificação
- Threads com intervenção humana são marcados para treinamento prioritário

## Limitações e Considerações

- O operador humano precisa conhecer os comandos exatos para alternar o modo
- A integração depende da estrutura atual do webhook e do serviço Z-API
- O sistema não notifica ativamente o operador sobre novas mensagens

---

Implementado por: [Seu Nome]
Data: [Data da Implementação] 