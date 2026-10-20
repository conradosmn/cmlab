/**
 * Gerador Oficial de Payload PIX (Padrão BR Code / EMV QRCPS-MPM do Banco Central do Brasil)
 * Gera o código "Copia e Cola" com CRC16-CCITT (0xFFFF, polinômio 0x1021) válido em qualquer banco.
 */

function formatEMVField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function normalizeAscii(str: string, maxLen: number): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .slice(0, maxLen)
    .toUpperCase();
}

/**
 * Formata a chave PIX conforme regras do BACEN:
 * - Telefone celular (10 ou 11 dígitos sem @ e não sendo CPF válido conhecido se tiver +55)
 * - CPF (11 dígitos), CNPJ (14 dígitos), E-mail ou EVP (UUID)
 */
export function normalizePixKey(rawKey: string, keyType?: "cpf" | "cnpj" | "phone" | "email" | "random"): string {
  const trimmed = rawKey.trim();
  if (!trimmed) return "";

  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  // Chave aleatória UUID
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const digits = trimmed.replace(/\D/g, "");
  if (keyType === "phone") {
    return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
  }
  if (keyType === "cpf" || keyType === "cnpj") {
    return digits;
  }

  // Se o usuário digitou com +55
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  return digits || trimmed;
}

/**
 * Cálculo oficial CRC16-CCITT (Polinômio 0x1021, Valor Inicial 0xFFFF) exigido pelo Banco Central
 */
function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixBrCodeInput {
  pixKey: string;
  keyType?: "cpf" | "cnpj" | "phone" | "email" | "random";
  merchantName?: string;
  merchantCity?: string;
  amount: number;
  txid?: string; // Identificador da transação (até 25 caracteres alfanuméricos)
}

export function generatePixBrCode(input: PixBrCodeInput): string {
  const cleanKey = normalizePixKey(input.pixKey, input.keyType);
  const merchantName = normalizeAscii(input.merchantName || "CM CASA CRIATIVA", 25) || "CM CASA CRIATIVA";
  const merchantCity = normalizeAscii(input.merchantCity || "BRASILIA", 15) || "BRASILIA";
  const txidClean =
    (input.txid || "CMLABFEIRATCE").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";

  // 00: Payload Format Indicator = "01"
  const pfi = formatEMVField("00", "01");

  // 26: Merchant Account Information - PIX
  //   00: GUI = "br.gov.bcb.pix"
  //   01: Chave PIX
  const gui = formatEMVField("00", "br.gov.bcb.pix");
  const keyField = formatEMVField("01", cleanKey);
  const mai = formatEMVField("26", `${gui}${keyField}`);

  // 52: Merchant Category Code = "0000"
  const mcc = formatEMVField("52", "0000");

  // 53: Transaction Currency = "986" (BRL)
  const currency = formatEMVField("53", "986");

  // 54: Transaction Amount
  const amountStr = input.amount > 0 ? formatEMVField("54", input.amount.toFixed(2)) : "";

  // 58: Country Code = "BR"
  const country = formatEMVField("58", "BR");

  // 59: Merchant Name
  const nameField = formatEMVField("59", merchantName);

  // 60: Merchant City
  const cityField = formatEMVField("60", merchantCity);

  // 62: Additional Data Field Template (05 = Reference Label / TXID)
  const txidField = formatEMVField("05", txidClean);
  const additionalData = formatEMVField("62", txidField);

  // 63: CRC16 (ID "63" + Tamanho "04" + 4 caracteres hex)
  const partialPayload = `${pfi}${mai}${mcc}${currency}${amountStr}${country}${nameField}${cityField}${additionalData}6304`;
  const crc = calculateCRC16(partialPayload);

  return `${partialPayload}${crc}`;
}
