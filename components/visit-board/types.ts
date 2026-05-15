export type ConfirmStatus = 'UNCHANGED' | 'CHANGED' | 'NO_SHOW' | null

export interface BoardUser {
  id: string
  name: string
  role: string
  position: string | null
  teamId: string | null
}

export interface BoardVisit {
  id: string
  userId: string | null
  visitDate: string
  visitType: string
  location: string
  status: string
  memo: string | null
  confirmStatus: ConfirmStatus
  confirmedAt: string | null
  previousDate: string | null
  customer: { id: string; name: string | null; phone: string; assignedSite: string | null }
  user: { id: string; name: string; position: string | null } | null
}

export interface BoardData {
  date: string
  users: BoardUser[]
  visits: BoardVisit[]
}

export interface CustomerHit {
  id: string
  name: string | null
  phone: string
  assignedSite: string | null
}
