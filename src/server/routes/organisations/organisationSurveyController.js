const _ = require('lodash')
const { Router } = require('express')

const {
  initializeOrganisationCourseUnit,
  createOrganisationFeedbackTarget,
  createUserFeedbackTargets,
  getOrganisationSurvey,
  getSurveysForOrganisation,
  updateOrganisationSurvey,
  deleteOrganisationSurvey,
} = require('../../services/organisations/organisationSurveys')
const { ApplicationError } = require('../../util/customErrors')
const { getAccessAndOrganisation } = require('./util')

const getOrganisationSurveys = async (req, res) => {
  const { user } = req
  const { code } = req.params

  if (!user.isAdmin) throw new ApplicationError(403, 'Only for admins during development')

  const { organisation, hasReadAccess } = await getAccessAndOrganisation(user, code, {
    read: true,
  })

  if (!hasReadAccess) throw new ApplicationError(403, 'No read access to organisation')

  const surveys = await getSurveysForOrganisation(organisation.id)

  return res.send(surveys)
}

const createOrganisationSurvey = async (req, res) => {
  const { user } = req
  const { code } = req.params
  const { name, startDate, endDate, studentNumbers, teacherIds } = req.body

  if (!user.isAdmin) throw new ApplicationError(403, 'Only for admins during development')

  const { organisation, hasAdminAccess } = await getAccessAndOrganisation(user, code, {
    admin: true,
  })

  if (!hasAdminAccess) throw new ApplicationError(403, 'Only organisation admins can create organisation surveys')

  await initializeOrganisationCourseUnit(organisation)

  const feedbackTarget = await createOrganisationFeedbackTarget(organisation, { name, startDate, endDate })

  const userFeedbackTargets = await createUserFeedbackTargets(feedbackTarget, studentNumbers, teacherIds)

  const survey = await getOrganisationSurvey(feedbackTarget.id)

  return res.status(201).send({
    ...survey.dataValues,
    userFeedbackTargets,
  })
}

const editOrganisationSurvey = async (req, res) => {
  const { user, body } = req
  const { code, id } = req.params

  if (!user.isAdmin) throw new ApplicationError(403, 'Only for admins during development')

  const updates = _.pick(body, ['name', 'startDate', 'endDate', 'teacherIds'])

  const { hasAdminAccess } = await getAccessAndOrganisation(user, code, {
    admin: true,
  })

  if (!hasAdminAccess) throw new ApplicationError(403, 'Only organisation admins can update organisation surveys')

  const updatedSurvey = await updateOrganisationSurvey(id, updates)

  return res.send(updatedSurvey)
}

const removeOrganisationSurvey = async (req, res) => {
  const { user } = req
  const { code, id } = req.params

  if (!user.isAdmin) throw new ApplicationError(403, 'Only for admins during development')

  const { hasAdminAccess } = await getAccessAndOrganisation(user, code, {
    admin: true,
  })

  if (!hasAdminAccess) throw new ApplicationError(403, 'Only organisation admins can remove organisation surveys')

  await deleteOrganisationSurvey(id)

  return res.status(204).send()
}

const router = Router()

router.get('/:code/surveys', getOrganisationSurveys)
router.post('/:code/surveys', createOrganisationSurvey)
router.put('/:code/surveys/:id', editOrganisationSurvey)
router.delete('/:code/surveys/:id', removeOrganisationSurvey)

module.exports = router
