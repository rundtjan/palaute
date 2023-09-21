import React from 'react'
import { Alert, Box, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import OrganisationSummaryRow from './SummaryRow'
import { updateSummaries, useSummaries } from './api'
import LinkButton from '../../../components/common/LinkButton'
import { YearSemesterSelector } from '../../../components/common/YearSemesterSelector'
import { UNIVERSITY_ROOT_ID } from '../../../util/common'
import { useSummaryContext } from './context'

/**
 *
 */
const University = () => {
  const { dateRange, setDateRange, option, setOption } = useSummaryContext()
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const [, startTransition] = React.useTransition()
  const startDate = new Date('2023-01-01')
  const endDate = new Date('2024-01-01')

  const { organisation: universityOrganisation } = useSummaries({
    entityId: UNIVERSITY_ROOT_ID,
    startDate,
    endDate,
  })

  const handleUpdateData = async () => {
    const duration = await updateSummaries()
    if (duration) enqueueSnackbar(`Valmis, kesti ${(duration / 1000).toFixed()} sekuntia`)
  }

  const handleChangeTimeRange = nextDateRange => {
    startTransition(() => {
      setDateRange(nextDateRange)
    })
  }

  return (
    <Box>
      <Box mb={6} px={1}>
        <Box display="flex" gap="1rem" alignItems="end">
          <Typography variant="h4" component="h1">
            {t('courseSummary:heading')}
          </Typography>
          <LinkButton to="/course-summary" title="Vanha" />
        </Box>
        <Button variant="text" onClick={handleUpdateData}>
          Aja datanpäivitys
        </Button>
      </Box>
      <Box display="flex" pb="2rem" justifyContent="space-between" alignItems="end">
        <YearSemesterSelector
          value={dateRange ?? { start: new Date(), end: new Date() }}
          onChange={handleChangeTimeRange}
          option={option}
          setOption={setOption}
        />
        <Alert severity="info" sx={{ whiteSpace: 'pre-wrap', mb: '1rem' }}>
          Tässä näkymässä lukuvuosi alkaa 1.8. ja päättyy 1.8. seuraavana vuonna.{'\n'}
          Kevätlukukausi alkaa 1.1. ja päättyy 1.8.{'\n'}
          Syyslukukausi alkaa 1.8. ja päättyy 1.1. seuraavana vuonna.{'\n'}
          {'\n'}
          Jos kurssitoteutuksen aloituspäivämäärä osuu valitulle aikavälille, {'\n'}
          sen statistiikka lasketaan mukaan riippumatta siitä, {'\n'}
          milloin palautetta on annettu.
        </Alert>
      </Box>
      <OrganisationSummaryRow
        organisationId={UNIVERSITY_ROOT_ID}
        organisation={universityOrganisation}
        alwaysOpen
        startDate={dateRange.start}
        endDate={dateRange.end}
      />
    </Box>
  )
}

export default University
