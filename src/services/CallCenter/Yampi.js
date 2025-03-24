import axios from 'axios';

const YAMPI_API_URL = process.env.YAMPI_API_URL;
const YAMPI_API_KEY = process.env.YAMPI_API_KEY;

export async function buscarPedidos(cpf) {
    try {
        console.log('Buscando pedidos para CPF:', cpf);
        
        const response = await axios.get(`${YAMPI_API_URL}/pedidos`, {
            headers: {
                'Authorization': `Bearer ${YAMPI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            params: {
                cpf: cpf
            }
        });

        return response.data;
    } catch (error) {
        console.error('Erro ao buscar pedidos na Yampi:', error.message);
        throw error;
    }
} 