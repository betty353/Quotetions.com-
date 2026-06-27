import { decryptSecret } from "@/lib/encryption"

type DpoSetting = {
  dpoCompanyTokenEncrypted: string | null
  dpoServiceTypeEncrypted: string | null
  dpoEnvironment: "SANDBOX" | "PRODUCTION"
}

type CreateTokenInput = {
  amount: number
  currency: string
  companyRef: string
  description: string
  redirectUrl: string
  backUrl: string
  companyToken: string
  serviceType: string
  environment: "SANDBOX" | "PRODUCTION"
}

export type DpoVerifyResult = {
  result: string
  resultExplanation: string
  transactionApproval?: string
  transactionAmount?: string
  transactionCurrency?: string
  paymentMethod?: string
  paymentReference?: string
}

function getApiUrl(environment: "SANDBOX" | "PRODUCTION" = "PRODUCTION") {
  if (process.env.DPO_API_URL) return process.env.DPO_API_URL
  if (environment === "SANDBOX") {
    return process.env.DPO_SANDBOX_API_URL || "https://secure1.sandbox.directpay.online/API/v6/"
  }
  return process.env.DPO_PRODUCTION_API_URL || "https://secure.3gdirectpay.com/API/v6/"
}

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function tagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return match?.[1]?.trim()
}

async function postDpoXml(xml: string, environment: "SANDBOX" | "PRODUCTION" = "PRODUCTION") {
  const response = await fetch(getApiUrl(environment), {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      Accept: "application/xml",
    },
    body: xml,
    cache: "no-store",
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`DPO request failed with HTTP ${response.status}: ${text.slice(0, 300)}`)
  }
  return text
}

export function getDpoCredentials(setting: DpoSetting) {
  if (!setting.dpoCompanyTokenEncrypted || !setting.dpoServiceTypeEncrypted) {
    throw new Error("DPO credentials are not configured")
  }

  return {
    companyToken: decryptSecret(setting.dpoCompanyTokenEncrypted),
    serviceType: decryptSecret(setting.dpoServiceTypeEncrypted),
  }
}

export function getDpoPaymentUrl(transactionToken: string, environment: "SANDBOX" | "PRODUCTION" = "PRODUCTION") {
  const configured = getApiUrl(environment)
  const url = new URL(configured)
  return `${url.origin}/payv2.php?ID=${encodeURIComponent(transactionToken)}`
}

export async function createDpoToken(input: CreateTokenInput) {
  const serviceDate = new Date().toISOString().slice(0, 19).replace("T", " ")
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(input.companyToken)}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${input.amount.toFixed(2)}</PaymentAmount>
    <PaymentCurrency>${escapeXml(input.currency)}</PaymentCurrency>
    <CompanyRef>${escapeXml(input.companyRef)}</CompanyRef>
    <RedirectURL>${escapeXml(input.redirectUrl)}</RedirectURL>
    <BackURL>${escapeXml(input.backUrl)}</BackURL>
    <CompanyRefUnique>1</CompanyRefUnique>
    <PTL>15</PTL>
  </Transaction>
  <Services>
    <Service>
      <ServiceType>${escapeXml(input.serviceType)}</ServiceType>
      <ServiceDescription>${escapeXml(input.description)}</ServiceDescription>
      <ServiceDate>${escapeXml(serviceDate)}</ServiceDate>
    </Service>
  </Services>
</API3G>`

  const responseXml = await postDpoXml(xml, input.environment)
  const result = tagValue(responseXml, "Result") || ""
  const resultExplanation = tagValue(responseXml, "ResultExplanation") || ""
  const transactionToken = tagValue(responseXml, "TransToken")
  const transactionReference = tagValue(responseXml, "TransRef")

  if (result !== "000" || !transactionToken) {
    throw new Error(resultExplanation || "DPO could not create a payment transaction")
  }

  return {
    transactionToken,
    transactionReference,
    paymentUrl: getDpoPaymentUrl(transactionToken, input.environment),
    result,
    resultExplanation,
  }
}

export async function verifyDpoToken(companyToken: string, transactionToken: string, environment: "SANDBOX" | "PRODUCTION" = "PRODUCTION"): Promise<DpoVerifyResult> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(companyToken)}</CompanyToken>
  <Request>verifyToken</Request>
  <TransactionToken>${escapeXml(transactionToken)}</TransactionToken>
</API3G>`

  const responseXml = await postDpoXml(xml, environment)
  return {
    result: tagValue(responseXml, "Result") || "",
    resultExplanation: tagValue(responseXml, "ResultExplanation") || "",
    transactionApproval: tagValue(responseXml, "TransactionApproval"),
    transactionAmount: tagValue(responseXml, "TransactionAmount"),
    transactionCurrency: tagValue(responseXml, "TransactionCurrency"),
    paymentMethod: tagValue(responseXml, "PaymentMethod") || tagValue(responseXml, "PaymentOption"),
    paymentReference: tagValue(responseXml, "TransactionRef") || tagValue(responseXml, "TransRef") || tagValue(responseXml, "AccRef"),
  }
}

export function isDpoPaymentSuccessful(result: DpoVerifyResult) {
  const explanation = result.resultExplanation.toLowerCase()
  return result.result === "000" && (
    Boolean(result.transactionApproval) ||
    explanation.includes("paid") ||
    explanation.includes("approved") ||
    explanation.includes("success")
  )
}
