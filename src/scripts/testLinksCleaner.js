// Este script testa a funcionalidade de limpeza de links

import cleanLinks from '../utils/cleanLinks.js';
import config from '../config.js';

console.log('\n===== TESTE DE LIMPEZA DE LINKS =====\n');

// URL da loja configurada
const storeUrl = config.store.url;
const storeUrlBase = storeUrl.replace(/^www\./i, '');

// Exemplos de textos com diferentes formatos de links para testar
const testCases = [
  // Teste 1: Link com formatação markdown
  {
    input: `Você pode conferir o produto através do link: [Kaftan Exuberante Preto e Dourado](https://www.${storeUrl}/products/kaftan-exuberante-preto-e-dourado).`,
    expected: `Você pode conferir o produto através do link: Kaftan Exuberante Preto e Dourado\nLink: ${storeUrlBase}/products/kaftan-exuberante-preto-e-dourado.`
  },
  
  // Teste 2: Link direto com https e www
  {
    input: `Visite nosso site em https://www.${storeUrl} para mais produtos.`,
    expected: `Visite nosso site em Link: ${storeUrlBase} para mais produtos.`
  },
  
  // Teste 3: Link para site externo - deve ser removido
  {
    input: 'Consulte também o site do correio em https://www.correios.com.br',
    expected: 'Consulte também o site do correio em correios.com.br'
  },
  
  // Teste 4: Link com placeholder - deve ser removido
  {
    input: 'Veja seu rastreamento em Link: correios.com.br/rastreamento/CÓDIGO_RASTREIO',
    expected: 'Veja seu rastreamento em '
  },
  
  // Teste 5: Múltiplos links em um texto
  {
    input: `Confira estes produtos: [Vestido Azul](https://${storeUrl}/products/vestido-azul) e [Saída de Praia](https://www.${storeUrl}/products/saida)`,
    expected: `Confira estes produtos: Vestido Azul\nLink: ${storeUrlBase}/products/vestido-azul e Saída de Praia\nLink: ${storeUrlBase}/products/saida`
  },
  
  // Teste 6: O exemplo do problema original 
  {
    input: `Você pode conferir o produto através do link: [Kaftan Exuberante Preto e Dourado](https://www.${storeUrl}/products/kaftan-exuberante-preto-e-dourado).`,
    expected: `Você pode conferir o produto através do link: Kaftan Exuberante Preto e Dourado\nLink: ${storeUrlBase}/products/kaftan-exuberante-preto-e-dourado.`
  }
];

console.log('Iniciando testes de limpeza de links...\n');

// Executar os testes
let passedTests = 0;
let failedTests = 0;

// Teste da função
testCases.forEach((test, index) => {
  console.log(`\n===== TESTE ${index + 1} =====`);
  console.log(`INPUT: "${test.input}"`);
  
  try {
    const result = cleanLinks(test.input);
    console.log(`\nRESULTADO: "${result}"`);
    console.log(`ESPERADO: "${test.expected}"`);
    
    if (result === test.expected) {
      console.log('\n✅ PASSOU ✅');
      passedTests++;
    } else {
      console.log('\n❌ FALHOU ❌');
      failedTests++;
      
      // Exibir diferenças caracter por caracter em caso de falha
      console.log('\nDiferenças:');
      for (let i = 0; i < Math.max(result.length, test.expected.length); i++) {
        if (result[i] !== test.expected[i]) {
          const resultChar = result[i] || '[FALTANDO]';
          const expectedChar = test.expected[i] || '[FALTANDO]';
          console.log(`  Posição ${i}: Obtido="${resultChar}" ⊗ Esperado="${expectedChar}"`);
        }
      }
    }
  } catch (error) {
    console.log(`\n❌ ERRO NO TESTE: ${error.message}`);
    failedTests++;
  }
});

// Resumo dos testes
console.log(`\n===== RESUMO =====`);
console.log(`✅ Testes passados: ${passedTests}`);
console.log(`❌ Testes falhos: ${failedTests}`);
console.log(`Total de testes: ${testCases.length}`);
console.log(`\n${passedTests === testCases.length ? '🎉 TODOS OS TESTES PASSARAM! 🎉' : '⚠️ ALGUNS TESTES FALHARAM! ⚠️'}`);
console.log('\n======================='); 