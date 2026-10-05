import { prepareDatabase } from '../../money/test/global-setup'

export const CAMPAIGNS_TEST_DATABASE_URL =
  process.env.CAMPAIGNS_TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde_test_campaigns'

export default async function setup() {
  await prepareDatabase(CAMPAIGNS_TEST_DATABASE_URL)
}
