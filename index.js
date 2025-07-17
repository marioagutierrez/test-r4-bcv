import 'dotenv/config';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import readline from 'readline';

const BASE_URL = process.env.BASE_URL;
const TOKEN_COMMERCE = process.env.TOKEN_COMMERCE;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const generateHmacSha256 = (data, key) => {
  return CryptoJS.HmacSHA256(data, key).toString();
};

const solicitarDatos = () => {
  return new Promise((resolve) => {
    console.log('\n=== Datos para Débito Inmediato ===');
    rl.question('Banco (4 dígitos): ', (banco) => {
      rl.question('Monto (ej: 50.00): ', (monto) => {
        rl.question('Teléfono (11 dígitos): ', (telefono) => {
          rl.question('Cédula (ej: V12345678): ', (cedula) => {
            rl.question('Nombre (ej: Maria Perez): ', (nombre) => {
              rl.question('Concepto (ej: Pago Condominio1): ', (concepto) => {
                resolve({
                  banco: banco.trim(),
                  monto: monto.trim(),
                  telefono: telefono.trim(),
                  cedula: cedula.trim(),
                  nombre: nombre.trim(),
                  concepto: concepto.trim()
                });
              });
            });
          });
        });
      });
    });
  });
};

const generarOtp = async (datos) => {
  console.log('\n=== Generando OTP ===');
  const tokenData = `${datos.banco}${datos.monto}${datos.telefono}${datos.cedula}`;
  const tokenAuthorization = generateHmacSha256(tokenData, TOKEN_COMMERCE);

  try {
    const response = await axios.post(`${BASE_URL}/GenerarOtp`, {
      Banco: datos.banco,
      Monto: datos.monto,
      Telefono: datos.telefono,
      Cedula: datos.cedula
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': tokenAuthorization,
        'Commerce': TOKEN_COMMERCE
      }
    });
    console.log('Respuesta de GenerarOtp:', response.data);
    if (response.data.code === '202') {
      console.log('✅ OTP generado exitosamente');
      return true;
    } else {
      console.log('❌ Error al generar OTP');
      return false;
    }
  } catch (error) {
    console.error('Error al generar OTP:', error.response?.data || error.message);
    return false;
  }
};

const procesarDebitoInmediato = async (datos, otp) => {
  console.log('\n=== Procesando Débito Inmediato ===');
  const tokenData = `${datos.banco}${datos.cedula}${datos.telefono}${datos.monto}${otp}`;
  const tokenAuthorization = generateHmacSha256(tokenData, TOKEN_COMMERCE);

  try {
    const response = await axios.post(`${BASE_URL}/DebitoInmediato`, {
      Banco: datos.banco,
      Monto: datos.monto,
      Telefono: datos.telefono,
      Cedula: datos.cedula,
      Nombre: datos.nombre,
      OTP: otp,
      Concepto: datos.concepto
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': tokenAuthorization,
        'Commerce': TOKEN_COMMERCE
      }
    });
    console.log('=== Respuesta Completa de MiBanco - Débito Inmediato ===');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data:', JSON.stringify(response.data, null, 2));
    console.log('Config:', JSON.stringify({
      url: response.config.url,
      method: response.config.method,
      headers: response.config.headers
    }, null, 2));
    console.log('=== Fin Respuesta Completa ===');
    if (response.data.code === 'ACCP') {
      return { success: true, id: response.data.id, reference: response.data.reference };
    } else if (response.data.code === 'AC00') {
      return { success: false, id: response.data.id, needsVerification: true };
    } else {
      return { success: false };
    }
  } catch (error) {
    console.error('Error al procesar débito inmediato:', error.response?.data || error.message);
    return { success: false };
  }
};

const verificarTransaccion = async (id) => {
  const tokenAuthorization = generateHmacSha256(id, TOKEN_COMMERCE);
  try {
    const response = await axios.post(`${BASE_URL}/ConsultarOperaciones`, {
      id
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': tokenAuthorization,
        'Commerce': TOKEN_COMMERCE
      }
    });
    if (response.data.code === 'ACCP') {
      return { success: true, reference: response.data.reference };
    } else {
      return { success: false, stillPending: true };
    }
  } catch (error) {
    return { success: false };
  }
};

const verificarTransaccionPeriodicamente = async (id, maxIntentos = 12) => {
  for (let intento = 1; intento <= maxIntentos; intento++) {
    const resultado = await verificarTransaccion(id);
    if (resultado.success) {
      console.log(`✅ Transacción completada exitosamente en el intento ${intento}`);
      return resultado;
    }
    if (intento < maxIntentos) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  console.log('⏰ Tiempo de espera agotado. La transacción aún está en proceso.');
  return { success: false, timeout: true };
};

const solicitarDatosCredito = () => {
  return new Promise((resolve) => {
    console.log('\n=== Datos para Crédito Inmediato ===');
    rl.question('Cédula (ej: V12345678): ', (cedula) => {
      rl.question('Cuenta (20 dígitos): ', (cuenta) => {
        rl.question('Monto (ej: 10.00): ', (monto) => {
          rl.question('Concepto (ej: Prueba 854): ', (concepto) => {
            resolve({
              cedula: cedula.trim(),
              cuenta: cuenta.trim(),
              monto: monto.trim(),
              concepto: concepto.trim()
            });
          });
        });
      });
    });
  });
};

const procesarCreditoInmediato = async (datos) => {
  console.log('\n=== Procesando Crédito Inmediato ===');
  const tokenData = `${datos.cedula}${datos.cuenta}${datos.monto}`;
  const tokenAuthorization = generateHmacSha256(tokenData, TOKEN_COMMERCE);

  try {
    const response = await axios.post(`${BASE_URL}/CICuentas`, {
      Cedula: datos.cedula,
      Cuenta: datos.cuenta,
      Monto: datos.monto,
      Concepto: datos.concepto
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': tokenAuthorization,
        'Commerce': TOKEN_COMMERCE
      }
    });
    console.log('=== Respuesta Completa de MiBanco - Crédito Inmediato ===');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data:', JSON.stringify(response.data, null, 2));
    console.log('Config:', JSON.stringify({
      url: response.config.url,
      method: response.config.method,
      headers: response.config.headers
    }, null, 2));
    console.log('=== Fin Respuesta Completa ===');
    if (response.data.code === 'ACCP') {
      return { success: true, reference: response.data.reference };
    } else if (response.data.code === 'AC00' && response.data.id) {
      return { success: false, id: response.data.id, needsVerification: true };
    } else {
      return { success: false };
    }
  } catch (error) {
    console.error('Error al procesar crédito inmediato:', error.response?.data || error.message);
    return { success: false };
  }
};

const procesoCreditoInmediato = async () => {
  try {
    const datos = await solicitarDatosCredito();
    console.log('\nDatos ingresados:', datos);
    const resultadoCredito = await procesarCreditoInmediato(datos);
    if (resultadoCredito.success) {
      console.log(`\n🎉 ¡Crédito inmediato completado exitosamente!`);
      console.log(`Referencia: ${resultadoCredito.reference}`);
      rl.close();
    } else if (resultadoCredito.needsVerification) {
      console.log(`\n🔄 La transacción requiere verificación. ID: ${resultadoCredito.id}`);
      const resultadoVerificacion = await verificarTransaccionPeriodicamente(resultadoCredito.id);
      if (resultadoVerificacion.success) {
        console.log(`\n🎉 ¡Crédito inmediato verificado y completado!`);
        console.log(`Referencia: ${resultadoVerificacion.reference}`);
      } else {
        console.log('\n⏰ La transacción aún está en proceso después del tiempo de espera.');
      }
      rl.close();
    } else {
      console.log('\n❌ Error en el proceso de crédito inmediato.');
      rl.close();
    }
  } catch (error) {
    console.error('Error en el proceso:', error);
    rl.close();
  }
};

const getToday = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const consultarTasaBcv = async () => {
  console.log('\n=== Consulta de tasa BCV ===');
  const tokenData = `${getToday()}USD`;
  const tokenAuthorization = generateHmacSha256(tokenData, TOKEN_COMMERCE);

  try {
    const response = await axios.post(`${BASE_URL}/MBbcv`, {
      Moneda: 'USD',
      Fechavalor: getToday()
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': tokenAuthorization,
        'Commerce': TOKEN_COMMERCE
      }
    });
    console.log('Respuesta completa de la API:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error en la respuesta de la API:', error.response.data);
    } else {
      console.error('Error en la petición:', error.message);
    }
  }
  rl.close();
};

const procesoDebitoInmediato = async () => {
  try {
    const datos = await solicitarDatos();
    const otpGenerado = await generarOtp(datos);
    if (!otpGenerado) {
      console.log('❌ No se pudo generar el OTP. Proceso cancelado.');
      rl.close();
      return;
    }
    const otp = await new Promise((resolve) => {
      rl.question('\nIngrese el OTP recibido (8 dígitos): ', (otp) => {
        resolve(otp.trim());
      });
    });
    const resultadoDebito = await procesarDebitoInmediato(datos, otp);
    if (resultadoDebito.success) {
      console.log(`\n🎉 ¡Transacción completada exitosamente!`);
      console.log(`Referencia: ${resultadoDebito.reference}`);
      console.log(`ID: ${resultadoDebito.id}`);
      rl.close();
    } else if (resultadoDebito.needsVerification) {
      console.log(`\n🔄 La transacción requiere verificación. ID: ${resultadoDebito.id}`);
      const resultadoVerificacion = await verificarTransaccionPeriodicamente(resultadoDebito.id);
      if (resultadoVerificacion.success) {
        console.log(`\n🎉 ¡Transacción verificada y completada!`);
        console.log(`Referencia: ${resultadoVerificacion.reference}`);
      } else {
        console.log('\n⏰ La transacción aún está en proceso después del tiempo de espera.');
      }
      rl.close();
    } else {
      console.log('\n❌ Error en el proceso de débito inmediato.');
      rl.close();
    }
  } catch (error) {
    console.error('Error en el proceso:', error);
    rl.close();
  }
};

const main = async () => {
  console.log('=== Sistema R4 Conecta ===');
  console.log('1. Proceso de Débito Inmediato');
  console.log('2. Proceso de Crédito Inmediato');
  console.log('3. Consulta de tasa BCV');
  rl.question('Seleccione una opción (1, 2 o 3): ', async (opcion) => {
    if (opcion.trim() === '1') {
      await procesoDebitoInmediato();
    } else if (opcion.trim() === '2') {
      await procesoCreditoInmediato();
    } else if (opcion.trim() === '3') {
      await consultarTasaBcv();
    } else {
      console.log('Opción no válida');
      rl.close();
    }
  });
};

main();