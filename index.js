import 'dotenv/config';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL;
const TOKEN_COMMERCE = process.env.TOKEN_COMMERCE;

// Función para crear logs con timestamp
const crearLog = (mensaje, tipo = 'INFO', datos = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    tipo,
    mensaje,
    datos
  };
  
  const logString = `[${timestamp}] [${tipo}] ${mensaje}${datos ? ` | Datos: ${JSON.stringify(datos)}` : ''}`;
  console.log(logString);
  
  // Guardar en archivo de log
  const logDir = './logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, `credito-inmediato-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logString + '\n');
  
  return logEntry;
};

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
  crearLog('Iniciando verificación de transacción', 'VERIFICATION', { id });
  
  const tokenAuthorization = generateHmacSha256(id, TOKEN_COMMERCE);
  crearLog('Token de autorización para verificación generado', 'INFO', { 
    id, 
    tokenAuthorization: tokenAuthorization.substring(0, 10) + '...' 
  });
  
  try {
    crearLog('Enviando petición de verificación', 'API_REQUEST', {
      url: `${BASE_URL}/ConsultarOperaciones`,
      method: 'POST',
      id
    });
    
    const response = await axios.post(`${BASE_URL}/ConsultarOperaciones`, {
      id
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': tokenAuthorization,
        'Commerce': TOKEN_COMMERCE
      }
    });
    
    crearLog('Respuesta de verificación recibida', 'API_RESPONSE', {
      status: response.status,
      data: response.data
    });
    
    if (response.data.code === 'ACCP') {
      crearLog('Transacción verificada exitosamente', 'SUCCESS', {
        code: response.data.code,
        reference: response.data.reference
      });
      return { success: true, reference: response.data.reference };
    } else {
      crearLog('Transacción aún pendiente', 'WARNING', {
        code: response.data.code,
        message: response.data.message || 'Transacción en proceso'
      });
      return { success: false, stillPending: true };
    }
  } catch (error) {
    crearLog('Error en verificación de transacción', 'ERROR', {
      id,
      message: error.message,
      responseData: error.response?.data
    });
    return { success: false };
  }
};

const verificarTransaccionPeriodicamente = async (id, maxIntentos = 12) => {
  crearLog('Iniciando verificación periódica de transacción', 'VERIFICATION_PERIODIC', { 
    id, 
    maxIntentos 
  });
  
  for (let intento = 1; intento <= maxIntentos; intento++) {
    crearLog(`Intento de verificación ${intento}/${maxIntentos}`, 'VERIFICATION_ATTEMPT', { 
      intento, 
      maxIntentos, 
      id 
    });
    
    const resultado = await verificarTransaccion(id);
    if (resultado.success) {
      crearLog('Transacción completada exitosamente', 'SUCCESS', { 
        intento, 
        reference: resultado.reference 
      });
      console.log(`✅ Transacción completada exitosamente en el intento ${intento}`);
      return resultado;
    }
    
    if (intento < maxIntentos) {
      crearLog('Esperando 5 segundos antes del siguiente intento', 'WAIT', { 
        intento, 
        tiempoEspera: 5000 
      });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  crearLog('Tiempo de espera agotado para verificación periódica', 'TIMEOUT', { 
    id, 
    maxIntentos 
  });
  console.log('⏰ Tiempo de espera agotado. La transacción aún está en proceso.');
  return { success: false, timeout: true };
};

const solicitarDatosCredito = () => {
  return new Promise((resolve) => {
    crearLog('Iniciando solicitud de datos para Crédito Inmediato', 'INFO');
    console.log('\n=== Datos para Crédito Inmediato ===');
    
    rl.question('Cédula (ej: V12345678): ', (cedula) => {
      crearLog('Cédula ingresada', 'INPUT', { cedula: cedula.trim() });
      
      rl.question('Cuenta (20 dígitos): ', (cuenta) => {
        crearLog('Cuenta ingresada', 'INPUT', { cuenta: cuenta.trim() });
        
        rl.question('Monto (ej: 10.00): ', (monto) => {
          crearLog('Monto ingresado', 'INPUT', { monto: monto.trim() });
          
          rl.question('Concepto (ej: Prueba 854): ', (concepto) => {
            crearLog('Concepto ingresado', 'INPUT', { concepto: concepto.trim() });
            
            const datosCompletos = {
              cedula: cedula.trim(),
              cuenta: cuenta.trim(),
              monto: monto.trim(),
              concepto: concepto.trim()
            };
            
            crearLog('Datos completos recopilados para Crédito Inmediato', 'SUCCESS', datosCompletos);
            resolve(datosCompletos);
          });
        });
      });
    });
  });
};

const procesarCreditoInmediato = async (datos) => {
  crearLog('Iniciando procesamiento de Crédito Inmediato', 'INFO', datos);
  console.log('\n=== Procesando Crédito Inmediato ===');
  
  const tokenData = `${datos.cedula}${datos.cuenta}${datos.monto}`;
  const tokenAuthorization = generateHmacSha256(tokenData, TOKEN_COMMERCE);
  
  crearLog('Token de autorización generado', 'INFO', { 
    tokenData, 
    tokenAuthorization: tokenAuthorization.substring(0, 10) + '...' 
  });

  try {
    crearLog('Enviando petición a la API de Crédito Inmediato', 'API_REQUEST', {
      url: `${BASE_URL}/CICuentas`,
      method: 'POST',
      datos: {
        Cedula: datos.cedula,
        Cuenta: datos.cuenta,
        Monto: datos.monto,
        Concepto: datos.concepto
      }
    });
    
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
    
    crearLog('Respuesta recibida de la API de Crédito Inmediato', 'API_RESPONSE', {
      status: response.status,
      statusText: response.statusText,
      data: response.data
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
      crearLog('Crédito Inmediato procesado exitosamente', 'SUCCESS', {
        code: response.data.code,
        reference: response.data.reference
      });
      return { success: true, reference: response.data.reference };
    } else if (response.data.code === 'AC00' && response.data.id) {
      crearLog('Crédito Inmediato requiere verificación', 'WARNING', {
        code: response.data.code,
        id: response.data.id
      });
      return { success: false, id: response.data.id, needsVerification: true };
    } else {
      crearLog('Crédito Inmediato falló', 'ERROR', {
        code: response.data.code,
        message: response.data.message || 'Sin mensaje específico'
      });
      return { success: false };
    }
  } catch (error) {
    crearLog('Error en la petición de Crédito Inmediato', 'ERROR', {
      message: error.message,
      responseData: error.response?.data,
      status: error.response?.status
    });
    console.error('Error al procesar crédito inmediato:', error.response?.data || error.message);
    return { success: false };
  }
};

const procesoCreditoInmediato = async () => {
  crearLog('=== INICIO DEL PROCESO DE CRÉDITO INMEDIATO ===', 'PROCESS_START');
  
  try {
    crearLog('Solicitando datos del usuario', 'USER_INPUT_START');
    const datos = await solicitarDatosCredito();
    console.log('\nDatos ingresados:', datos);
    crearLog('Datos del usuario recopilados exitosamente', 'USER_INPUT_SUCCESS', datos);
    
    crearLog('Procesando crédito inmediato con los datos proporcionados', 'PROCESSING_START');
    const resultadoCredito = await procesarCreditoInmediato(datos);
    
    if (resultadoCredito.success) {
      crearLog('Proceso de crédito inmediato completado exitosamente', 'PROCESS_SUCCESS', {
        reference: resultadoCredito.reference
      });
      console.log(`\n🎉 ¡Crédito inmediato completado exitosamente!`);
      console.log(`Referencia: ${resultadoCredito.reference}`);
      crearLog('=== FIN DEL PROCESO DE CRÉDITO INMEDIATO - EXITOSO ===', 'PROCESS_END_SUCCESS');
      rl.close();
    } else if (resultadoCredito.needsVerification) {
      crearLog('Proceso requiere verificación adicional', 'VERIFICATION_REQUIRED', {
        id: resultadoCredito.id
      });
      console.log(`\n🔄 La transacción requiere verificación. ID: ${resultadoCredito.id}`);
      
      crearLog('Iniciando proceso de verificación periódica', 'VERIFICATION_PROCESS_START');
      const resultadoVerificacion = await verificarTransaccionPeriodicamente(resultadoCredito.id);
      
      if (resultadoVerificacion.success) {
        crearLog('Verificación completada exitosamente', 'VERIFICATION_SUCCESS', {
          reference: resultadoVerificacion.reference
        });
        console.log(`\n🎉 ¡Crédito inmediato verificado y completado!`);
        console.log(`Referencia: ${resultadoVerificacion.reference}`);
        crearLog('=== FIN DEL PROCESO DE CRÉDITO INMEDIATO - VERIFICADO ===', 'PROCESS_END_SUCCESS');
      } else {
        crearLog('Verificación agotó tiempo de espera', 'VERIFICATION_TIMEOUT', {
          id: resultadoCredito.id
        });
        console.log('\n⏰ La transacción aún está en proceso después del tiempo de espera.');
        crearLog('=== FIN DEL PROCESO DE CRÉDITO INMEDIATO - TIMEOUT ===', 'PROCESS_END_TIMEOUT');
      }
      rl.close();
    } else {
      crearLog('Proceso de crédito inmediato falló', 'PROCESS_FAILED');
      console.log('\n❌ Error en el proceso de crédito inmediato.');
      crearLog('=== FIN DEL PROCESO DE CRÉDITO INMEDIATO - FALLIDO ===', 'PROCESS_END_FAILED');
      rl.close();
    }
  } catch (error) {
    crearLog('Error inesperado en el proceso de crédito inmediato', 'PROCESS_ERROR', {
      message: error.message,
      stack: error.stack
    });
    console.error('Error en el proceso:', error);
    crearLog('=== FIN DEL PROCESO DE CRÉDITO INMEDIATO - ERROR ===', 'PROCESS_END_ERROR');
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

const solicitarDatosC2P = () => {
  return new Promise((resolve) => {
    console.log('\n=== Datos para Cobro C2P ===');
    rl.question('Teléfono Destino (ej: 04145555555): ', (telefonoDestino) => {
      rl.question('Cédula (ej: V12345678): ', (cedula) => {
        rl.question('Concepto (ej: PRUEBA): ', (concepto) => {
          rl.question('Banco (ej: 0105): ', (banco) => {
            rl.question('IP (ej: 192.168.1.20): ', (ip) => {
              rl.question('Monto (ej: 1.15): ', (monto) => {
                rl.question('OTP (ej: 13309525): ', (otp) => {
                  resolve({
                    telefonoDestino: telefonoDestino.trim(),
                    cedula: cedula.trim(),
                    concepto: concepto.trim(),
                    banco: banco.trim(),
                    ip: ip.trim(),
                    monto: monto.trim(),
                    otp: otp.trim()
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

const procesarCobroC2P = async (datos) => {
  console.log('\n=== Procesando Cobro C2P ===');
  const tokenData = `${datos.telefonoDestino}${datos.monto}${datos.banco}${datos.cedula}`;
  const tokenAuthorization = generateHmacSha256(tokenData, TOKEN_COMMERCE);

  try {
    const response = await axios.post(`${BASE_URL}/MBc2p`, {
      TelefonoDestino: datos.telefonoDestino,
      Cedula: datos.cedula,
      Concepto: datos.concepto,
      Banco: datos.banco,
      Ip: datos.ip,
      Monto: datos.monto,
      Otp: datos.otp
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': tokenAuthorization,
        'Commerce': TOKEN_COMMERCE
      }
    });
    console.log('=== Respuesta Completa de MiBanco - Cobro C2P ===');
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
    
    if (response.data.code === '00') {
      console.log('✅ Cobro C2P exitoso');
      return { success: true, reference: response.data.reference, message: response.data.message };
    } else {
      console.log(`❌ Cobro C2P rechazado - Código: ${response.data.code}, Mensaje: ${response.data.message}`);
      return { success: false, code: response.data.code, message: response.data.message };
    }
  } catch (error) {
    console.error('Error al procesar Cobro C2P:', error.response?.data || error.message);
    return { success: false };
  }
};

const procesoCobroC2P = async () => {
  try {
    const datos = await solicitarDatosC2P();
    console.log('\nDatos ingresados:', datos);
    
    const resultadoC2P = await procesarCobroC2P(datos);
    if (resultadoC2P.success) {
      console.log(`\n🎉 ¡Cobro C2P completado exitosamente!`);
      console.log(`Mensaje: ${resultadoC2P.message}`);
      console.log(`Referencia: ${resultadoC2P.reference}`);
    } else {
      console.log(`\n❌ Error en el proceso de Cobro C2P.`);
      console.log(`Código de error: ${resultadoC2P.code}`);
      console.log(`Mensaje: ${resultadoC2P.message}`);
    }
    rl.close();
  } catch (error) {
    console.error('Error en el proceso:', error);
    rl.close();
  }
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
  console.log('3. Cobro C2P');
  console.log('4. Consulta de tasa BCV');
  rl.question('Seleccione una opción (1, 2, 3 o 4): ', async (opcion) => {
    if (opcion.trim() === '1') {
      await procesoDebitoInmediato();
    } else if (opcion.trim() === '2') {
      await procesoCreditoInmediato();
    } else if (opcion.trim() === '3') {
      await procesoCobroC2P();
    } else if (opcion.trim() === '4') {
      await consultarTasaBcv();
    } else {
      console.log('Opción no válida');
      rl.close();
    }
  });
};

main();