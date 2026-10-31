import type { User, UserPermission, UserRole } from '../types'

export const allPermissions: UserPermission[] = [
  'viewDashboard',
  'manageLeads',
  'manageClients',
  'manageProjects',
  'manageAgenda',
  'manageQuotes',
  'manageFinance',
  'manageEquipment',
  'viewReports',
  'manageMarketing',
  'manageSettings',
  'manageUsers',
]

export const permissionLabels: Record<UserPermission, string> = {
  viewDashboard: 'Dashboard',
  manageLeads: 'Comercial e CRM',
  manageClients: 'Contatos',
  manageProjects: 'Projetos',
  manageAgenda: 'Agenda',
  manageQuotes: 'Orçamentos',
  manageFinance: 'Financeiro',
  manageEquipment: 'Equipamentos',
  viewReports: 'Relatórios',
  manageMarketing: 'Mídias sociais e métricas',
  manageSettings: 'Configurações',
  manageUsers: 'Usuários e permissões',
}

export const rolePermissionPresets: Record<UserRole, UserPermission[]> = {
  Administrador: allPermissions,
  Editor: ['viewDashboard', 'manageLeads', 'manageClients', 'manageProjects', 'manageAgenda', 'manageQuotes', 'manageMarketing'],
  Piloto: ['viewDashboard', 'manageProjects', 'manageAgenda', 'manageEquipment'],
  Financeiro: ['viewDashboard', 'manageClients', 'manageProjects', 'manageQuotes', 'manageFinance', 'viewReports'],
  Assistente: ['viewDashboard', 'manageLeads', 'manageClients', 'manageAgenda', 'manageMarketing'],
}

export const can = (user: User | undefined, permission: UserPermission) =>
  Boolean(user?.active && (user.isPrimaryOwner || user.permissions.includes(permission)))

export const canOpenPage = (user: User | undefined, page: string) => {
  if (!user?.active) return false
  if (page === 'profile') return true
  if (user.isPrimaryOwner) return true

  const pagePermissions: Record<string, UserPermission> = {
    dashboard: 'viewDashboard',
    leads: 'manageLeads',
    clients: 'manageClients',
    inbox: 'manageLeads',
    projects: 'manageProjects',
    internalProjects: 'manageProjects',
    agenda: 'manageAgenda',
    quotes: 'manageQuotes',
    finance: 'manageFinance',
    equipment: 'manageEquipment',
    reports: 'viewReports',
    integrations: 'manageSettings',
    settings: 'manageSettings',
    users: 'manageUsers',
  }

  // Quem já opera o CRM entra no marketing sem precisar reeditar cada usuário existente.
  if (page === 'content' || page === 'metrics') return can(user, 'manageMarketing') || can(user, 'manageLeads')

  const permission = pagePermissions[page]
  return permission ? can(user, permission) : false
}

export const permissionSummary = (user: User) => {
  if (user.isPrimaryOwner) return 'Acesso total'
  if (user.permissions.length === allPermissions.length) return 'Acesso total'
  return `${user.permissions.length} permissão(ões)`
}
