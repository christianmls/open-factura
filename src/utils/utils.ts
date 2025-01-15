export type GenerateAccessKey = {
  date: Date;
  /*
  FACTURA 01
  LIQUIDACIÓN DE COMPRA DE
  BIENES Y PRESTACIÓN DE
  SERVICIOS 03
  NOTA DE CRÉDITO 04
  NOTA DE DÉBITO 05
  GUÍA DE REMISIÓN 06
  COMPROBANTE DE RETENCIÓN 07
  */
  codDoc: "01" | "03" | "04" | "05" | "06" | "07";
  ruc: string;
  environment: "1" | "2";
  establishment: string;
  emissionPoint: string;
  sequential: string;
};

export function generateAccessKey(accessKeyData: GenerateAccessKey) {
  let accessKey = "";
  accessKey += formatDateToDDMMYYYY(accessKeyData.date); // Fecha de emisión
  accessKey += accessKeyData.codDoc; // Tipo de comprobante
  accessKey += accessKeyData.ruc; // Número de RUC
  accessKey += accessKeyData.environment; // Tipo de ambiente
  accessKey += accessKeyData.establishment; // Establecimiento
  accessKey += accessKeyData.emissionPoint; // Punto de emision
  accessKey += accessKeyData.sequential; // Secuencial
  accessKey += generateRandomEightDigitNumber(); // Código numérico
  accessKey += "1"; // Tipo de emisión
  accessKey += generateVerificatorDigit(accessKey); // Dígito verificador
  return accessKey;
}

function formatDateToDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0"); // Día con cero a la izquierda
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Mes con cero a la izquierda
  const year = date.getFullYear(); // Año completo (4 dígitos)

  return `${day}${month}${year}`;
}

function generateRandomEightDigitNumber(): number {
  const min = 10000000;
  const max = 99999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateVerificatorDigit(accessKey: string) {
  const weights = [2, 3, 4, 5, 6, 7]; // Pesos cíclicos estándar
  const digits = accessKey.split("").map(Number); // Convertir a un array de dígitos

  // Validar que todos los caracteres sean numéricos
  if (digits.some(isNaN)) {
    throw new Error("Invalid access key. Must contain only digits.");
  }

  // Calcular la suma ponderada
  const total = digits
    .reverse() // Procesar de derecha a izquierda
    .map((digit, index) => digit * weights[index % weights.length]) // Multiplicar por pesos
    .reduce((sum, value) => sum + value, 0); // Sumar los productos

  // Calcular el residuo
  const remainder = total % 11;

  // Calcular el dígito verificador
  let verifier = 11 - remainder;

  // Ajustar casos especiales
  if (verifier === 10) verifier = 1;
  if (verifier === 11) verifier = 0;

  return verifier;
}
