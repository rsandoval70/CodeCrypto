"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider;
  }
}

type FileRecord = {
  fileHash: string;
  fileDate: string;
  authorizer: string;
  signature: string;
  storedAt: string;
  storedBy: string;
};

type RawContractRecord = {
  fileHash: string;
  fileDate: bigint;
  authorizer: string;
  signature: string;
  storedAt: bigint;
  storedBy: string;
};

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337");

const CONTRACT_ABI = [
  "function registerFile(bytes32 fileHash,uint256 fileDate,address authorizer,bytes signature)",
  "function verifySignature(bytes32 fileHash,uint256 fileDate,address authorizer,bytes signature) view returns (bool)",
  "function isFileRegistered(bytes32 fileHash) view returns (bool)",
  "function validateFileHash(bytes32 fileHash) view returns (bool)",
  "function validateAuthorizedAccount(bytes32 fileHash,address account) view returns (bool)",
  "function getAllSignedFiles() view returns ((bytes32 fileHash,uint256 fileDate,address authorizer,bytes signature,uint256 storedAt,address storedBy)[])",
] as const;

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [fileHash, setFileHash] = useState<string>("");
  const [fileDate, setFileDate] = useState<string>(String(Math.floor(Date.now() / 1000)));
  const [signature, setSignature] = useState<string>("");
  const [status, setStatus] = useState<string>("Conecta MetaMask para comenzar.");
  const [txHash, setTxHash] = useState<string>("");

  const [validationHash, setValidationHash] = useState<string>("");
  const [validationAddress, setValidationAddress] = useState<string>("");
  const [validationDate, setValidationDate] = useState<string>(String(Math.floor(Date.now() / 1000)));
  const [validationSignature, setValidationSignature] = useState<string>("");
  const [signatureValidOnchain, setSignatureValidOnchain] = useState<boolean | null>(null);
  const [signatureValidLocal, setSignatureValidLocal] = useState<boolean | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [isHashValid, setIsHashValid] = useState<boolean | null>(null);
  const [isAuthorizerValid, setIsAuthorizerValid] = useState<boolean | null>(null);

  const [history, setHistory] = useState<FileRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isConnected = useMemo(() => !!provider && !!contract && accounts.length > 0, [provider, contract, accounts]);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setStatus("MetaMask no detectado en el navegador.");
        return;
      }
      if (!CONTRACT_ADDRESS) {
        setStatus("Falta NEXT_PUBLIC_CONTRACT_ADDRESS en .env.local");
        return;
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const network = await browserProvider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        setStatus(`Red incorrecta. Cambia MetaMask a chainId ${CHAIN_ID}.`);
        return;
      }

      const requestedAccounts = await browserProvider.send("eth_requestAccounts", []);
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, browserProvider);

      setProvider(browserProvider);
      setContract(readContract);
      setAccounts(requestedAccounts);
      setSelectedAccount(requestedAccounts[0] ?? "");
      setValidationAddress(requestedAccounts[0] ?? "");
      setStatus("Wallet conectada.");
    } catch (error) {
      setStatus(`Error al conectar wallet: ${String(error)}`);
    }
  }

  async function onSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);

    const bytes = await file.arrayBuffer();
    const hash = ethers.keccak256(new Uint8Array(bytes));
    setFileHash(hash);
    setValidationHash(hash);
  }

  function buildMessageHash(hash: string, date: string): string {
    return ethers.solidityPackedKeccak256(["bytes32", "uint256"], [hash, BigInt(date)]);
  }

  async function signCurrentData() {
    try {
      if (!provider || !selectedAccount || !fileHash || !fileDate) {
        setStatus("Falta wallet conectada, archivo o fecha.");
        return;
      }
      const signer = await provider.getSigner(selectedAccount);
      const messageHash = buildMessageHash(fileHash, fileDate);
      const generatedSignature = await signer.signMessage(ethers.getBytes(messageHash));
      setSignature(generatedSignature);
      setValidationSignature(generatedSignature);
      setValidationDate(fileDate);

      const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), generatedSignature);
      setSignatureValidLocal(recovered.toLowerCase() === selectedAccount.toLowerCase());
      setStatus("Firma generada correctamente.");
    } catch (error) {
      setStatus(`Error al firmar: ${String(error)}`);
    }
  }

  async function registerFile() {
    try {
      if (!provider || !contract || !selectedAccount || !fileHash || !fileDate || !signature) {
        setStatus("Debes conectar wallet, cargar archivo y firmar antes de registrar.");
        return;
      }

      const signer = await provider.getSigner(selectedAccount);
      const writeContract = contract.connect(signer);
      setStatus("Enviando transaccion...");

      const tx = await writeContract.registerFile(fileHash, BigInt(fileDate), selectedAccount, signature);
      setTxHash(tx.hash);
      setStatus("Esperando confirmacion...");
      await tx.wait();

      setStatus("Archivo registrado en blockchain.");
      await runValidation();
      await loadHistory();
    } catch (error) {
      setStatus(`Error al registrar: ${String(error)}`);
    }
  }

  async function runValidation() {
    try {
      if (!contract || !validationHash) {
        setStatus("Ingresa un hash para validar.");
        return;
      }

      if (!ethers.isHexString(validationHash, 32)) {
        setStatus("El hash debe tener formato bytes32 (0x + 64 hex).");
        return;
      }

      const registeredResult = await contract.isFileRegistered(validationHash);
      setIsRegistered(Boolean(registeredResult));
      const validHashResult = await contract.validateFileHash(validationHash);
      setIsHashValid(Boolean(validHashResult));
      if (validationAddress) {
        const validAuthorizerResult = await contract.validateAuthorizedAccount(
          validationHash,
          validationAddress
        );
        setIsAuthorizerValid(Boolean(validAuthorizerResult));
      }

      if (validationSignature && validationAddress && validationDate) {
        const isSigValid = await contract.verifySignature(
          validationHash,
          BigInt(validationDate),
          validationAddress,
          validationSignature
        );
        setSignatureValidOnchain(Boolean(isSigValid));
      } else {
        setSignatureValidOnchain(null);
      }

      setStatus("Validacion completada.");
    } catch (error) {
      setStatus(`Error validando datos: ${String(error)}`);
    }
  }

  async function loadHistory() {
    try {
      if (!contract) return;
      setLoadingHistory(true);
      const records = (await contract.getAllSignedFiles()) as RawContractRecord[];
      const parsed: FileRecord[] = records.map((record) => ({
        fileHash: record.fileHash,
        fileDate: record.fileDate.toString(),
        authorizer: record.authorizer,
        signature: record.signature,
        storedAt: record.storedAt.toString(),
        storedBy: record.storedBy,
      }));
      setHistory(parsed);
    } catch (error) {
      setStatus(`Error cargando historial: ${String(error)}`);
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <h1 className="text-2xl font-bold sm:text-3xl">Document Signer DApp</h1>
          <p className="mt-2 text-sm text-slate-300">
            Registra hashes de archivos firmados en Anvil usando MetaMask + ethers.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={connectWallet}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Conectar MetaMask
            </button>
            <button
              onClick={loadHistory}
              disabled={!isConnected}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              Refrescar historial
            </button>
            <span className="text-xs text-slate-400">RPC: {RPC_URL}</span>
            <span className="text-xs text-slate-400">Contrato: {CONTRACT_ADDRESS || "No configurado"}</span>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Registrar archivo firmado</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">Cuenta MetaMask</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  {accounts.length === 0 && <option value="">Conecta MetaMask</option>}
                  {accounts.map((account) => (
                    <option key={account} value={account}>
                      {account}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Archivo</label>
                <input
                  type="file"
                  onChange={onSelectFile}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
                {selectedFileName && <p className="mt-1 text-xs text-slate-400">Seleccionado: {selectedFileName}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Timestamp del documento</label>
                <input
                  value={fileDate}
                  onChange={(e) => setFileDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Hash calculado</label>
                <code className="block overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                  {fileHash || "Sin hash"}
                </code>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Firma</label>
                <code className="block overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                  {signature || "Sin firma"}
                </code>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={signCurrentData}
                  disabled={!isConnected || !fileHash}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                >
                  Firmar
                </button>
                <button
                  onClick={registerFile}
                  disabled={!isConnected || !signature}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  Registrar en Blockchain
                </button>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Validacion de firma y hash</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">Hash a validar</label>
                <input
                  value={validationHash}
                  onChange={(e) => setValidationHash(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">Address autorizador</label>
                <input
                  value={validationAddress}
                  onChange={(e) => setValidationAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">Timestamp para validar firma</label>
                <input
                  value={validationDate}
                  onChange={(e) => setValidationDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">Firma a validar (opcional)</label>
                <textarea
                  value={validationSignature}
                  onChange={(e) => setValidationSignature(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={runValidation}
                disabled={!isConnected || !validationHash}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
              >
                Ejecutar validacion
              </button>
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm">
                <p>Hash registrado: {isRegistered === null ? "-" : isRegistered ? "Si" : "No"}</p>
                <p>Hash valido: {isHashValid === null ? "-" : isHashValid ? "Si" : "No"}</p>
                <p>Cuenta valida: {isAuthorizerValid === null ? "-" : isAuthorizerValid ? "Si" : "No"}</p>
                <p>Firma valida (local): {signatureValidLocal === null ? "-" : signatureValidLocal ? "Si" : "No"}</p>
                <p>
                  Firma valida (on-chain):{" "}
                  {signatureValidOnchain === null ? "-" : signatureValidOnchain ? "Si" : "No"}
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold">Historial de archivos firmados</h2>
          {loadingHistory ? (
            <p className="mt-3 text-sm text-slate-300">Cargando historial...</p>
          ) : history.length === 0 ? (
            <p className="mt-3 text-sm text-slate-300">No hay registros aun.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="p-2">Hash</th>
                    <th className="p-2">Fecha doc</th>
                    <th className="p-2">Autorizer</th>
                    <th className="p-2">Stored At</th>
                    <th className="p-2">Stored By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={`${record.fileHash}-${record.storedAt}`} className="border-t border-slate-800">
                      <td className="p-2 font-mono text-xs">{record.fileHash}</td>
                      <td className="p-2">{record.fileDate}</td>
                      <td className="p-2">{formatAddress(record.authorizer)}</td>
                      <td className="p-2">{record.storedAt}</td>
                      <td className="p-2">{formatAddress(record.storedBy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          <p>Estado: {status}</p>
          {txHash && (
            <p className="mt-1 font-mono text-xs">
              Ultima transaccion: <span className="text-slate-200">{txHash}</span>
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
