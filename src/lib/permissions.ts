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
  manageSettings: 'Configurações',
  manageUsers: 'Usuários e permissões',
}

export const rolePermissionPresets: Record<UserRole, UserPermission[]> = {
  Administrador: allPermissions,
  Editor: ['viewDashboard', 'manageLeads', 'manageClients', 'manageProjects', 'manageAgenda', 'manageQuotes'],
  Piloto: ['viewDashboard', 'manageProjects', 'manageAgenda', 'manageEquipment'],
  Financeiro: ['viewDashboard', 'manageClients', 'manageProjects', 'manageQuotes', 'manageFinance', 'viewReports'],
  Assistente: ['viewDashboard', 'manageLeads', 'manageClients', 'manageAgenda'],
}

export const can = (user: User | undefined, permission: UserPermission) =>
  Boolean(user?.active && (user.isPrimaryOwner || user.permissions.includes(permission)))

export const canOpenPage = (user: User | undefined, page: string) => {
  if (!user?.active) return false
  if (user.isPrimaryOwner) return true

  const pagePermissions: Record<string, UserPermission> = {
    dashboard: 'viewDashboard',
    leads: 'manageLeads',
    clients: 'manageClients',
    leadHunter: 'manageLeads',
    projects: 'manageProjects',
    agenda: 'manageAgenda',
    quotes: 'manageQuotes',
    finance: 'manageFinance',
    equipment: 'manageEquipment',
    reports: 'viewReports',
    settings: 'manageSettings',
    users: 'manageUsers',
  }

  const permission = pagePermissions[page]
  return permission ? can(user, permission) : false
}

export const permissionSummary = (user: User) => {
  if (user.isPrimaryOwner) return 'Acesso total'
  if (user.permissions.length === allPermissions.length) return 'Acesso total'
  return `${user.permissions.length} permissão(ões)`
}
