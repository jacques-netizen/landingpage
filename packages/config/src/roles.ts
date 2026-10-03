/** Staff roles from docs/01_PRODUCT.md section 2. Finance does what a reviewer does. Admin does everything. */
export const staffRoles = ['reviewer', 'finance', 'admin'] as const
export type StaffRole = (typeof staffRoles)[number]

const rank: Record<StaffRole, number> = { reviewer: 1, finance: 2, admin: 3 }

const isRole = (r: string): r is StaffRole => (staffRoles as readonly string[]).includes(r)

export function isStaff(roles: readonly string[]): boolean {
  return roles.some(isRole)
}

/** True when any held role is at least as strong as the required one. */
export function hasRole(roles: readonly string[], required: StaffRole): boolean {
  return roles.filter(isRole).some((r) => rank[r] >= rank[required])
}
