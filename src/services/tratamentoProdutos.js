export const tratamentoProdutos = async (produtos) => {
    try {
      // produtos é um array de objetos que contém os produtos selecionados pelo usuário.
      // Criar um serviço que separa em duas variáveis:
      // - idsName: contendo os campos "id" e "title" de cada produto.
      // - idsImages: contendo para cada produto, o "id" e cada "image" presente no array "images".
  
      // Mapeia os produtos para obter apenas id e title
      const idsName = produtos.map(produto => ({
        id: produto.id,
        title: produto.title,
      }));
  
      // Para cada produto, mapeia cada imagem presente no array "images"
      // e cria um novo array de objetos contendo o id do produto e a respectiva image.
      const idsImages = produtos.flatMap(produto =>
        produto.images.map(image => ({
          id: produto.id,
          image: image.src,
          variants: produto.variants.map(variante => ({
            id: variante.id,
            title: variante.title,            
          })),
        })));

      // Para cada produto, mapeia cada descrição e cria um novo array de objetos contendo o id do produto e a respectiva descrição.
      const idsDescription = produtos.map(produto => ({
        id: produto.id,
        description: produto.body_html ? produto.body_html.replace(/<[^>]*>?/g, '') : '',
      }));
  
      // Retorna as duas variáveis em um objeto
      return { idsName, idsImages, idsDescription };
    } catch (error) {
      return false;
    }
  };
