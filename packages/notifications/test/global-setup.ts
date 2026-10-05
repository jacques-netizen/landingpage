import { prepareDatabase } from '../../money/test/global-setup'

export default async function setup() {
  await prepareDatabase(
    process.env.NOTIFICATIONS_TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde_test_notifications',
  )
}
