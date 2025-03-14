/**
 * Script para testar a remoção das citações no formato 【...】
 */

import cleanCitations from '../utils/cleanCitations.js';

// Exemplos de texto com citações
const examples = [
  'Márcio, temos várias opções de pagamento para facilitar sua compra:\n\n1. Cartão de Crédito: Parcelamos em até 10 vezes.\n2. PIX: Pagamento via Mercado Pago, com confirmação imediata para sua segurança.\n3. Boleto Bancário: Pode levar até 3 dias úteis para compensar【13:1†formas de pagamento.txt】.\n\nSe precisar de mais alguma informação ou ajuda para finalizar a compra, estou à disposição! 😊',
  
  'Olá! Sou Sofia, consultora de moda da Sol & Terra! 💖\n\nNa nossa loja, você pode parcelar suas compras em até 10 vezes no cartão de crédito. Também aceitamos pagamentos via Pix, que são processados pelo Mercado Pago para sua segurança e têm confirmação imediata. Além disso, oferecemos a opção de boleto bancário, que pode levar até 3 dias úteis para compensar【5:0†formas de pagamento.txt】.\n\nSe precisar de mais alguma coisa ou quiser conhecer nossas novidades, estou aqui para ajudar! Como posso te chamar? ✨',
  
  'Teste com múltiplas citações 【1:2†arquivo1.txt】 no meio 【3:4†arquivo2.txt】 do texto.'
];

// Testar a função cleanCitations
examples.forEach((example, index) => {
  console.log(`\n=== Exemplo ${index + 1} ===`);
  console.log('Original:');
  console.log(example);
  console.log('\nLimpo:');
  console.log(cleanCitations(example));
  console.log('====================\n');
});

// Testar diretamente a expressão regular
console.log('\n--- Teste direto da expressão regular ---');
const regex = /【[^】]*】/g;
console.log('Original:');
console.log(examples[0]);
console.log('\nLimpo com regex:');
console.log(examples[0].replace(regex, '')); 