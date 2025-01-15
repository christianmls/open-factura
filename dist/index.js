"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  documentAuthorization: () => documentAuthorization,
  documentReception: () => documentReception,
  generateInvoice: () => generateInvoice,
  generateInvoiceXml: () => generateInvoiceXml,
  getP12FromLocalFile: () => getP12FromLocalFile,
  getP12FromUrl: () => getP12FromUrl,
  getXMLFromLocalFile: () => getXMLFromLocalFile,
  getXMLFromLocalUrl: () => getXMLFromLocalUrl,
  signXml: () => signXml
});
module.exports = __toCommonJS(src_exports);

// src/services/authorization.ts
var import_soap = require("soap");
async function documentAuthorization(accesKey, authorizationUrl) {
  let params = { claveAccesoComprobante: accesKey };
  let authorizationResponse;
  const authorizationRequest = new Promise((resolve, reject) => {
    (0, import_soap.createClient)(authorizationUrl, (err, client) => {
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
var import_xmlbuilder2 = require("xmlbuilder2");

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
  const document = (0, import_xmlbuilder2.create)(invoice);
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
      "@xmlns:ds": "http://www.w3.org/2000/09/xmldsig#",
      "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@id": "comprobante",
      "@version": "1.0.0",
      infoTributaria: reorderTaxInfo(infoTributariaData),
      infoFactura: invoiceData.infoFactura,
      detalles: invoiceData.detalles
    }
  };
  return { invoice, accessKey };
}

// src/services/reception.ts
var import_soap2 = require("soap");
async function documentReception(stringXML, receptionUrl) {
  const base64XML = Buffer.from(stringXML).toString("base64");
  let params = { xml: base64XML };
  let receptionResult;
  const receptionRequest = new Promise((resolve, reject) => {
    (0, import_soap2.createClient)(receptionUrl, (err, client) => {
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
var forge = __toESM(require("node-forge"));
var import_fs = require("fs");
var import_node_fetch = __toESM(require("node-fetch"));
function getP12FromLocalFile(path) {
  const file = (0, import_fs.readFileSync)(path);
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  return buffer;
}
async function getP12FromUrl(url) {
  const file = await (0, import_node_fetch.default)(url).then((response) => response.arrayBuffer()).then((data) => data);
  return file;
}
function getXMLFromLocalFile(path) {
  const file = (0, import_fs.readFileSync)(path, "utf8");
  return file;
}
async function getXMLFromLocalUrl(url) {
  const file = await (0, import_node_fetch.default)(url).then((response) => response.text()).then((data) => data);
  return file;
}
function sha1Base64(text, encoding = "utf8") {
  const md2 = forge.md.sha1.create();
  md2.update(text, encoding);
  const hash = md2.digest().toHex();
  const buffer = Buffer.from(hash, "hex");
  const base64 = buffer.toString("base64");
  return base64;
}
function processP12(p12Data, password) {
  const arrayUint8 = new Uint8Array(p12Data);
  const base64 = forge.util.binary.base64.encode(arrayUint8);
  const der = forge.util.decode64(base64);
  const asn12 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn12, password);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const pkcs8Bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  const pkcs8Bag = pkcs8Bags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!certBag || !pkcs8Bag) {
    throw new Error("No certificates or private keys found in the P12 file.");
  }
  const certificate = certBag.cert;
  const privateKey = pkcs8Bag.key;
  const issuerName = certificate.issuer.attributes.map((attr) => `${attr.shortName}=${attr.value}`).join(", ");
  const certificatePem = forge.pki.certificateToPem(certificate);
  const currentDate = /* @__PURE__ */ new Date();
  if (currentDate < certificate.validity.notBefore || currentDate > certificate.validity.notAfter) {
    throw new Error("Certificate is not valid.");
  }
  return {
    certificate,
    privateKey,
    issuerName,
    certificatePem
  };
}
async function signXml(p12Data, p12Password, xmlData) {
  const certificateData = processP12(p12Data, p12Password);
  const { certificate, privateKey, issuerName, certificatePem } = certificateData;
  const xmlDigest = sha1Base64(xmlData.trim());
  const certificateDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
  const certDigest = sha1Base64(certificateDer, "utf8");
  const signedProperties = `
    <etsi:SignedProperties xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" Id="SignedProperties123">
      <etsi:SignedSignatureProperties>
        <etsi:SigningTime>${(/* @__PURE__ */ new Date()).toISOString()}</etsi:SigningTime>
        <etsi:SigningCertificate>
          <etsi:Cert>
            <etsi:CertDigest>
              <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
              <ds:DigestValue>${certDigest}</ds:DigestValue>
            </etsi:CertDigest>
            <etsi:IssuerSerial>
              <ds:X509IssuerName>${issuerName}</ds:X509IssuerName>
              <ds:X509SerialNumber>${parseInt(certificate.serialNumber, 16)}</ds:X509SerialNumber>
            </etsi:IssuerSerial>
          </etsi:Cert>
        </etsi:SigningCertificate>
      </etsi:SignedSignatureProperties>
    </etsi:SignedProperties>
  `.trim();
  const signedPropertiesDigest = sha1Base64(signedProperties.trim());
  const signedInfo = `
    <ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      <ds:Reference URI="#SignedProperties123">
        <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue>
      </ds:Reference>
      <ds:Reference URI="">
        <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <ds:DigestValue>${xmlDigest}</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>
  `.trim();
  const signature = forge.util.encode64(privateKey.sign(forge.md.sha1.create().update(signedInfo, "utf8")));
  const keyInfo = `
    <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:X509Data>
        <ds:X509Certificate>${certificatePem.replace(/-----[A-Z]+ CERTIFICATE-----|\n/g, "")}</ds:X509Certificate>
      </ds:X509Data>
    </ds:KeyInfo>
  `.trim();
  const signatureXml = `
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      ${signedInfo}
      <ds:SignatureValue>${signature}</ds:SignatureValue>
      ${keyInfo}
      <ds:Object>
        ${signedProperties}
      </ds:Object>
    </ds:Signature>
  `.trim();
  return xmlData.replace(/<\/factura>/, `${signatureXml}</factura>`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  documentAuthorization,
  documentReception,
  generateInvoice,
  generateInvoiceXml,
  getP12FromLocalFile,
  getP12FromUrl,
  getXMLFromLocalFile,
  getXMLFromLocalUrl,
  signXml
});
//# sourceMappingURL=index.js.map