import React from 'react'

import {
  Card,
  CardContent,
  IconButton,
  makeStyles,
  Tooltip,
  Box,
  Chip,
  Divider,
  Button,
} from '@material-ui/core'

import DeleteIcon from '@material-ui/icons/Delete'
import UpIcon from '@material-ui/icons/KeyboardArrowUp'
import DownIcon from '@material-ui/icons/KeyboardArrowDown'
import { useField } from 'formik'
import { useTranslation } from 'react-i18next'

import LikertEditor from './LikertEditor'
import LikertPreview from './LikertPreview'
import OpenEditor from './OpenEditor'
import OpenPreview from './OpenPreview'
import ChoiceEditor from './ChoiceEditor'
import SingleChoicePreview from './SingleChoicePreview'
import MultipleChoicePreview from './MultipleChoicePreview'
import TextEditor from './TextEditor'
import TextPreview from './TextPreview'
import FormikSwitch from '../FormikSwitch'

const useStyles = makeStyles((theme) => ({
  actionsContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  actionsDivider: {
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
}))

const editorComponentByType = {
  LIKERT: LikertEditor,
  OPEN: OpenEditor,
  TEXT: TextEditor,
  MULTIPLE_CHOICE: ChoiceEditor,
  SINGLE_CHOICE: ChoiceEditor,
}

const previewComponentByType = {
  LIKERT: LikertPreview,
  OPEN: OpenPreview,
  TEXT: TextPreview,
  MULTIPLE_CHOICE: MultipleChoicePreview,
  SINGLE_CHOICE: SingleChoicePreview,
}

const getTitleByType = (type, t) => {
  const mapping = {
    LIKERT: t('questionEditor:likertQuestion'),
    OPEN: t('questionEditor:openQuestion'),
    TEXT: t('questionEditor:textualContent'),
    MULTIPLE_CHOICE: t('questionEditor:multipleChoiceQuestion'),
    SINGLE_CHOICE: t('questionEditor:singleChoiceQuestion'),
  }

  return mapping[type]
}

const EditActions = ({
  onMoveUp,
  onMoveDown,
  onRemove,
  moveUpDisabled,
  moveDownDisabled,
  name,
  language,
}) => {
  const { i18n } = useTranslation()
  const t = i18n.getFixedT(language)

  const handleRemove = () => {
    // eslint-disable-next-line no-alert
    const hasConfirmed = window.confirm(
      t('questionEditor:removeQuestionConfirmation'),
    )

    if (hasConfirmed) {
      onRemove()
    }
  }

  return (
    <>
      <FormikSwitch label={t('required')} name={`${name}.required`} />
      <Tooltip title={t('questionEditor:moveUp')}>
        <div>
          <IconButton disabled={moveUpDisabled} onClick={onMoveUp}>
            <UpIcon />
          </IconButton>
        </div>
      </Tooltip>

      <Tooltip title={t('questionEditor:moveDown')}>
        <div>
          <IconButton disabled={moveDownDisabled} onClick={onMoveDown}>
            <DownIcon />
          </IconButton>
        </div>
      </Tooltip>

      <Tooltip title={t('questionEditor:removeQuestion')}>
        <div>
          <IconButton onClick={handleRemove}>
            <DeleteIcon />
          </IconButton>
        </div>
      </Tooltip>
    </>
  )
}

const QuestionCard = ({
  name,
  onRemove,
  language,
  onMoveUp,
  onMoveDown,
  onCopy,
  className,
  isEditing = false,
  onStartEditing,
  onStopEditing,
  moveUpDisabled = false,
  moveDownDisabled = false,
  editable,
}) => {
  const { i18n } = useTranslation()
  const t = i18n.getFixedT(language)
  const classes = useStyles()
  const [field] = useField(name)
  const { value: question } = field

  const EditorComponent = editorComponentByType[question.type]
  const PreviewComponent = previewComponentByType[question.type]

  const title = getTitleByType(question.type, t)

  const questionIsEditable = question.editable ?? true

  return (
    <Card className={className}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Chip label={title} variant="outlined" />
          {question.chip && (
            <Tooltip
              className={classes.tooltip}
              arrow
              title={t('questionEditor:uneditableTooltip')}
            >
              <Chip
                label={t(question.chip)}
                variant="outlined"
                color="primary"
              />
            </Tooltip>
          )}
          {editable && questionIsEditable && (
            <div>
              {isEditing ? (
                <Button color="primary" onClick={onStopEditing}>
                  {t('questionEditor:done')}
                </Button>
              ) : (
                <>
                  <Button color="primary" onClick={onCopy}>
                    {t('questionEditor:duplicate')}
                  </Button>
                  <Button color="primary" onClick={onStartEditing}>
                    {t('edit')}
                  </Button>
                </>
              )}
            </div>
          )}
        </Box>

        {isEditing ? (
          <>
            <EditorComponent name={name} languages={['fi', 'sv', 'en']} />

            <Divider className={classes.actionsDivider} />

            <div className={classes.actionsContainer}>
              <EditActions
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onRemove={onRemove}
                moveUpDisabled={moveUpDisabled}
                moveDownDisabled={moveDownDisabled}
                name={name}
                language={language}
              />
            </div>
          </>
        ) : (
          <PreviewComponent question={question} language={language} />
        )}
      </CardContent>
    </Card>
  )
}

export default QuestionCard
