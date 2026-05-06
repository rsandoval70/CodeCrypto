# Especificaciones de la Aplicacion DApp

## Objetivo

Construir una DApp web para registrar en blockchain evidencia de documentos firmados digitalmente, usando el contrato `FileHashRegistry`.

La DApp debe permitir:

- Generar hash del archivo en cliente.
- Firmar el mensaje `(hash + fecha)` con wallet del usuario.
- Registrar el archivo firmado en el smart contract.
- Validar si un archivo ya existe en cadena.
- Consultar lista de archivos registrados.

## Contrato objetivo

- Red local: `Anvil (chainId 31337)`
- Contrato: `FileHashRegistry`
- Direccion actual desplegada: `0x5FbDB2315678afecb367f032d93F642f64180aa3`

## Datos del registro

Por cada archivo se almacena:

- `fileHash (bytes32)`: hash SHA-256 (o equivalente) representado en `bytes32`.
- `fileDate (uint256)`: timestamp del documento.
- `authorizer (address)`: cuenta que firma el documento.
- `signature (bytes)`: firma ECDSA de `(fileHash, fileDate)`.
- `storedAt (uint256)`: timestamp on-chain de registro.
- `storedBy (address)`: cuenta que envia la transaccion.

## Requisitos funcionales

### 1) Registro de archivo

- El usuario selecciona un archivo.
- La app calcula `fileHash` en frontend.
- La app define `fileDate` (timestamp UTC).
- La wallet firma el mensaje del contrato.
- La app envia `registerFile(fileHash, fileDate, authorizer, signature)`.
- Mostrar hash de transaccion y confirmacion.

### 2) Validacion de archivo

- Validar si un hash ya existe con `isFileRegistered(fileHash)`.
- Validar consistencia del hash con `validateFileHash(fileHash)`.
- Validar cuenta autorizadora con `validateAuthorizedAccount(fileHash, account)`.
- Validacion combinada con `validateRegistration(fileHash, account)`.

### 3) Consulta de historial

- Consultar total con `totalFiles()`.
- Listar hashes con `getFileHashes()`.
- Listar registros completos con `getAllSignedFiles()`.
- Permitir ver detalle con `getFileRecord(fileHash)`.

## Requisitos no funcionales

- UX clara para estados: conectando wallet, firmando, confirmando tx.
- Manejo de errores legibles (firma rechazada, hash duplicado, red incorrecta).
- No subir archivos al backend: el archivo se procesa localmente y solo se guarda su hash.
- Compatible inicialmente con MetaMask y proveedor `window.ethereum`.

## Flujo de firma y registro (cliente)

1. Leer archivo local.
2. Calcular hash del contenido.
3. Construir mensaje con `fileHash` y `fileDate`.
4. Firmar con cuenta activa (`authorizer`).
5. Enviar transaccion al contrato.
6. Confirmar bloque minado y actualizar listado.

Nota: La firma debe ser compatible con el esquema usado por el contrato (prefijo Ethereum Signed Message).

## UI minima sugerida

### Pantalla principal

- Wallet connect (cuenta y red).
- Selector de archivo.
- Campo de fecha (timestamp/autogenerado).
- Boton `Firmar y Registrar`.
- Resultado (tx hash, estado, mensajes de error).

### Pantalla de validacion

- Entrada de hash.
- Entrada de cuenta opcional.
- Botones de validacion (`isRegistered`, `validateHash`, `validateAccount`).
- Resultado booleano y mensaje descriptivo.

### Pantalla de historial

- Tabla/lista de registros:
  - Hash
  - Fecha de documento
  - Autorizer
  - StoredAt
  - StoredBy
- Buscador por hash.

## Configuracion tecnica recomendada

- Framework: `Next.js` (ya inicializado).
- Libreria Web3: `ethers` o `viem`.
- Variables de entorno:
  - `NEXT_PUBLIC_CHAIN_ID=31337`
  - `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`
  - `NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3`
- ABI del contrato: exportar desde `SC/out` o mantener ABI fija en `dapp`.

## Criterios de aceptacion

- Se registra al menos 1 archivo y retorna tx exitosa.
- Un hash ya registrado no puede registrarse de nuevo.
- Las funciones de validacion retornan resultados correctos.
- La lista de archivos muestra todos los registros on-chain.
- Se muestran errores amigables cuando la firma o la transaccion fallan.
