export type ClientProposalStatus = "Awaiting Signature" | "Signed" | "Declined"

export type ClientProposal = {
  id: string
  reference: string
  title: string
  receivedAt: string
  expiresAt: string
  total: number
  termMonths: number
  status: ClientProposalStatus
  signedAt?: string
  scope: { id: string; name: string; detail: string; price: number }[]
}

export const clientProposals: ClientProposal[] = [
  {
    id: "PRO-2026-0094",
    reference: "PRO-2026-0094",
    title: "Annual Compliance Programme — 2026/27",
    receivedAt: "21 Apr 2026",
    expiresAt: "21 May 2026",
    total: 6_320,
    termMonths: 12,
    status: "Awaiting Signature",
    scope: [
      { id: "FRA",  name: "Annual Fire Risk Assessment (Type 3)", detail: "Main Building — full PAS 79 review",            price: 1_450 },
      { id: "DOOR", name: "Quarterly Fire Door Inspections",       detail: "4 visits/year, photographed register",          price: 1_280 },
      { id: "EL",   name: "Emergency Lighting Test & Cert.",       detail: "Annual full discharge + monthly flick test",    price: 720 },
      { id: "TRN",  name: "Fire Warden Refresher Training",        detail: "Up to 6 staff, in-person at Hallam House",      price: 870 },
      { id: "ADV",  name: "On-call Advisory Hours",                 detail: "12 hours / annum, rolling",                     price: 2_000 },
    ],
  },
  {
    id: "PRO-2025-0411",
    reference: "PRO-2025-0411",
    title: "Annual Compliance Programme — 2025/26",
    receivedAt: "18 Apr 2025",
    expiresAt: "18 May 2025",
    total: 5_980,
    termMonths: 12,
    status: "Signed",
    signedAt: "22 Apr 2025 · 11:08",
    scope: [
      { id: "FRA",  name: "Annual Fire Risk Assessment (Type 3)", detail: "Main Building — full PAS 79 review",            price: 1_400 },
      { id: "DOOR", name: "Quarterly Fire Door Inspections",       detail: "4 visits/year",                                  price: 1_180 },
      { id: "EL",   name: "Emergency Lighting Test & Cert.",       detail: "Annual full discharge",                          price: 700 },
      { id: "TRN",  name: "Fire Warden Refresher Training",        detail: "Up to 6 staff",                                  price: 870 },
      { id: "ADV",  name: "On-call Advisory Hours",                 detail: "10 hours / annum",                               price: 1_830 },
    ],
  },
]

export function getClientProposal(id: string): ClientProposal | null {
  return clientProposals.find((p) => p.id === id) ?? null
}

export type ClientContract = {
  id: string
  reference: string
  title: string
  proposalRef: string
  issuedAt: string
  termMonths: number
  total: number
  status: "Awaiting Signature" | "Signed"
  signedAt?: string
  scope: string[]
}

export const clientContracts: ClientContract[] = [
  {
    id: "CON-2025-0411",
    reference: "CON-2025-0411",
    title: "Service Agreement — 2025/26",
    proposalRef: "PRO-2025-0411",
    issuedAt: "23 Apr 2025",
    termMonths: 12,
    total: 5_980,
    status: "Awaiting Signature",
    scope: [
      "Annual Fire Risk Assessment (Type 3) — Main Building",
      "Quarterly Fire Door Inspections (4 visits/year)",
      "Emergency Lighting Test & Certification",
      "Fire Warden refresher training (up to 6 staff)",
      "On-call advisory hours: 10 hours / annum",
    ],
  },
]

export function getClientContract(id: string): ClientContract | null {
  return clientContracts.find((c) => c.id === id) ?? null
}
