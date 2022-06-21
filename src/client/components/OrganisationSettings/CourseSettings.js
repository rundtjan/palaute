import React, { useState } from 'react'

import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  Box,
  Card,
  CardContent,
  TableRow,
  TableCell,
  Table,
  TableHead,
  TableBody,
  TableContainer,
} from '@material-ui/core'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'react-query'
import { useSnackbar } from 'notistack'
import { useParams, Redirect } from 'react-router-dom'

import { getLanguageValue } from '../../util/languageUtils'
import useOrganisationCourseUnits from '../../hooks/useOrganisationCourseUnits'
import Alert from '../Alert'
import apiClient from '../../util/apiClient'
import useOrganisation from '../../hooks/useOrganisation'
import { LoadingProgress } from '../LoadingProgress'

const getCourseUnitItems = (
  courseUnits,
  disabledCourseCodes,
  studentListVisibleCourseCodes,
) =>
  (courseUnits ?? []).map(({ courseCode, name }) => ({
    courseCode,
    name,
    enabledCourse: !disabledCourseCodes.includes(courseCode),
    studentListVisible: studentListVisibleCourseCodes.includes(courseCode),
  }))

const saveChangedCourseCodes = async ({
  code,
  disabledCourseCodes,
  studentListVisibleCourseCodes,
}) => {
  const { data } = await apiClient.put(`/organisations/${code}`, {
    disabledCourseCodes,
    studentListVisibleCourseCodes,
  })

  return data
}

const CourseUnitItem = ({
  courseCode,
  name,
  disabled,
  enabledCourse,
  studentListVisible,
  onChangeDisabledCourses,
  onChangeStudentList,
}) => {
  const { i18n } = useTranslation()
  const labelId = `courseUnitItem-${courseCode}`

  const translatedLabel = `${getLanguageValue(
    name,
    i18n.language,
  )} (${courseCode})`

  return (
    <TableRow>
      <TableCell>{translatedLabel}</TableCell>
      <TableCell>
        <Switch
          edge="start"
          checked={enabledCourse}
          onChange={onChangeDisabledCourses}
          tabIndex={-1}
          disableRipple
          inputProps={{ 'aria-labelledby': labelId }}
          color="primary"
          disabled={disabled}
        />
      </TableCell>
      <TableCell>
        <Switch
          edge="start"
          checked={studentListVisible}
          onChange={onChangeStudentList}
          tabIndex={-1}
          disableRipple
          inputProps={{ 'aria-labelledby': labelId }}
          color="primary"
          disabled={disabled}
        />
      </TableCell>
    </TableRow>
  )
}

const CourseSettingsContainer = ({ organisation, courseUnits }) => {
  const { t } = useTranslation()
  const { code } = organisation
  const { enqueueSnackbar } = useSnackbar()
  const mutation = useMutation(saveChangedCourseCodes)

  const [disabledCourseCodes, setDisabledCourseCodes] = useState(
    organisation.disabledCourseCodes ?? [],
  )

  const [studentListVisibleCourseCodes, setStudentListVisibleCourseCodes] =
    useState(organisation.studentListVisibleCourseCodes ?? [])

  const courseUnitItems = getCourseUnitItems(
    courseUnits,
    disabledCourseCodes,
    studentListVisibleCourseCodes,
  )

  const makeOnToggleDisabledCourses = (courseCode) => async () => {
    const checked = disabledCourseCodes.includes(courseCode)

    const updatedDisabledCourseCodes = checked
      ? disabledCourseCodes.filter((c) => c !== courseCode)
      : [...disabledCourseCodes, courseCode]

    try {
      const updatedOrganisation = await mutation.mutateAsync({
        code,
        disabledCourseCodes: updatedDisabledCourseCodes,
      })

      setDisabledCourseCodes(updatedOrganisation.disabledCourseCodes)
      enqueueSnackbar(t('saveSuccess'), { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(t('unknownError'), { variant: 'error' })
    }
  }

  const makeOnToggleStudentListVisible = (courseCode) => async () => {
    const checked = studentListVisibleCourseCodes.includes(courseCode)

    const updatedStudentListVisibleCourseCodes = checked
      ? studentListVisibleCourseCodes.filter((c) => c !== courseCode)
      : [...studentListVisibleCourseCodes, courseCode]

    try {
      const updatedOrganisation = await mutation.mutateAsync({
        code,
        studentListVisibleCourseCodes: updatedStudentListVisibleCourseCodes,
      })

      setStudentListVisibleCourseCodes(
        updatedOrganisation.studentListVisibleCourseCodes,
      )
      enqueueSnackbar(t('saveSuccess'), { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(t('unknownError'), { variant: 'error' })
    }
  }

  return (
    <Card>
      <CardContent>
        <Box mb={2}>
          <Alert severity="info">
            {t('organisationSettings:courseSettingsInfo')}
          </Alert>
        </Box>
        <TableContainer style={{ maxHeight: '640px' }}>
          <Table stickyHeader>
            <TableHead>
              <TableCell>Course</TableCell>
              <TableCell>Student list visible</TableCell>
              <TableCell>Feedback enabled</TableCell>
            </TableHead>
            <TableBody>
              {courseUnitItems.map(
                ({ courseCode, name, enabledCourse, studentListVisible }) => (
                  <CourseUnitItem
                    name={name}
                    courseCode={courseCode}
                    key={courseCode}
                    enabledCourse={enabledCourse}
                    studentListVisible={studentListVisible}
                    onChangeDisabledCourses={makeOnToggleDisabledCourses(
                      courseCode,
                    )}
                    onChangeStudentList={makeOnToggleStudentListVisible(
                      courseCode,
                    )}
                    disabled={mutation.isLoading}
                  />
                ),
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}

const CourseSettings = () => {
  const { code } = useParams()

  const { courseUnits, isLoading: courseUnitsIsLoading } =
    useOrganisationCourseUnits(code)

  const { organisation, isLoading: organisationIsLoading } = useOrganisation(
    code,
    { skipCache: true },
  )

  const isLoading = courseUnitsIsLoading || organisationIsLoading

  if (isLoading) {
    return <LoadingProgress />
  }

  if (!organisation.access.admin) {
    return <Redirect to={`/organisations/${code}/settings`} />
  }

  return (
    <CourseSettingsContainer
      organisation={organisation}
      courseUnits={courseUnits}
    />
  )
}

export default CourseSettings
