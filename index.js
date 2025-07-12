import 'dotenv/config';
import axios from 'axios';
import CryptoJS from 'crypto-js';

const BASE_URL = process.env.BASE_URL;
const TOKEN_COMMERCE = process.env.TOKEN_COMMERCE;

const generateHmacSha256 = (data, key) => {
    return CryptoJS.HmacSHA256(data, key).toString();
};

const getToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const consultarTasaBcv = async ({ moneda, fechavalor }) => {
    const tokenData = `${fechavalor}${moneda}`;
    const tokenAuthorization = generateHmacSha256(tokenData, TOKEN_COMMERCE);

    try {
        const response = await axios.post(`${BASE_URL}/MBbcv`, {
            Moneda: moneda,
            Fechavalor: fechavalor
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${tokenAuthorization}`,
                'Commerce': TOKEN_COMMERCE
            }
        });
        console.log('Respuesta completa de la API:', response);
    } catch (error) {
        if (error.response) {
            console.error('Error en la respuesta de la API:', error.response);
        } else {
            console.error('Error en la petición:', error.message);
        }
    }
};

const main = async () => {
    console.log('=== Consulta de tasa BCV ===');
    const moneda = 'USD';
    const fechavalor = getToday();
    await consultarTasaBcv({ moneda, fechavalor });
};

main();
