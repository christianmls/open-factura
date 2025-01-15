// src/services/authorization.ts
import { createClient } from "soap";
async function documentAuthorization(accesKey, authorizationUrl) {
  let params = { claveAccesoComprobante: accesKey };
  let authorizationResponse;
  const authorizationRequest = new Promise((resolve, reject) => {
    createClient(authorizationUrl, (err, client) => {
      client.autorizacionComprobante(params, (err2, result) => {
        if (err2) {
          reject(err2);
          return;
        }
        resolve(result);
      });
    });
  });
  authorizationResponse = await authorizationRequest;
  return authorizationResponse;
}

// src/services/generateInvoice.ts
import { create } from "xmlbuilder2";

// src/utils/utils.ts
function generateAccessKey(accessKeyData) {
  let accessKey = "";
  accessKey += formatDateToDDMMYYYY(accessKeyData.date);
  accessKey += accessKeyData.codDoc;
  accessKey += accessKeyData.ruc;
  accessKey += accessKeyData.environment;
  accessKey += accessKeyData.establishment;
  accessKey += accessKeyData.emissionPoint;
  accessKey += accessKeyData.sequential;
  accessKey += generateRandomEightDigitNumber();
  accessKey += "1";
  accessKey += generateVerificatorDigit(accessKey);
  return accessKey;
}
function formatDateToDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}
function generateRandomEightDigitNumber() {
  const min = 1e7;
  const max = 99999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function generateVerificatorDigit(accessKey) {
  const weights = [2, 3, 4, 5, 6, 7];
  const digits = accessKey.split("").map(Number);
  if (digits.some(isNaN)) {
    throw new Error("Invalid access key. Must contain only digits.");
  }
  const total = digits.reverse().map((digit, index) => digit * weights[index % weights.length]).reduce((sum, value) => sum + value, 0);
  const remainder = total % 11;
  let verifier = 11 - remainder;
  if (verifier === 10)
    verifier = 1;
  if (verifier === 11)
    verifier = 0;
  return verifier;
}

// src/services/generateInvoice.ts
function parseDateFromDDMMYYYY(dateString) {
  const [day, month, year] = dateString.split("/").map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format or value. Expected format: DD/MM/YYYY");
  }
  return date;
}
function reorderTaxInfo(taxInfo2) {
  return {
    ambiente: taxInfo2.ambiente,
    tipoEmision: taxInfo2.tipoEmision,
    razonSocial: taxInfo2.razonSocial,
    nombreComercial: taxInfo2.nombreComercial,
    ruc: taxInfo2.ruc,
    claveAcceso: taxInfo2.claveAcceso,
    codDoc: taxInfo2.codDoc,
    estab: taxInfo2.estab,
    ptoEmi: taxInfo2.ptoEmi,
    secuencial: taxInfo2.secuencial,
    dirMatriz: taxInfo2.dirMatriz,
    regimenMicroempresas: taxInfo2.regimenMicroempresas,
    agenteRetencion: taxInfo2.agenteRetencion,
    contribuyenteRimpe: taxInfo2.contribuyenteRimpe
  };
}
function generateInvoiceXml(invoice) {
  const document = create(invoice);
  const xml = document.end({ prettyPrint: true });
  return xml;
}
function generateInvoice(invoiceData) {
  const accessKey = generateAccessKey({
    date: parseDateFromDDMMYYYY(invoiceData.infoFactura.fechaEmision),
    codDoc: invoiceData.infoTributaria.codDoc,
    ruc: invoiceData.infoTributaria.ruc,
    environment: invoiceData.infoTributaria.ambiente,
    establishment: invoiceData.infoTributaria.estab,
    emissionPoint: invoiceData.infoTributaria.ptoEmi,
    sequential: invoiceData.infoTributaria.secuencial
  });
  const infoTributariaData = { ...invoiceData.infoTributaria, claveAcceso: accessKey };
  const invoice = {
    factura: {
      //"@xmlns:ds": "http://www.w3.org/2000/09/xmldsig#",
      //"@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@id": "comprobante",
      "@version": "1.1.0",
      infoTributaria: reorderTaxInfo(infoTributariaData),
      infoFactura: invoiceData.infoFactura,
      detalles: invoiceData.detalles
    }
  };
  return { invoice, accessKey };
}

// src/services/reception.ts
import { createClient as createClient2 } from "soap";
async function documentReception(stringXML, receptionUrl) {
  const base64XML = Buffer.from(stringXML).toString("base64");
  let params = { xml: base64XML };
  let receptionResult;
  const receptionRequest = new Promise((resolve, reject) => {
    createClient2(receptionUrl, (err, client) => {
      if (err) {
        reject(err);
        return;
      }
      client.validarComprobante(params, (err2, result) => {
        if (err2) {
          reject(err2);
          return;
        }
        resolve(result);
      });
    });
  });
  receptionResult = await receptionRequest;
  return receptionResult;
}

// src/services/signing.ts
import * as forge from "node-forge";
import { readFileSync } from "fs";
import fetch from "node-fetch";
import path from "path";
import { spawn } from "child_process";
function getP12FromLocalFile(path2) {
  const file = readFileSync(path2);
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  return buffer;
}
async function getP12FromUrl(url) {
  const file = await fetch(url).then((response) => response.arrayBuffer()).then((data) => data);
  return file;
}
function getXMLFromLocalFile(path2) {
  const file = readFileSync(path2, "utf8");
  return file;
}
async function getXMLFromLocalUrl(url) {
  const file = await fetch(url).then((response) => response.text()).then((data) => data);
  return file;
}
async function signXml(p12Data, p12Password, xmlData) {
  const xmlBase = xmlData;
  const p12Base64 = Buffer.from(p12Data).toString("base64");
  const passwordBase64 = Buffer.from(p12Password, "utf-8").toString("base64");
  const JAR_PATH = path.resolve(__dirname, "firma/firmaXadesBes.jar");
  const JAVA_CMD = "java";
  return new Promise((resolve, reject) => {
    const command = ["-jar", JAR_PATH, xmlBase, p12Base64, passwordBase64];
    const process = spawn(JAVA_CMD, command);
    let output = "";
    let errorOutput = "";
    process.stdout.on("data", (data) => {
      output += data.toString();
    });
    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });
    process.on("close", (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`Error signing XML. Code: ${code}. Details: ${errorOutput}`));
      }
    });
    process.on("error", (err) => {
      reject(new Error(`Process execution failed: ${err.message}`));
    });
  });
}
export {
  documentAuthorization,
  documentReception,
  generateInvoice,
  generateInvoiceXml,
  getP12FromLocalFile,
  getP12FromUrl,
  getXMLFromLocalFile,
  getXMLFromLocalUrl,
  signXml
};
//# sourceMappingURL=index.mjs.map