export const ENTITY_COLORS = {
  Person: '#22c55e',        // 🟢 Green
  Organization: '#a78bfa',  // 🟣 Purple
  Phone: '#f87171',         // 🔴 Red
  Account: '#facc15',       // 🟡 Yellow
  Vehicle: '#f59e0b',       // 🟠 Orange
  Location: '#38bdf8',      // 🔵 Blue
  Date: '#94a3b8',          // ⚪ Gray
}

export const ENTITY_ICONS = {
  Person: 'User',
  Organization: 'Building2',
  Phone: 'Phone',
  Account: 'Landmark',
  Vehicle: 'Car',
  Location: 'MapPin',
  Date: 'Calendar',
}

export const REL_COLORS = {
  called: '#a78bfa',
  communicated_with: '#a78bfa',
  transferred_money_to: '#22c55e',
  paid: '#22c55e',
  sent_money_to: '#22c55e',
  owns: '#fb7185',
  uses: '#fb7185',
  associated_with: '#f5a524',
  employed_by: '#f5a524',
  member_of: '#f5a524',
  visited: '#38bdf8',
  resides_at: '#38bdf8',
  met: '#e879f9',
}

export function scoreColor(score) {
  if (score >= 80) return '#ef4757'
  if (score >= 60) return '#f5a524'
  if (score >= 40) return '#38bdf8'
  return '#7c8798'
}

export function scoreLabel(score) {
  if (score >= 80) return 'Critical'
  if (score >= 60) return 'High'
  if (score >= 40) return 'Moderate'
  return 'Low'
}

export function relLabel(type) {
  return (type || '').replace(/_/g, ' ')
}
