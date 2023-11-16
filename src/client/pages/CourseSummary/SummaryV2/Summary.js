import React from 'react'
import _ from 'lodash'
import { Switch } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { Box, Button, Typography } from '@mui/material'
import { BarChartOutlined, School } from '@mui/icons-material'
import { SummaryContextProvider } from './context'
import useAuthorizedUser from '../../../hooks/useAuthorizedUser'
import ProtectedRoute from '../../../components/common/ProtectedRoute'
import MyOrganisations from './MyOrganisations'
import University from './University'
import { updateSummaries } from './api'
import LinkButton from '../../../components/common/LinkButton'
import { RouterTab, RouterTabs } from '../../../components/common/RouterTabs'
import hyLogo from '../../../assets/hy_logo_black.svg'
import MyCourses from './MyCourses'
import SummaryScrollContainer from './SummaryScrollContainer'
import { UNIVERSITY_LEVEL_VIEWING_SPECIAL_GROUPS } from '../../../util/common'

const SummaryInContext = () => {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const { search } = window.location

  const handleUpdateData = async () => {
    const duration = await updateSummaries()
    if (duration) enqueueSnackbar(`Valmis, kesti ${(duration / 1000).toFixed()} sekuntia`)
  }

  const { authorizedUser: user } = useAuthorizedUser()

  const hasAccessToMyOrganisations = Object.keys(user?.organisationAccess ?? {}).length > 0
  const hasAccessToUniversityLevel =
    user?.isAdmin ||
    _.intersection(UNIVERSITY_LEVEL_VIEWING_SPECIAL_GROUPS, Object.keys(user?.specialGroup ?? {})).length > 0

  return (
    <>
      <Box mb="6rem" px={1}>
        <Box display="flex" gap="1rem" alignItems="end">
          <Typography variant="h4" component="h1">
            {t('courseSummary:heading')}
          </Typography>
          <LinkButton to="/course-summary" title="Vanha" />
        </Box>
        {user?.isAdmin && (
          <Button variant="text" onClick={handleUpdateData}>
            Aja datanpäivitys
          </Button>
        )}
      </Box>
      <RouterTabs variant="scrollable" scrollButtons="auto">
        {hasAccessToUniversityLevel && (
          <RouterTab
            label={t('common:university')}
            icon={
              <Box sx={{ width: '1.5rem', height: 'auto' }}>
                <img src={hyLogo} alt="HY" />
              </Box>
            }
            to={`/course-summary/v2/university${search}`}
          />
        )}
        {hasAccessToMyOrganisations && (
          <RouterTab
            label={t('courseSummary:myOrganisations')}
            icon={<BarChartOutlined />}
            to={`/course-summary/v2/my-organisations${search}`}
          />
        )}
        <RouterTab
          label={t('courseSummary:myCourses')}
          icon={<School />}
          to={`/course-summary/v2/my-courses${search}`}
        />
      </RouterTabs>
      <SummaryScrollContainer>
        <Switch>
          <ProtectedRoute
            path="/course-summary/v2/university"
            redirectPath="/course-summary/v2/my-organisations"
            component={University}
            hasAccess={hasAccessToUniversityLevel}
          />

          <ProtectedRoute
            path="/course-summary/v2/my-organisations"
            redirectPath="/course-summary/v2/my-courses"
            component={MyOrganisations}
            hasAccess={hasAccessToMyOrganisations}
          />

          <ProtectedRoute path="/course-summary/v2/my-courses" component={MyCourses} hasAccess />
        </Switch>
      </SummaryScrollContainer>
    </>
  )
}

const Summary = () => (
  <SummaryContextProvider>
    <SummaryInContext />
  </SummaryContextProvider>
)

export default Summary
