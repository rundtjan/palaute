/* eslint-disable camelcase */
const {
  Op,
  DATE,
  ENUM,
  STRING,
  Model,
  JSONB,
  BOOLEAN,
  VIRTUAL,
  ARRAY,
  INTEGER,
  TEXT,
} = require('sequelize')

const _ = require('lodash')

const Organisation = require('./organisation')
const CourseRealisation = require('./courseRealisation')
const User = require('./user')
const UserFeedbackTarget = require('./userFeedbackTarget')
const { sequelize } = require('../util/dbConnection')
const {
  getUniversitySurvey,
  getProgrammeSurveysByCourseUnit,
  getOrCreateTeacherSurvey,
} = require('../services/surveys')

class FeedbackTarget extends Model {
  async getSurveys() {
    const [programmeSurveys, teacherSurvey, universitySurvey] =
      await Promise.all([
        getProgrammeSurveysByCourseUnit(this.courseUnitId),
        getOrCreateTeacherSurvey(this),
        getUniversitySurvey(),
      ])

    return {
      programmeSurveys,
      teacherSurvey,
      universitySurvey,
    }
  }

  isOpen() {
    if (!this.opensAt || !this.closesAt) {
      return true
    }

    const now = new Date()

    return this.opensAt <= now && this.closesAt >= now
  }

  isEnded() {
    if (!this.closesAt) {
      return true
    }

    const now = new Date()

    return now > this.closesAt
  }

  async getStudentsForFeedbackTarget() {
    return User.findAll({
      include: {
        model: UserFeedbackTarget,
        as: 'userFeedbackTargets',
        required: true,
        include: [
          {
            model: FeedbackTarget,
            as: 'feedbackTarget',
            where: {
              id: this.id,
            },
            required: true,
          },
        ],
        where: {
          accessStatus: 'STUDENT',
        },
      },
    })
  }

  async getStudentsWhoHaveNotGivenFeedback() {
    return User.findAll({
      include: {
        model: UserFeedbackTarget,
        as: 'userFeedbackTargets',
        required: true,
        include: [
          {
            model: FeedbackTarget,
            as: 'feedbackTarget',
            where: {
              id: this.id,
            },
            required: true,
          },
        ],
        where: {
          accessStatus: 'STUDENT',
          feedbackId: {
            [Op.is]: null,
          },
        },
      },
    })
  }

  getPublicQuestionIds(surveys) {
    const targetPublicQuestionIds = this.publicQuestionIds ?? []

    const globallyPublicQuestionIds = surveys.universitySurvey.publicQuestionIds
    const programmePublicQuestionIds = surveys.programmeSurveys.flatMap(
      (s) => s.publicQuestionIds,
    )

    const publicQuestionIds = _.uniq([
      ...programmePublicQuestionIds,
      ...targetPublicQuestionIds,
      ...globallyPublicQuestionIds,
    ])

    return publicQuestionIds
  }

  getPublicityConfigurableQuestionIds(surveys) {
    this.populateQuestions(surveys)

    const globallyPublicQuestionIds = surveys.universitySurvey.publicQuestionIds
    const programmePublicQuestionIds = surveys.programmeSurveys.flatMap(
      (s) => s.publicQuestionIds,
    )

    const questionIds = this.questions
      .filter(
        ({ id }) =>
          !globallyPublicQuestionIds?.includes(id) &&
          !programmePublicQuestionIds?.includes(id),
      )
      .map(({ id }) => id)

    return questionIds
  }

  populateQuestions(surveys) {
    const programmeSurveyQuestions = surveys.programmeSurveys
      ? surveys.programmeSurveys.reduce(
          (questions, survey) => questions.concat(survey.questions),
          [],
        )
      : null

    const questions = [
      ...(surveys.universitySurvey?.questions ?? []),
      ...(programmeSurveyQuestions ?? []),
      ...(surveys.teacherSurvey?.questions ?? []),
    ]

    this.set('questions', questions)
  }

  populateSurveys(surveys) {
    this.set('surveys', surveys)
    this.populateQuestions(surveys)
  }

  async getPublicFeedbacks(
    feedbacks,
    { accessStatus, isAdmin, userOrganisationAccess } = {},
  ) {
    const publicFeedbacks = feedbacks.map((f) => f.toPublicObject())
    const isTeacher =
      accessStatus === 'RESPONSIBLE_TEACHER' || accessStatus === 'TEACHER'

    const isOrganisationAdmin = Boolean(userOrganisationAccess?.admin)

    if (isAdmin || isOrganisationAdmin || isTeacher) {
      return publicFeedbacks
    }

    const surveys = await this.getSurveys()
    const publicQuestionIds = this.getPublicQuestionIds(surveys)

    const censoredFeedbacks = publicFeedbacks.map((feedback) => ({
      ...feedback,
      data: feedback.data.filter(
        (answer) =>
          !answer.hidden && publicQuestionIds.includes(answer.questionId),
      ),
    }))

    return censoredFeedbacks
  }

  async toPublicObject() {
    const surveys = await this.getSurveys()
    const publicQuestionIds = this.getPublicQuestionIds(surveys)
    const publicityConfigurableQuestionIds =
      this.getPublicityConfigurableQuestionIds(surveys)

    const feedbackTarget = {
      ...this.toJSON(),
      surveys,
      publicQuestionIds,
      publicityConfigurableQuestionIds,
    }

    return feedbackTarget
  }

  async isDisabled() {
    const courseUnit = await this.getCourseUnit({
      include: [{ model: Organisation, as: 'organisations', required: true }],
    })

    const { organisations } = courseUnit

    return organisations.some(({ disabledCourseCodes }) =>
      disabledCourseCodes.includes(courseUnit.courseCode),
    )
  }

  async feedbackCanBeGiven() {
    if (!this.isOpen() || this.hidden) {
      return false
    }

    const disabled = await this.isDisabled()

    return !disabled
  }

  /**
   * Gets the previous feedback target that has at least one same teacher
   * @returns {Promise<FeedbackTarget?>} its previous feedback target
   */
  async getPrevious() {
    const courseRealisation = CourseRealisation.findByPk(
      this.courseRealisationId,
      { attributes: ['startDate'] },
    )

    const currentTeachers = UserFeedbackTarget.findAll({
      attributes: ['userId'],
      where: {
        feedbackTargetId: this.id,
        accessStatus: { [Op.in]: ['RESPONSIBLE_TEACHER', 'TEACHER'] },
      },
    })
    /* eslint-disable-next-line no-use-before-define */
    const allPreviousFeedbackTargets = await FeedbackTarget.findAll({
      where: {
        courseUnitId: this.courseUnitId,
        feedbackType: this.feedbackType,
        hidden: false,
      },
      include: [
        {
          model: CourseRealisation,
          as: 'courseRealisation',
          where: {
            startDate: {
              [Op.lt]: (await courseRealisation).startDate,
            },
          },
        },
        {
          model: UserFeedbackTarget,
          as: 'userFeedbackTargets',
          attributes: ['userId'],
          where: {
            accessStatus: { [Op.in]: ['RESPONSIBLE_TEACHER', 'TEACHER'] },
          },
        },
      ],
      order: [
        [
          { model: CourseRealisation, as: 'courseRealisation' },
          'startDate',
          'DESC',
        ],
      ],
    })

    const currentTeacherIds = (await currentTeachers).map(
      ({ userId }) => userId,
    )

    const previousTargetsWithSameTeacher = allPreviousFeedbackTargets.filter(
      (fbt) =>
        fbt.userFeedbackTargets.some((ufbt) =>
          currentTeacherIds.includes(ufbt.userId),
        ),
    )

    if (previousTargetsWithSameTeacher.length < 1) {
      return null
    }

    return previousTargetsWithSameTeacher[0]
  }
}

FeedbackTarget.init(
  {
    feedbackType: {
      type: ENUM,
      values: ['courseRealisation', 'assessmentItem', 'studySubGroup'],
      allowNull: false,
      unique: 'source',
    },
    typeId: {
      type: STRING,
      allowNull: false,
      unique: 'source',
    },
    courseUnitId: {
      type: STRING,
      allowNull: false,
    },
    courseRealisationId: {
      type: STRING,
      allowNull: false,
    },
    name: {
      type: JSONB,
      allowNull: false,
    },
    hidden: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    feedbackCount: {
      type: INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    opensAt: {
      type: DATE,
    },
    closesAt: {
      type: DATE,
    },
    // potentially cached
    surveys: {
      type: VIRTUAL,
    },
    // potentially cached
    questions: {
      type: VIRTUAL,
    },
    // potentially cached
    responsibleTeachers: {
      type: VIRTUAL,
    },
    // potentially cached
    teachers: {
      type: VIRTUAL,
    },
    studentCount: {
      type: VIRTUAL,
      get() {
        return this.dataValues.studentCount
          ? Number(this.dataValues.studentCount)
          : 0
      },
    },
    publicQuestionIds: {
      type: ARRAY(INTEGER),
      allowNull: false,
      defaultValue: [],
    },
    feedbackResponse: {
      type: TEXT,
    },
    feedbackResponseEmailSent: {
      type: BOOLEAN,
    },
    feedbackOpeningReminderEmailSent: {
      type: BOOLEAN,
    },
    feedbackResponseReminderEmailSent: {
      type: BOOLEAN,
    },
    feedbackReminderLastSentAt: {
      type: DATE,
      defaultValue: null,
      allowNull: true,
    },
    feedbackVisibility: {
      type: TEXT,
      defaultValue: 'ENROLLED',
    },
    feedbackDatesEditedByTeacher: {
      type: BOOLEAN,
    },
    settingsReadByTeacher: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    continuousFeedbackEnabled: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sendContinuousFeedbackDigestEmail: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    underscored: true,
    sequelize,
  },
)

module.exports = FeedbackTarget
