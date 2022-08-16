import * as Sentry from '@sentry/browser'
import { Integrations } from '@sentry/tracing'
import { inProduction, inStaging, GIT_SHA } from '../../config/config'

const initializeSentry = () => {
  if (!inProduction || inStaging) return

  Sentry.init({
    dsn: 'https://8877ea30aa714216b27b22c8aa395723@sentry.cs.helsinki.fi/6',
    release: GIT_SHA,
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: 1.0,
  })
}

export default initializeSentry
