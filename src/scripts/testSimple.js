// Teste simples para verificar problemas de execução
console.log('===============================');
console.log('Iniciando teste simples');
console.log('===============================');

// Importar a função de limpeza de links
import cleanLinks from '../utils/cleanLinks.js';

// Testar com exemplos
const exemplos = [
  // Exemplo 1: Link com formatação markdown
  'Você pode conferir o produto através do link: [Kaftan Exuberante Preto e Dourado](https://www.tropicalize.com.br/products/kaftan-exuberante-preto-e-dourado).',
  
  // Exemplo 2: Link direto com https e www
  'Visite nosso site em https://www.tropicalize.com.br para mais produtos.',
  
  // Exemplo 3: Link para site externo
  'Consulte também o site do correio em https://www.correios.com.br',
  
  // Exemplo 4: Link com placeholder
  'Veja seu rastreamento em Link: correios.com.br/rastreamento/CÓDIGO_RASTREIO',
  
  // Exemplo 5: Múltiplos links
  'Confira estes produtos: [Vestido Azul](https://tropicalize.com.br/products/vestido-azul) e [Saída de Praia](https://www.tropicalize.com.br/products/saida)'
];

// Testar cada exemplo
exemplos.forEach((exemplo, index) => {
  console.log(`\n----- Exemplo ${index + 1} -----`);
  console.log('Entrada:', exemplo);
  
  try {
    const resultado = cleanLinks(exemplo);
    console.log('Resultado:', resultado);
  } catch (error) {
    console.error('ERRO:', error);
  }
});

console.log('\n===============================');
console.log('Teste simples concluído');
console.log('==============================='); 