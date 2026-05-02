export type ContractStatus =
  | "Draft"
  | "Sent for Signing"
  | "Client Signed"
  | "Counter-Signed"
  | "Completed"

export type MockContract = {
  id: string
  reference: string
  clientName: string
  clientContact: string
  clientEmail: string
  status: ContractStatus
  proposalRef: string
  total: number
  scope: string[]
  issuedAt: string
  termMonths: number
  signedByClientAt?: string
  signedByPracticeAt?: string
}

const baseScope = [
  "Annual Fire Risk Assessment (Type 3) — Main Building",
  "Quarterly Fire Door Inspections (4 visits/year)",
  "Emergency Lighting Test & Certification",
  "Fire Warden refresher training (up to 6 staff)",
  "On-call advisory hours: 12 hours / annum",
]

export const mockContracts: MockContract[] = [
  {
    id: "yellow-broom",
    reference: "CON-2026-0042",
    clientName: "Yellow Broom Ltd",
    clientContact: "Helena Marsh",
    clientEmail: "helena@yellowbroom.co.uk",
    status: "Client Signed",
    proposalRef: "PRO-2026-0118",
    total: 4_850,
    scope: baseScope,
    issuedAt: "28 Apr 2026",
    termMonths: 12,
    signedByClientAt: "30 Apr 2026 · 14:22",
  },
  {
    id: "hallam-house",
    reference: "CON-2026-0039",
    clientName: "Hallam House Care Home",
    clientContact: "Sarah Whitfield",
    clientEmail: "sarah@hallamhouse.co.uk",
    status: "Sent for Signing",
    proposalRef: "PRO-2026-0094",
    total: 6_320,
    scope: baseScope,
    issuedAt: "21 Apr 2026",
    termMonths: 12,
  },
  {
    id: "northgate-mills",
    reference: "CON-2026-0036",
    clientName: "Northgate Mills",
    clientContact: "Owen Greaves",
    clientEmail: "owen@northgatemills.com",
    status: "Counter-Signed",
    proposalRef: "PRO-2026-0072",
    total: 3_200,
    scope: baseScope,
    issuedAt: "12 Apr 2026",
    termMonths: 12,
    signedByClientAt: "13 Apr 2026 · 09:14",
    signedByPracticeAt: "14 Apr 2026 · 11:02",
  },
]

export function getMockContract(id: string): MockContract | null {
  return mockContracts.find((c) => c.id === id) ?? mockContracts[0]
}
