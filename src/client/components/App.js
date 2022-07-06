import React, { Suspense } from 'react'
import { Switch, Route } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles'

import CssBaseline from './CssBaseline'
import PickerUtilsProvider from './PickerUtilsProvider'
import AdUser from './AdUser'
import GuestUser from './GuestUser'
import useTheme from '../theme'

/* eslint-disable */
const App = () => {
  const theme = useTheme()

  return (
    <PickerUtilsProvider>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Suspense fallback={null}>
            <SnackbarProvider maxSnack={3} preventDuplicate>
              <Switch>
                <Route path="/noad">
                  <GuestUser />
                </Route>
                <Route>
                  <AdUser />
                </Route>
              </Switch>
            </SnackbarProvider>
          </Suspense>
        </ThemeProvider>
      </StyledEngineProvider>
    </PickerUtilsProvider>
  )
}
/* eslint-enable */
export default App
