# Sistema de Logs para Crédito Inmediato

## Descripción
Se ha implementado un sistema completo de logs para rastrear todo el proceso de transacciones de crédito inmediato en el sistema R4 Conecta.

## Características del Sistema de Logs

### 1. Función de Logging (`crearLog`)
- **Timestamp automático**: Cada log incluye la fecha y hora exacta
- **Tipos de log**: INFO, ERROR, WARNING, SUCCESS, API_REQUEST, API_RESPONSE, etc.
- **Datos estructurados**: Información adicional en formato JSON
- **Doble salida**: Consola + archivo de log
- **Archivos diarios**: Un archivo por día en formato `credito-inmediato-YYYY-MM-DD.log`

### 2. Ubicación de los Logs
```
./logs/
├── credito-inmediato-2024-01-15.log
├── credito-inmediato-2024-01-16.log
└── ...
```

### 3. Tipos de Logs Implementados

#### Proceso Principal
- `PROCESS_START`: Inicio del proceso de crédito inmediato
- `PROCESS_END_SUCCESS`: Proceso completado exitosamente
- `PROCESS_END_FAILED`: Proceso fallido
- `PROCESS_END_ERROR`: Error inesperado
- `PROCESS_END_TIMEOUT`: Tiempo de espera agotado

#### Entrada de Usuario
- `USER_INPUT_START`: Inicio de solicitud de datos
- `USER_INPUT_SUCCESS`: Datos recopilados exitosamente
- `INPUT`: Cada campo ingresado por el usuario

#### Procesamiento
- `PROCESSING_START`: Inicio del procesamiento
- `API_REQUEST`: Petición enviada a la API
- `API_RESPONSE`: Respuesta recibida de la API
- `SUCCESS`: Operación exitosa
- `ERROR`: Error en la operación

#### Verificación
- `VERIFICATION`: Verificación individual de transacción
- `VERIFICATION_PERIODIC`: Inicio de verificación periódica
- `VERIFICATION_ATTEMPT`: Cada intento de verificación
- `VERIFICATION_SUCCESS`: Verificación exitosa
- `VERIFICATION_TIMEOUT`: Tiempo agotado en verificación
- `WAIT`: Tiempo de espera entre intentos

## Ejemplo de Logs

```
[2024-01-15T10:30:15.123Z] [PROCESS_START] === INICIO DEL PROCESO DE CRÉDITO INMEDIATO ===
[2024-01-15T10:30:15.124Z] [USER_INPUT_START] Solicitando datos del usuario
[2024-01-15T10:30:15.125Z] [INFO] Iniciando solicitud de datos para Crédito Inmediato
[2024-01-15T10:30:20.456Z] [INPUT] Cédula ingresada | Datos: {"cedula":"V12345678"}
[2024-01-15T10:30:25.789Z] [INPUT] Cuenta ingresada | Datos: {"cuenta":"01020123456789012345"}
[2024-01-15T10:30:30.123Z] [INPUT] Monto ingresado | Datos: {"monto":"100.00"}
[2024-01-15T10:30:35.456Z] [INPUT] Concepto ingresado | Datos: {"concepto":"Prueba de crédito"}
[2024-01-15T10:30:35.457Z] [SUCCESS] Datos completos recopilados para Crédito Inmediato | Datos: {"cedula":"V12345678","cuenta":"01020123456789012345","monto":"100.00","concepto":"Prueba de crédito"}
[2024-01-15T10:30:35.458Z] [USER_INPUT_SUCCESS] Datos del usuario recopilados exitosamente | Datos: {"cedula":"V12345678","cuenta":"01020123456789012345","monto":"100.00","concepto":"Prueba de crédito"}
[2024-01-15T10:30:35.459Z] [PROCESSING_START] Procesando crédito inmediato con los datos proporcionados
[2024-01-15T10:30:35.460Z] [INFO] Iniciando procesamiento de Crédito Inmediato | Datos: {"cedula":"V12345678","cuenta":"01020123456789012345","monto":"100.00","concepto":"Prueba de crédito"}
[2024-01-15T10:30:35.461Z] [INFO] Token de autorización generado | Datos: {"tokenData":"V1234567801020123456789012345100.00","tokenAuthorization":"a1b2c3d4e5..."}
[2024-01-15T10:30:35.462Z] [API_REQUEST] Enviando petición a la API de Crédito Inmediato | Datos: {"url":"https://api.mibanco.com/CICuentas","method":"POST","datos":{"Cedula":"V12345678","Cuenta":"01020123456789012345","Monto":"100.00","Concepto":"Prueba de crédito"}}
[2024-01-15T10:30:36.123Z] [API_RESPONSE] Respuesta recibida de la API de Crédito Inmediato | Datos: {"status":200,"statusText":"OK","data":{"code":"ACCP","reference":"REF123456789"}}
[2024-01-15T10:30:36.124Z] [SUCCESS] Crédito Inmediato procesado exitosamente | Datos: {"code":"ACCP","reference":"REF123456789"}
[2024-01-15T10:30:36.125Z] [PROCESS_SUCCESS] Proceso de crédito inmediato completado exitosamente | Datos: {"reference":"REF123456789"}
[2024-01-15T10:30:36.126Z] [PROCESS_END_SUCCESS] === FIN DEL PROCESO DE CRÉDITO INMEDIATO - EXITOSO ===
```

## Beneficios del Sistema de Logs

1. **Trazabilidad completa**: Cada paso del proceso está registrado
2. **Debugging facilitado**: Identificación rápida de problemas
3. **Auditoría**: Registro histórico de todas las transacciones
4. **Monitoreo**: Seguimiento en tiempo real del estado de las operaciones
5. **Análisis**: Datos estructurados para análisis posteriores
6. **Cumplimiento**: Registros para auditorías regulatorias

## Configuración

El sistema de logs se activa automáticamente cuando se ejecuta el proceso de crédito inmediato. Los archivos se crean en la carpeta `./logs/` con el formato de fecha correspondiente.

## Mantenimiento

- Los logs se acumulan diariamente
- Se recomienda implementar rotación de logs para evitar archivos muy grandes
- Los logs contienen información sensible, asegurar acceso restringido
- Considerar implementar compresión de logs antiguos
