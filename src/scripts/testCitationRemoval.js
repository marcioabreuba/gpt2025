/**
 * Script para testar a remoção de citações das respostas da OpenAI
 */

// Função para remover citações (cópia da implementada em zapiService.js)
function removeCitations(message) {
  if (!message) return message;
  
  // Padrão 1: Remove citações no formato 【n:n†source】
  let cleanedMessage = message.replace(/【\d+:\d+†source】/g, '');
  
  // Padrão 2: Remove citações no formato 【n†source】
  cleanedMessage = cleanedMessage.replace(/【\d+†source】/g, '');
  
  // Padrão 3: Remove citações no formato [n]
  cleanedMessage = cleanedMessage.replace(/\[\d+\]/g, '');
  
  // Padrão 4: Remove citações no formato (Citation: n)
  cleanedMessage = cleanedMessage.replace(/\(Citation: \d+\)/g, '');
  
  // Remove espaços extras que podem ter ficado após a remoção
  cleanedMessage = cleanedMessage.replace(/\s{2,}/g, ' ').trim();
  
  return cleanedMessage;
}

// Casos de teste
const testCases = [
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
  }
];

// Executa os testes
console.log("Testando remoção de citações das respostas OpenAI...\n");

let passedTests = 0;
let failedTests = 0;

testCases.forEach((test, index) => {
  const result = removeCitations(test.input);
  const passed = result === test.expected;
  
  console.log(`Teste ${index + 1}: ${passed ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`Input:    "${test.input}"`);
  console.log(`Resultado: "${result}"`);
  console.log(`Esperado:  "${test.expected}"`);
  console.log();
  
  if (passed) {
    passedTests++;
  } else {
    failedTests++;
  }
});

console.log("Resumo dos Testes:");
console.log(`✅ Testes bem-sucedidos: ${passedTests}`);
console.log(`❌ Testes falhos: ${failedTests}`);
console.log(`Total de testes: ${testCases.length}`);

if (failedTests === 0) {
  console.log("\n🎉 Todos os testes passaram! A função está removendo citações corretamente.");
} else {
  console.log("\n⚠️ Alguns testes falharam. Verifique a implementação da função.");
} 