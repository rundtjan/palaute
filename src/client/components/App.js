import React, { useEffect, Suspense } from 'react'
import * as Sentry from '@sentry/browser'
import { initShibbolethPinger } from 'unfuck-spa-shibboleth-session'
import { useTranslation } from 'react-i18next'
import { CssBaseline } from '@material-ui/core'

import NavBar from './NavBar'
import Footer from './Footer'
import DevTools from './DevTools'
import Router from './Router'
import { useUserData } from '../util/queries'

export default () => {
  const { i18n } = useTranslation()

  useEffect(() => {
    initShibbolethPinger() // Remove this if not used behind shibboleth
  }, [])

  const user = useUserData()

  useEffect(() => {
    if (!user.data) return

    Sentry.setUser({ username: user.data.id })
    if (!user.data.language) return

    i18n.changeLanguage(user.data.language)
  }, [user.data])

  if (user.isLoading) return null

  return (
    <>
      <CssBaseline />
      <Suspense fallback={null}>
        <NavBar />
        <Router />
        <DevTools />
        <Footer />
      </Suspense>
    </>
  )
}
