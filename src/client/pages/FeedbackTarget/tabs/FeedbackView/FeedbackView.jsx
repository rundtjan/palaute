import React, { useState } from 'react'
/** @jsxImportSource @emotion/react */

import { useParams, useHistory, Link } from 'react-router-dom'

import { Typography, Button, Box, Card, CardContent, Alert } from '@mui/material'

import { useTranslation, Trans } from 'react-i18next'
import { Formik, Form } from 'formik'
import { useSnackbar } from 'notistack'

import ContinuousFeedback from './ContinuousFeedback'
import FeedbackForm from './FeedbackForm'
import useAuthorizedUser from '../../../../hooks/useAuthorizedUser'
import feedbackTargetIsOpen from '../../../../util/feedbackTargetIsOpen'
import PrivacyDialog from './PrivacyDialog'
import Toolbar from './Toolbar'
import AlertLink from '../../../../components/common/AlertLink'

import { makeValidate, getInitialValues, getQuestions, formatDate, checkIsFeedbackOpen, useSaveValues } from './utils'

import feedbackTargetIsEnded from '../../../../util/feedbackTargetIsEnded'
import { LoadingProgress } from '../../../../components/common/LoadingProgress'
import { useFeedbackTargetContext } from '../../FeedbackTargetContext'
import feedbackGivenSnackbarContent from './FeedbackGivenSnackBar'

const FormContainer = ({
  onSubmit,
  initialValues,
  onOpenPrivacyDialog,
  validate,
  questions,
  disabled: disabledProp,
  showCannotSubmitText = false,
  showSubmitButton = true,
  isEdit = false,
}) => {
  const { t } = useTranslation()

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit} validate={validate} validateOnChange={false}>
      {({ isSubmitting }) => {
        const disabled = isSubmitting || disabledProp

        return (
          <Form>
            <Card>
              <CardContent>
                <Box mb={2}>
                  <Alert severity="info">
                    {t('feedbackView:feedbackInfo')}{' '}
                    <AlertLink href="#feedback-privacy-dialog-title" onClick={onOpenPrivacyDialog}>
                      {t('feedbackView:feedbackInfoLink')}
                    </AlertLink>
                  </Alert>
                </Box>

                <FeedbackForm questions={questions} name="answers" />
              </CardContent>
            </Card>

            {showSubmitButton && (
              <Box mt={2}>
                <Button
                  data-cy="feedback-view-give-feedback"
                  disabled={disabled}
                  color="primary"
                  variant="contained"
                  type="submit"
                >
                  {isEdit ? t('feedbackView:editButton') : t('feedbackView:submitButton')}
                </Button>
                {showCannotSubmitText && (
                  <Box mt={1}>
                    <Typography color="textSecondary">{t('feedbackView:cannotSubmitText')}</Typography>
                  </Box>
                )}
              </Box>
            )}
          </Form>
        )
      }}
    </Formik>
  )
}

const FeedbackView = () => {
  const { id, interimFeedbackId } = useParams()

  const history = useHistory()
  const { t, i18n } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false)
  const submitMutation = useSaveValues()

  const { authorizedUser } = useAuthorizedUser()
  const { feedbackTarget, isStudent, isResponsibleTeacher, isOrganisationAdmin, isTeacher } = useFeedbackTargetContext()
  const isLoading = !feedbackTarget

  if (isLoading) {
    return <LoadingProgress />
  }

  const { language } = i18n
  const { accessStatus, opensAt, closesAt, feedback, continuousFeedbackEnabled } = feedbackTarget

  // TODO clean up this shit again
  const isOutsider = accessStatus === 'NONE'
  const isEnded = feedbackTargetIsEnded(feedbackTarget)
  const isOpen = feedbackTargetIsOpen(feedbackTarget)
  const isOngoing = !isOpen && !isEnded
  const showContinuousFeedback = isStudent && isOngoing && continuousFeedbackEnabled
  const showClosedAlert = isOngoing && !showContinuousFeedback
  const showForm = isOrganisationAdmin || isTeacher || isOpen || isEnded
  const formIsDisabled = !isOpen || isTeacher || isOutsider || isOrganisationAdmin
  const showToolbar = (isOrganisationAdmin || isTeacher) && !isOpen && !isEnded
  const questions = getQuestions(feedbackTarget)
  const initialValues = getInitialValues(feedbackTarget)
  const validate = makeValidate(questions)

  const editLink = interimFeedbackId
    ? `/targets/${id}/interim-feedback/${interimFeedbackId}/edit`
    : `/targets/${id}/edit`

  const handleSubmit = async values => {
    try {
      if (checkIsFeedbackOpen(closesAt)) {
        enqueueSnackbar(t('feedbackView:feedbackClosedError'), {
          variant: 'error',
        })
      } else {
        const feedbackData = Object.entries(values.answers).map(([questionId, data]) => ({
          questionId: Number(questionId),
          data,
        }))

        await submitMutation.mutateAsync(feedbackData)

        history.push(`/targets/${id}/results`)

        enqueueSnackbar(t('feedbackView:successAlert'), {
          variant: 'success',
          autoHideDuration: 6000,
          content: feedbackGivenSnackbarContent,
        })
      }
    } catch (e) {
      enqueueSnackbar(t('common:unknownError'), { variant: 'error' })
    }
  }

  const closedAlert = (
    <Box mb={2}>
      <Alert severity="warning">
        {t('feedbackView:closedInfo', {
          opensAt: formatDate(new Date(opensAt)),
          closesAt: formatDate(new Date(closesAt)),
        })}
      </Alert>
    </Box>
  )

  const endedAlert = (
    <Box mb={2}>
      <Alert severity="info">
        <Trans i18nKey="feedbackView:endedInfo">
          The feedback period has ended.{' '}
          <AlertLink component={Link} to={`/targets/${feedbackTarget.id}/results`}>
            Take a look at the feedbacks
          </AlertLink>
        </Trans>
      </Alert>
    </Box>
  )

  const handleClosePrivacyDialog = () => {
    setPrivacyDialogOpen(false)
  }

  const handleOpenPrivacyDialog = event => {
    event.preventDefault()
    setPrivacyDialogOpen(true)
  }

  const handleLanguageChange = language => {
    i18n.changeLanguage(language)
  }

  return (
    <>
      <PrivacyDialog open={privacyDialogOpen} onClose={handleClosePrivacyDialog} />

      {showContinuousFeedback && <ContinuousFeedback />}

      {showClosedAlert && closedAlert}

      {isEnded && endedAlert}

      {showForm && (
        <FormContainer
          initialValues={initialValues}
          validate={validate}
          onSubmit={handleSubmit}
          disabled={formIsDisabled && !authorizedUser?.isAdmin}
          showSubmitButton={!isTeacher || authorizedUser?.isAdmin}
          questions={questions}
          showCannotSubmitText={isOutsider}
          onOpenPrivacyDialog={handleOpenPrivacyDialog}
          isEdit={Boolean(feedback)}
        />
      )}

      {showToolbar && (
        <Box mt={2}>
          <Toolbar
            showEdit={isResponsibleTeacher}
            editLink={editLink}
            language={language}
            onLanguageChange={handleLanguageChange}
          />
        </Box>
      )}
    </>
  )
}

export default FeedbackView
