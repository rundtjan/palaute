import React from 'react'
import { Alert, Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useSummaryContext } from './context'
import { useTeacherSummaries } from './api'
import { SorterRow, TeacherOrganisationSummaryRow } from './SummaryRow'
import { OPEN_UNIVERSITY_ORG_ID } from '../../util/common'
import SeparateOrganisationModeSelector from './SeparateOrganisationModeSelector'

/**
 *
 */
const MyCourses = () => {
  const { t } = useTranslation()
  const { dateRange, questions, separateOrganisationId, showSeparateOrganisationCourses } = useSummaryContext()
  const { organisations, isLoading: isOrganisationsLoading } = useTeacherSummaries({
    startDate: dateRange.start,
    endDate: dateRange.end,
    enabled: true,
    separateOrganisationId,
  })

  const show = !isOrganisationsLoading && questions?.length && organisations && questions

  return (
    <Box display="flex" flexDirection="column" alignItems="stretch" gap="0.3rem">
      {OPEN_UNIVERSITY_ORG_ID && <SeparateOrganisationModeSelector organisationId={OPEN_UNIVERSITY_ORG_ID} />}
      <SorterRow />
      {show &&
        organisations.length > 0 &&
        organisations
          .filter(org => showSeparateOrganisationCourses || org.id !== separateOrganisationId)
          .map(organisation => (
            <TeacherOrganisationSummaryRow key={organisation.id} questions={questions} organisation={organisation} />
          ))}
      {show && organisations.length === 0 && (
        <Box my="1rem" mx="2rem">
          <Alert severity="info">{t('courseSummary:noCourses')}</Alert>
        </Box>
      )}
    </Box>
  )
}

export default MyCourses
