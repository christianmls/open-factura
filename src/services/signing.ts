import * as forge from "node-forge";
import { readFileSync } from "fs";
import fetch from "node-fetch";

export function getP12FromLocalFile(path: string) {
  const file = readFileSync(path);
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  return buffer;
}

export async function getP12FromUrl(url: string) {
  const file = await fetch(url)
    .then((response) => response.arrayBuffer())
    .then((data) => data);
  return file;
}

export function getXMLFromLocalFile(path: string) {
  const file = readFileSync(path, "utf8");
  return file;
}

export async function getXMLFromLocalUrl(url: string) {
  const file = await fetch(url)
    .then((response) => response.text())
    .then((data) => data);
  return file;
}

function sha1Base64(text: string, encoding: forge.Encoding = "utf8") {
  const md = forge.md.sha1.create();
  md.update(text, encoding);
  const hash = md.digest().toHex();
  const buffer = Buffer.from(hash, "hex");
  const base64 = buffer.toString("base64");
  return base64;
}

function hexToBase64(hex: string) {
  hex = hex.padStart(hex.length + (hex.length % 2), "0");
  const bytes = hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16));
  return btoa(String.fromCharCode(...bytes));
}

function bigIntToBase64(bigInt: forge.jsbn.BigInteger) {
  const hex = bigInt.toString(16);
  const hexPairs = hex.match(/\w{2}/g);
  const bytes = hexPairs!.map((pair) => parseInt(pair, 16));
  const byteString = String.fromCharCode(...bytes);
  const base64 = btoa(byteString);
  return base64.match(/.{1,76}/g)!.join("\n");
}

function getRandomNumber(min = 990, max = 9999) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function processP12(p12Data: ArrayBuffer, password: string) {
  const arrayUint8 = new Uint8Array(p12Data);
  const base64 = forge.util.binary.base64.encode(arrayUint8);
  const der = forge.util.decode64(base64);

  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const pkcs8Bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  const pkcs8Bag = pkcs8Bags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

  if (!certBag || !pkcs8Bag) {
    throw new Error("No certificates or private keys found in the P12 file.");
  }

  const certificate = certBag.cert as forge.pki.Certificate;
  const privateKey = pkcs8Bag.key as forge.pki.rsa.PrivateKey;
  const issuerName = certificate.issuer.attributes.map((attr) => `${attr.shortName}=${attr.value}`).join(", ");

  const certificatePem = forge.pki.certificateToPem(certificate);

  const currentDate = new Date();
  if (currentDate < certificate.validity.notBefore || currentDate > certificate.validity.notAfter) {
    throw new Error("Certificate is not valid.");
  }

  return {
    certificate,
    privateKey,
    issuerName,
    certificatePem,
  };
}

export async function signXml(p12Data: ArrayBuffer, p12Password: string, xmlData: string) {
  const certificateData = processP12(p12Data, p12Password);

  const { certificate, privateKey, issuerName, certificatePem } = certificateData;

  const xmlDigest = sha1Base64(xmlData.trim());

  const certificateDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
  const certDigest = sha1Base64(certificateDer, "utf8");

  const signedProperties = `
    <etsi:SignedProperties xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" Id="SignedProperties123">
      <etsi:SignedSignatureProperties>
        <etsi:SigningTime>${new Date().toISOString()}</etsi:SigningTime>
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
