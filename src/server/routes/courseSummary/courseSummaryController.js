const { Router } = require('express')
const { QueryTypes } = require('sequelize')
const { addYears } = require('date-fns')

const { CourseUnit, Organisation } = require('../../models')

const {
  getOrganisationSummaries,
  getCourseRealisationSummaries,
} = require('../../services/summary')

const { ApplicationError } = require('../../util/customErrors')
const { sequelize } = require('../../util/dbConnection')
const logger = require('../../util/logger')
const { getSummaryQuestions } = require('../../services/questions')
const getSummaryDefaultDateRange = require('../../services/summary/summaryDefaultDateRange')

const INCLUDED_ORGANISATIONS_BY_USER_ID = {
  // Jussi Merenmies
  'hy-hlo-1548120': ['300-M001'],
}

const filterOrganisationAccess = (organisationAccess, user) => {
  const includedOrganisationCodes = INCLUDED_ORGANISATIONS_BY_USER_ID[user.id]

  if (!includedOrganisationCodes) {
    return organisationAccess
  }

  return organisationAccess.filter(({ organisation }) =>
    includedOrganisationCodes.includes(organisation.code),
  )
}

const getAccessibleCourseRealisationIds = async (user) => {
  const rows = await sequelize.query(
    `
    SELECT DISTINCT ON (course_realisations.id) course_realisations.id
    FROM user_feedback_targets
    INNER JOIN feedback_targets ON user_feedback_targets.feedback_target_id = feedback_targets.id
    INNER JOIN course_realisations ON feedback_targets.course_realisation_id = course_realisations.id
    WHERE user_feedback_targets.user_id = :userId
    AND user_feedback_targets.access_status = 'TEACHER'
    AND feedback_targets.feedback_type = 'courseRealisation'
    AND course_realisations.start_date < NOW()
    AND course_realisations.start_date > NOW() - interval '12 months';
  `,
    {
      replacements: {
        userId: user.id,
      },
      type: sequelize.QueryTypes.SELECT,
    },
  )

  return rows.map((row) => row.id)
}

const getAccessInfo = async (req, res) => {
  const { user } = req

  const [organisationAccess, accessibleCourseRealisationIds] =
    await Promise.all([
      user.getOrganisationAccess(),
      getAccessibleCourseRealisationIds(user),
    ])

  const adminAccess = !!organisationAccess.find((org) => org.access.admin)

  const accessible =
    organisationAccess.length > 0 || accessibleCourseRealisationIds.length > 0

  const defaultDateRange = accessible
    ? await getSummaryDefaultDateRange({
        user,
        organisationAccess,
      })
    : null

  // For grafana statistics
  if (organisationAccess.length === 1) {
    const { name, code } = organisationAccess[0].organisation.dataValues
    logger.info('Organisation access', {
      organisationName: name.fi,
      organisationCode: code,
    })
  }

  return res.send({
    accessible,
    adminAccess,
    defaultDateRange,
  })
}

const getOrganisations = async (req, res) => {
  const { user } = req
  const { code } = req.params
  const { includeOpenUniCourseUnits, startDate, endDate } = req.query

  const [fullOrganisationAccess, accessibleCourseRealisationIds, questions] =
    await Promise.all([
      user.getOrganisationAccess(),
      getAccessibleCourseRealisationIds(user),
      getSummaryQuestions(code),
    ])

  const organisationAccess = code
    ? fullOrganisationAccess.filter((org) => org.organisation.code === code)
    : fullOrganisationAccess

  if (
    organisationAccess.length === 0 &&
    accessibleCourseRealisationIds.length === 0
  ) {
    throw new ApplicationError('Forbidden', 403)
  }

  const parsedStartDate = startDate ? new Date(startDate) : null
  const defaultEndDate = parsedStartDate ? addYears(parsedStartDate, 1) : null
  const parsedEndDate = endDate ? new Date(endDate) : defaultEndDate

  const organisations = await getOrganisationSummaries({
    questions,
    organisationAccess: filterOrganisationAccess(organisationAccess, user),
    accessibleCourseRealisationIds,
    includeOpenUniCourseUnits: includeOpenUniCourseUnits !== 'false',
    startDate: parsedStartDate,
    endDate: parsedEndDate,
  })

  return res.send({
    questions,
    organisations,
  })
}

const getByCourseUnit = async (req, res) => {
  const { user } = req

  const { code } = req.params

  const courseUnits = await CourseUnit.findAll({
    where: { courseCode: code },
    include: [
      {
        model: Organisation,
        attributes: ['id'],
        as: 'organisations',
      },
    ],
    order: [['updated_at', 'DESC']],
  })

  if (!courseUnits?.length > 0) {
    throw new ApplicationError('Course unit is not found', 404)
  }

  const organisationAccess = await user.getOrganisationAccessByCourseUnitId(
    courseUnits[0].id,
  )

  if (!organisationAccess?.read && !user.isAdmin) {
    const hasSomeCourseRealisationAccess = (
      await sequelize.query(
        `
      SELECT COUNT(*) > 0 as "hasAccess"
      FROM
        user_feedback_targets, feedback_targets
      WHERE
        feedback_targets.course_unit_id IN (:courseUnitIds)
        AND user_feedback_targets.user_id = :userId
        AND user_feedback_targets.feedback_target_id = feedback_targets.id
        AND user_feedback_targets.access_status = 'TEACHER';
    `,
        {
          type: QueryTypes.SELECT,
          replacements: {
            userId: user.id,
            courseUnitIds: courseUnits.map((cu) => cu.id),
          },
        },
      )
    )[0]?.hasAccess

    if (!hasSomeCourseRealisationAccess) {
      throw new ApplicationError('Forbidden', 403)
    }
  }

  const questions = await getSummaryQuestions()
  const courseRealisations = await getCourseRealisationSummaries({
    courseCode: code,
    questions,
  })

  return res.send({
    questions,
    courseRealisations,
    courseUnit: courseUnits[0],
  })
}

const router = Router()

router.get('/organisations', getOrganisations)
router.get('/organisations/:code', getOrganisations)
router.get('/course-units/:code', getByCourseUnit)
router.get('/access', getAccessInfo)

module.exports = router
