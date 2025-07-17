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
    console.log('Respuesta de DebitoInmediato:', response.data);
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
  rl.question('Seleccione una opción (1): ', async (opcion) => {
    if (opcion.trim() === '1') {
      await procesoDebitoInmediato();
    } else {
      console.log('Opción no válida');
      rl.close();
    }
  });
};

main();