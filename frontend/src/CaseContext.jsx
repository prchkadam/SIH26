import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { api } from './api/client'

const CaseContext = createContext(null)

export function CaseProvider({ children }) {
  const [activeCaseId, setActiveCaseIdState] = useState(() => localStorage.getItem('nexus_active_case') || null)
  const [activeCase, setActiveCase] = useState(null)
  const [cases, setCases] = useState([])

  const refreshCases = useCallback(async () => {
    const res = await api.cases()
    setCases(res.data.cases)
    return res.data.cases
  }, [])

  const setActiveCaseId = useCallback((id) => {
    setActiveCaseIdState(id)
    if (id) localStorage.setItem('nexus_active_case', id)
    else localStorage.removeItem('nexus_active_case')
  }, [])

  useEffect(() => {
    if (!activeCaseId) {
      setActiveCase(null)
      return
    }
    api.case(activeCaseId).then((res) => setActiveCase(res.data)).catch(() => setActiveCase(null))
  }, [activeCaseId])

  const linkEntityToActiveCase = useCallback(async (entityId, entityType) => {
    if (!activeCaseId) return false
    await api.linkToCase(activeCaseId, { entity_id: entityId, entity_type: entityType, linked_kind: 'entity' })
    const res = await api.case(activeCaseId)
    setActiveCase(res.data)
    return true
  }, [activeCaseId])

  const linkAlertToActiveCase = useCallback(async (alertId) => {
    if (!activeCaseId) return false
    await api.linkToCase(activeCaseId, { ref_id: alertId, linked_kind: 'alert' })
    const res = await api.case(activeCaseId)
    setActiveCase(res.data)
    return true
  }, [activeCaseId])

  return (
    <CaseContext.Provider value={{
      activeCaseId, activeCase, cases, setActiveCaseId, refreshCases,
      linkEntityToActiveCase, linkAlertToActiveCase,
    }}>
      {children}
    </CaseContext.Provider>
  )
}

export function useCase() {
  const ctx = useContext(CaseContext)
  if (!ctx) throw new Error('useCase must be used within CaseProvider')
  return ctx
}
