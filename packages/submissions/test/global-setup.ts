import { prepareDatabase } from '../../money/test/global-setup'

export default async function setup() {
  await prepareDatabase(
    process.env.SUBMISSIONS_TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde_test_submissions',
  )
}
