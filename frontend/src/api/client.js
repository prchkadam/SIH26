import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexus_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('nexus_token')
      localStorage.removeItem('nexus_user')

      if (!location.pathname.startsWith('/login')) {
        location.href = '/login'
      }
    }

    return Promise.reject(err)
  }
)

export default client

export const api = {

  // -------------------------------------------------------
  // Authentication
  // -------------------------------------------------------

  login: (username, password) =>
    client.post('/auth/login', { username, password }),

  me: () =>
    client.get('/auth/me'),


  // -------------------------------------------------------
  // Analysis
  // -------------------------------------------------------

  overview: () =>
    client.get('/analysis/overview'),

  hubs: (limit = 15) =>
    client.get(`/analysis/hubs?limit=${limit}`),

  intermediaries: (limit = 15) =>
    client.get(`/analysis/intermediaries?limit=${limit}`),

  communities: (minSize = 3, limit = 20) =>
    client.get(
      `/analysis/communities?min_size=${minSize}&limit=${limit}`
    ),

  frequentInteractions: (limit = 15) =>
    client.get(
      `/analysis/frequent-interactions?limit=${limit}`
    ),

  unusualStructures: (limit = 15) =>
    client.get(
      `/analysis/unusual-structures?limit=${limit}`
    ),

  temporal: (start, end) => {
    const params = new URLSearchParams()
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    return client.get(`/analysis/temporal${params.toString() ? `?${params}` : ''}`)
  },


  // -------------------------------------------------------
  // Graph
  // -------------------------------------------------------

  graph: (limit = 1500) =>
    client.get(`/graph?limit=${limit}`),

  graphStats: () =>
    client.get('/graph/stats'),

  expand: (id, depth = 1) =>
    client.get(`/graph/expand/${id}?depth=${depth}`),

  path: (source, target) =>
    client.get(
      `/graph/path?source=${source}&target=${target}`
    ),


  // -------------------------------------------------------
  // Entities
  // -------------------------------------------------------

  entities: (type) =>
    client.get(
      `/entities${type ? `?type=${type}` : ''}`
    ),

  entity: (id) =>
    client.get(`/entities/${id}`),

  entityProfile: (id) =>
    client.get(`/entities/${id}/profile`),

  entityConnections: (id, depth = 1) =>
    client.get(
      `/entities/${id}/connections?depth=${depth}`
    ),

  resolutionCandidates: (id) =>
    client.get(
      `/entities/${id}/resolution-candidates`
    ),

  createEntity: (data) =>
    client.post('/entities', data),

  createRelationship: (data) =>
    client.post('/entities/relationships', data),


  // -------------------------------------------------------
  // Alerts
  // -------------------------------------------------------

  alerts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()

    return client.get(
      `/alerts${qs ? `?${qs}` : ''}`
    )
  },

  alert: (id) =>
    client.get(`/alerts/${id}`),

  runDetection: () =>
    client.post('/alerts/run-detection'),

  resolveAlert: (id) =>
    client.post(`/alerts/${id}/resolve`),

  dismissAlert: (id) =>
    client.post(`/alerts/${id}/dismiss`),


  // -------------------------------------------------------
  // Cases
  // -------------------------------------------------------

  cases: () =>
    client.get('/cases'),

  case: (id) =>
    client.get(`/cases/${id}`),

  createCase: (data) =>
    client.post('/cases', data),

  deleteCase: (id) =>
    client.delete(`/cases/${id}`),

  linkToCase: (caseId, data) =>
    client.post(
      `/cases/${caseId}/link`,
      data
    ),

  addCaseNote: (caseId, text) =>
    client.post(
      `/cases/${caseId}/notes`,
      { text }
    ),


  // -------------------------------------------------------
  // Search
  // -------------------------------------------------------

  search: (q) =>
    client.get(
      `/search?q=${encodeURIComponent(q)}`
    ),


  // -------------------------------------------------------
  // Data Ingestion
  // -------------------------------------------------------

  ingestSchema: () =>
    client.get('/ingest/schema'),

  ingestCsv: (datasetType, file) => {

    const form = new FormData()

    form.append('dataset_type', datasetType)
    form.append('file', file)

    return client.post(
      '/ingest/csv',
      form,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    )
  },

  ingestJson: (datasetType, file) => {

    const form = new FormData()

    form.append('dataset_type', datasetType)
    form.append('file', file)

    return client.post(
      '/ingest/json',
      form,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    )
  },

  ingestText: (text, commit = false) =>
    client.post(
      '/ingest/text',
      {
        text,
        commit
      }
    ),


  // -------------------------------------------------------
  // Blockchain
  // -------------------------------------------------------

  blockchain: () =>
    client.get('/blockchain/chain'),

  verifyBlockchain: () =>
    client.get('/blockchain/verify'),

  blockchainBlock: (index) =>
    client.get(`/blockchain/block/${index}`),

  blockchainEvidence: (id) =>
    client.get(`/blockchain/evidence/${id}`),

  verifyEvidence: (id) =>
    client.get(
      `/blockchain/evidence/${id}/verify`
    ),


  // -------------------------------------------------------
  // Case Evidence
  // -------------------------------------------------------

  addEvidence: (caseId, data) =>
    client.post(
      `/cases/${caseId}/evidence`,
      data
    ),

  caseEvidence: (caseId) =>
    client.get(
      `/cases/${caseId}/evidence`
    ),

  // Create a corrected evidence version
  editEvidence: (caseId, evidenceId, data) =>
    client.put(
      `/cases/${caseId}/evidence/${evidenceId}`,
      data
    ),

  // Manually mark the current evidence version as verified
  verifyEvidenceVersion: (caseId, evidenceId) =>
    client.post(
      `/cases/${caseId}/evidence/${evidenceId}/verify`
    ),

  // Get complete evidence revision history
  evidenceHistory: (caseId, evidenceId) =>
    client.get(
      `/cases/${caseId}/evidence/${evidenceId}/history`
    ),
}