export const STAFF_ROLES = ['reviewer', 'finance', 'admin'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

// 01_PRODUCT.md section 2 and 03_SYSTEMS.md section 1.
// Any staff role may open /admin. Money actions need finance or admin. Settings, roles and terms need admin.
export const ACCESS = {
  staff: ['reviewer', 'finance', 'admin'],
  money: ['finance', 'admin'],
  admin: ['admin'],
} as const satisfies Record<string, readonly StaffRole[]>

export type Access = keyof typeof ACCESS

export function canAccess(roles: readonly StaffRole[], access: Access): boolean {
  const allowed: readonly StaffRole[] = ACCESS[access]
  return roles.some((r) => allowed.includes(r))
}
