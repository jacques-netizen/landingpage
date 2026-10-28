import { apiError } from '@/server/partner-api'

// Any other /api/v1 address answers in the API's error shape, not with an HTML page.
const notFound = () => apiError('not_found', 'No such endpoint. See the API reference at /developers.')
export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE }
