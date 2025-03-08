/**
 * Script para testar a remoção de citações das respostas da OpenAI
 */

import { removeCitations, formatWhatsAppMessage } from '../utils/textUtils.js';

// Casos de teste para remoção de citações
const citationTestCases = [
  {
    input: "O prazo de garantia para troca ou devolução é de até 7 dias corridos, contados a partir da data indicada no comprovante de rastreio dos Correios. É importante lembrar que variações de até 5% nas cores e tamanhos dos produtos são admissíveis【5:0†source】.",
    expected: "O prazo de garantia para troca ou devolução é de até 7 dias corridos, contados a partir da data indicada no comprovante de rastreio dos Correios. É importante lembrar que variações de até 5% nas cores e tamanhos dos produtos são admissíveis."
  },
  {
    input: "Esses prazos são máximos e a entrega pode acontecer antes do previsto. Todos os prazos são contados em dias úteis, excluindo sábados, domingos e feriados. Em casos excepcionais, os prazos podem se estender para até 60 dias úteis devido a atrasos da transportadora internacional【9:0†source】.",
    expected: "Esses prazos são máximos e a entrega pode acontecer antes do previsto. Todos os prazos são contados em dias úteis, excluindo sábados, domingos e feriados. Em casos excepcionais, os prazos podem se estender para até 60 dias úteis devido a atrasos da transportadora internacional."
  },
  {
    input: "De acordo com o artigo [1], o limite de temperatura para armazenamento é de 30°C.",
    expected: "De acordo com o artigo, o limite de temperatura para armazenamento é de 30°C."
  },
  {
    input: "A política de cancelamento (Citation: 3) permite reembolso integral em até 24h após a compra.",
    expected: "A política de cancelamento permite reembolso integral em até 24h após a compra."
  },
  {
    input: "Mensagem sem nenhuma citação para testar.",
    expected: "Mensagem sem nenhuma citação para testar."
  },
  {
    input: "Mensagem com múltiplas citações【1:2†source】 no meio【3†source】 do texto【4:5†source】.",
    expected: "Mensagem com múltiplas citações no meio do texto."
  },
  {
    input: 'Segundo a documentação {"citation": [{"type": "document", "document_id": "abc123", "quote": "citação aqui"}]}, esse é o procedimento.',
    expected: 'Segundo a documentação, esse é o procedimento.'
  }
];

// Casos de teste para formatação completa
const formattingTestCases = [
  {
    input: "Texto com **negrito** e [links protegidos] e citação【5:0†source】.",
    expected: "Texto com *negrito* e e citação."
  },
  {
    input: "Texto com **múltiplas** formatações **diferentes** e [links protegidos] além de citação【5:0†source】.",
    expected: "Texto com *múltiplas* formatações *diferentes* e além de citação."
  }
];

// Executa os testes de remoção de citações
console.log("🧪 Testando remoção de citações...\n");

let passedCitationTests = 0;
let failedCitationTests = 0;

citationTestCases.forEach((test, index) => {
  const result = removeCitations(test.input);
  const passed = result === test.expected;
  
  console.log(`Teste ${index + 1}: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
  if (!passed) {
    console.log(`Input:    "${test.input}"`);
    console.log(`Resultado: "${result}"`);
    console.log(`Esperado:  "${test.expected}"`);
    console.log();
  }
  
  if (passed) {
    passedCitationTests++;
  } else {
    failedCitationTests++;
  }
});

// Executa os testes de formatação completa
console.log("\n🧪 Testando formatação completa para WhatsApp...\n");

let passedFormattingTests = 0;
let failedFormattingTests = 0;

formattingTestCases.forEach((test, index) => {
  const result = formatWhatsAppMessage(test.input);
  const passed = result === test.expected;
  
  console.log(`Teste ${index + 1}: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
  if (!passed) {
    console.log(`Input:    "${test.input}"`);
    console.log(`Resultado: "${result}"`);
    console.log(`Esperado:  "${test.expected}"`);
    console.log();
  }
  
  if (passed) {
    passedFormattingTests++;
  } else {
    failedFormattingTests++;
  }
});

// Resumo dos testes
console.log("\n📊 Resumo dos Testes:");
console.log(`Remoção de citações: ${passedCitationTests}/${citationTestCases.length} testes passaram`);
console.log(`Formatação completa: ${passedFormattingTests}/${formattingTestCases.length} testes passaram`);
console.log(`Total: ${passedCitationTests + passedFormattingTests}/${citationTestCases.length + formattingTestCases.length} testes passaram`);

if (failedCitationTests + failedFormattingTests === 0) {
  console.log("\n🎉 Todos os testes passaram! A formatação de mensagens está funcionando corretamente.");
} else {
  console.log("\n⚠️ Alguns testes falharam. Verifique a implementação das funções.");
} 