# Smart Contracts (Foundry)

Esta carpeta contiene el smart contract para registrar hashes de archivos firmados en blockchain.

## Requisitos funcionales implementados

- Registro de cada archivo con:
  - `hash` del archivo (`bytes32`)
  - `fecha` del archivo (`uint256`, timestamp)
  - `direccion` de la cuenta autorizadora (`address`)
  - `firma` del mensaje `(hash + fecha)` (`bytes`)
- Validacion de que un archivo no se registre dos veces.
- Validacion criptografica de firma usando `ecrecover`:
  - Se construye `messageHash = keccak256(abi.encodePacked(hash, fecha))`
  - Se verifica contra firma de tipo `eth_sign` (`\x19Ethereum Signed Message:\n32`).
- Consulta de estado y datos:
  - Saber si un hash ya esta registrado.
  - Validar hash registrado.
  - Validar cuenta autorizadora.
  - Consultar un registro individual.
  - Consultar lista completa de archivos firmados/guardados.

## Contrato principal

- `src/FileHashRegistry.sol`

### Estructura del registro

Cada archivo se guarda como `FileRecord`:

- `fileHash`: hash del archivo.
- `fileDate`: fecha/timestamp asociada al archivo.
- `authorizer`: cuenta que autoriza con su firma.
- `signature`: firma cruda de 65 bytes (`r,s,v`).
- `storedAt`: timestamp de bloque al registrar.
- `storedBy`: cuenta que envio la transaccion.

### Funciones clave

- `registerFile(bytes32,uint256,address,bytes)`: guarda archivo firmado.
- `isFileRegistered(bytes32)`: valida si existe registro.
- `validateFileHash(bytes32)`: valida hash registrado.
- `validateAuthorizedAccount(bytes32,address)`: valida cuenta autorizadora.
- `validateRegistration(bytes32,address)`: valida hash + cuenta.
- `getFileRecord(bytes32)`: obtiene un archivo registrado.
- `getAllSignedFiles()`: obtiene la lista completa.
- `getFileHashes()`: devuelve solo hashes registrados.
- `totalFiles()`: cantidad de archivos registrados.
- `verifySignature(...)`: verificacion de firma reusable.

## Pruebas

- Archivo de pruebas: `test/FileHashRegistry.t.sol`
- Casos cubiertos:
  - Registro exitoso y lectura del registro.
  - Bloqueo de registro duplicado por hash.
  - Rechazo de firma invalida.
  - Consulta de lista completa de archivos.

## Como usar Foundry en esta carpeta

Desde `SC/`:

```bash
forge install foundry-rs/forge-std
forge build
forge test
```

## Despliegue

Script de despliegue:

- `script/DeployFileHashRegistry.s.sol`

Ejemplo (ajustar RPC y private key):

```bash
forge script script/DeployFileHashRegistry.s.sol:DeployFileHashRegistry \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```
