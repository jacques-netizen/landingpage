import { requireStaff } from '@/server/guard'
import { AdminPage } from '../../_components/ui'
import { ClientForm } from '../client-form'

export default async function NewClientPage() {
  await requireStaff('money', '/admin/clients/new')
  return (
    <AdminPage title="New client" lead="The service fee is a percent on top of each campaign budget.">
      <ClientForm
        id={null}
        canEdit
        initial={{ name: '', contactName: '', contactEmail: '', serviceFee: '', notes: '' }}
      />
    </AdminPage>
  )
}
