# Lidando com Avisos de Depreciação

Este documento explica como resolver os avisos de depreciação do módulo `punycode` e outros avisos do Node.js.

## O Problema

Você pode estar vendo avisos como:

```
[ERROR] (node:116) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
```

Estes não são erros reais, mas avisos de depreciação do Node.js sobre módulos que serão removidos em versões futuras.

## Soluções Implementadas

Implementamos três soluções diferentes para lidar com estes avisos:

### 1. Filtro no Logger (Automático)

O sistema de logs foi configurado para filtrar automaticamente estes avisos. Essa configuração:

- Ignora avisos de depreciação no console e nos arquivos de log
- Mantém apenas mensagens de erro reais
- Não requer nenhuma ação adicional

### 2. Script de Inicialização Personalizado

Criamos um script `start.js` que inicia a aplicação ignorando os avisos de depreciação.
Este é o método padrão de inicialização agora:

```bash
npm start
# ou
yarn start
```

### 3. Flag de Linha de Comando

Se preferir, você pode iniciar diretamente usando a flag `--no-warnings` do Node.js:

```bash
npm run start:no-warnings
# ou
yarn start:no-warnings
```

## Causa do Aviso

O aviso de depreciação do `punycode` ocorre porque:

1. Alguma dependência do projeto usa este módulo interno do Node.js
2. O Node.js planeja remover este módulo em versões futuras
3. A recomendação é usar uma biblioteca externa no lugar

## Solução Definitiva

Para resolver permanentemente este problema, teríamos que:

1. Identificar quais pacotes estão usando o módulo `punycode`
2. Atualizar esses pacotes para versões mais recentes
3. Ou substituir esses pacotes por alternativas

Isso exigiria uma análise de dependências completa e potencialmente quebrar compatibilidade, por isso optamos pela solução de filtrar os avisos por enquanto. 