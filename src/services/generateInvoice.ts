import { create } from "xmlbuilder2";
import { Invoice, InvoiceInput } from "../baseData/invoice/invoice";
import { generateAccessKey } from "../utils/utils";
import { TaxInfo } from "../baseData/invoice/taxInfo";

function parseDateFromDDMMYYYY(dateString: string): Date {
  const [day, month, year] = dateString.split("/").map(Number);
  const date = new Date(year, month - 1, day);

  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format or value. Expected format: DD/MM/YYYY");
  }

  return date;
}

function reorderTaxInfo(taxInfo: TaxInfo): TaxInfo {
  return {
    ambiente: taxInfo.ambiente,
    tipoEmision: taxInfo.tipoEmision,
    razonSocial: taxInfo.razonSocial,
    nombreComercial: taxInfo.nombreComercial,
    ruc: taxInfo.ruc,
    claveAcceso: taxInfo.claveAcceso,
    codDoc: taxInfo.codDoc,
    estab: taxInfo.estab,
    ptoEmi: taxInfo.ptoEmi,
    secuencial: taxInfo.secuencial,
    dirMatriz: taxInfo.dirMatriz,
    regimenMicroempresas: taxInfo.regimenMicroempresas,
    agenteRetencion: taxInfo.agenteRetencion,
    contribuyenteRimpe: taxInfo.contribuyenteRimpe,
  };
}

export function generateInvoiceXml(invoice: Invoice) {
  const document = create(invoice);
  const xml = document.end({ prettyPrint: true });
  return xml;
}

export function generateInvoice(invoiceData: InvoiceInput) {
  const accessKey = generateAccessKey({
    date: parseDateFromDDMMYYYY(invoiceData.infoFactura.fechaEmision),
    codDoc: invoiceData.infoTributaria.codDoc,
    ruc: invoiceData.infoTributaria.ruc,
    environment: invoiceData.infoTributaria.ambiente,
    establishment: invoiceData.infoTributaria.estab,
    emissionPoint: invoiceData.infoTributaria.ptoEmi,
    sequential: invoiceData.infoTributaria.secuencial,
  });

  const infoTributariaData = { ...invoiceData.infoTributaria, claveAcceso: accessKey };

  const invoice: Invoice = {
    factura: {
      "@xmlns:ds": "http://www.w3.org/2000/09/xmldsig#",
      "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@id": "comprobante",
      "@version": "1.0.0",
      infoTributaria: reorderTaxInfo(infoTributariaData),
      infoFactura: invoiceData.infoFactura,
      detalles: invoiceData.detalles,
    },
  };

  return { invoice, accessKey };
}
