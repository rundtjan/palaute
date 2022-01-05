const { Op } = require('sequelize')
const { addDays, subDays, format } = require('date-fns')
const _ = require('lodash')
const {
  FeedbackTarget,
  CourseRealisation,
  CourseUnit,
  Organisation,
  User,
  UserFeedbackTarget,
} = require('../models')

const {
  notificationAboutSurveyOpeningToStudents,
  emailReminderAboutSurveyOpeningToTeachers,
  emailReminderAboutFeedbackResponseToTeachers,
  sendEmail,
} = require('./pate')

const { ApplicationError } = require('./customErrors')
const { sequelize } = require('./dbConnection')

const getOpenFeedbackTargetsForStudents = async () => {
  const feedbackTargets = await FeedbackTarget.findAll({
    where: {
      opensAt: {
        [Op.gt]: subDays(new Date(), 3),
      },
      closesAt: {
        [Op.gt]: new Date(),
      },
      hidden: false,
      feedbackType: 'courseRealisation',
    },
    include: [
      {
        model: CourseRealisation,
        as: 'courseRealisation',
        required: true,
        where: {
          startDate: { [Op.gt]: new Date('August 1, 2021 00:00:00') },
        },
      },
      {
        model: CourseUnit,
        as: 'courseUnit',
        required: true,
        attributes: ['courseCode', 'name'],
        include: [
          {
            model: Organisation,
            as: 'organisations',
            required: true,
            attributes: ['disabledCourseCodes'],
          },
        ],
      },
      {
        model: User,
        as: 'users',
        required: true,
        attributes: ['id', 'username', 'email', 'language'],
        through: {
          where: {
            accessStatus: 'STUDENT',
          },
        },
      },
    ],
  })

  const filteredFeedbackTargets = feedbackTargets.filter((target) => {
    const disabledCourseCodes = target.courseUnit.organisations.flatMap(
      (org) => org.disabledCourseCodes,
    )

    if (!target.isOpen()) return false

    return !disabledCourseCodes.includes(target.courseUnit.courseCode)
  })

  return filteredFeedbackTargets
}

const getFeedbackTargetsAboutToOpenForTeachers = async () => {
  const feedbackTargets = await FeedbackTarget.findAll({
    where: {
      opensAt: {
        [Op.lt]: addDays(new Date(), 7),
        [Op.gt]: addDays(new Date(), 6),
      },
      feedbackOpeningReminderEmailSent: false,
      hidden: false,
      feedbackType: 'courseRealisation',
    },
    include: [
      {
        model: CourseRealisation,
        as: 'courseRealisation',
        required: true,
        where: {
          startDate: { [Op.gt]: new Date('August 1, 2021 00:00:00') },
        },
      },
      {
        model: CourseUnit,
        as: 'courseUnit',
        required: true,
        attributes: ['courseCode', 'name'],
        include: [
          {
            model: Organisation,
            as: 'organisations',
            required: true,
            attributes: ['disabledCourseCodes'],
          },
        ],
      },
      {
        model: User,
        as: 'users',
        required: true,
        attributes: ['id', 'username', 'email', 'language'],
        through: {
          where: {
            accessStatus: 'TEACHER',
          },
        },
      },
    ],
  })

  const filteredFeedbackTargets = feedbackTargets.filter((target) => {
    const disabledCourseCodes = target.courseUnit.organisations.flatMap(
      (org) => org.disabledCourseCodes,
    )
    return !disabledCourseCodes.includes(target.courseUnit.courseCode)
  })

  return filteredFeedbackTargets
}

const getFeedbackTargetOpeningImmediately = async (feedbackTargetId) => {
  const feedbackTarget = await FeedbackTarget.findAll({
    where: {
      id: feedbackTargetId,
      hidden: false,
      feedbackType: 'courseRealisation',
    },
    include: [
      {
        model: CourseRealisation,
        as: 'courseRealisation',
        required: true,
      },
      {
        model: CourseUnit,
        as: 'courseUnit',
        required: true,
        attributes: ['courseCode', 'name'],
        include: [
          {
            model: Organisation,
            as: 'organisations',
            required: true,
            attributes: ['disabledCourseCodes'],
          },
        ],
      },
      {
        model: User,
        as: 'users',
        required: true,
        attributes: ['id', 'username', 'email', 'language'],
      },
    ],
  })

  return feedbackTarget
}

const getFeedbackTargetsWithoutResponseForTeachers = async () => {
  const feedbackTargets = await FeedbackTarget.findAll({
    where: {
      closesAt: {
        [Op.lt]: new Date(),
        [Op.gt]: subDays(new Date(), 3),
      },
      hidden: false,
      feedbackType: 'courseRealisation',
      feedbackResponse: null,
      feedbackResponseReminderEmailSent: false,
    },
    include: [
      {
        model: CourseRealisation,
        as: 'courseRealisation',
        required: true,
        where: {
          startDate: { [Op.gt]: new Date('August 1, 2021 00:00:00') },
        },
      },
      {
        model: CourseUnit,
        as: 'courseUnit',
        required: true,
        attributes: ['courseCode', 'name'],
        include: [
          {
            model: Organisation,
            as: 'organisations',
            required: true,
            attributes: ['disabledCourseCodes'],
          },
        ],
      },
      {
        model: User,
        as: 'users',
        required: true,
        attributes: ['id', 'username', 'email', 'language'],
        through: {
          where: {
            accessStatus: 'TEACHER',
          },
        },
      },
    ],
  })

  const filteredFeedbackTargets = feedbackTargets.filter((target) => {
    const disabledCourseCodes = target.courseUnit.organisations.flatMap(
      (org) => org.disabledCourseCodes,
    )
    return !disabledCourseCodes.includes(target.courseUnit.courseCode)
  })

  return filteredFeedbackTargets
}

const getTeacherEmailCounts = async () => {
  const teacherEmailCounts = await sequelize.query(
    `SELECT f.opens_at, count(DISTINCT us.id) FROM feedback_targets f
        INNER JOIN user_feedback_targets u on u.feedback_target_id = f.id
        INNER JOIN course_realisations c on c.id = f.course_realisation_id
        INNER JOIN users us on us.id = u.user_id
        WHERE f.opens_at > :opensAtLow and f.opens_at < :opensAtHigh 
          AND u.access_status = 'TEACHER' 
          AND f.feedback_type = 'courseRealisation'
          AND f.feedback_opening_reminder_email_sent = false
          AND f.hidden = false
          AND c.start_date > '2021-8-1 00:00:00+00'
        GROUP BY f.opens_at`,
    {
      replacements: {
        opensAtLow: addDays(new Date(), 6),
        opensAtHigh: addDays(new Date(), 35),
      },
      type: sequelize.QueryTypes.SELECT,
    },
  )

  const groupedEmailCounts = _.groupBy(teacherEmailCounts, (obj) =>
    format(subDays(obj.opens_at, 7), 'dd.MM.yyyy'),
  )

  const finalEmailCounts = Object.keys(groupedEmailCounts).map((key) =>
    groupedEmailCounts[key].length > 1
      ? {
          date: key,
          count: groupedEmailCounts[key].reduce(
            (sum, obj) => sum + parseInt(obj.count, 10),
            0,
          ),
        }
      : { date: key, count: parseInt(groupedEmailCounts[key][0].count, 10) },
  )

  return finalEmailCounts
}

const getStudentEmailCounts = async () => {
  const studentEmailCounts = await sequelize.query(
    `SELECT f.opens_at, count(DISTINCT us.id) FROM feedback_targets f
        INNER JOIN user_feedback_targets u on u.feedback_target_id = f.id
        INNER JOIN course_realisations c on c.id = f.course_realisation_id
        INNER JOIN users us on us.id = u.user_id
        WHERE f.opens_at > :opensAtLow and f.opens_at < :opensAtHigh 
          AND u.access_status = 'STUDENT' 
          AND f.feedback_type = 'courseRealisation'
          AND f.feedback_open_notification_email_sent = false
          AND f.hidden = false
          AND c.start_date > '2021-8-1 00:00:00+00'
        GROUP BY f.opens_at`,
    {
      replacements: {
        opensAtLow: subDays(new Date(), 1),
        opensAtHigh: addDays(new Date(), 28),
      },
      type: sequelize.QueryTypes.SELECT,
    },
  )

  const groupedEmailCounts = _.groupBy(studentEmailCounts, (obj) =>
    format(obj.opens_at, 'dd.MM.yyyy'),
  )

  const finalEmailCounts = Object.keys(groupedEmailCounts).map((key) =>
    groupedEmailCounts[key].length > 1
      ? {
          date: key,
          count: groupedEmailCounts[key].reduce(
            (sum, obj) => sum + parseInt(obj.count, 10),
            0,
          ),
        }
      : { date: key, count: parseInt(groupedEmailCounts[key][0].count, 10) },
  )
  return finalEmailCounts
}

const aggregateFeedbackTargets = async (feedbackTargets) => {
  // Leo if you are reading this you are allowed to refactor :)
  /* eslint-disable */

  let emails = {}
  for (feedbackTarget of feedbackTargets) {
    for (user of feedbackTarget.users) {
      if (!user.email || user.UserFeedbackTarget.feedbackOpenEmailSent) continue
      emails[user.email]
        ? (emails[user.email] = emails[user.email].concat([
            {
              id: feedbackTarget.id,
              name: feedbackTarget.courseUnit.name,
              opensAt: feedbackTarget.opensAt,
              closesAt: feedbackTarget.closesAt,
              language: user.language,
              noAdUser: user.username === user.id,
              userId: user.id,
              username: user.username,
            },
          ]))
        : (emails[user.email] = [
            {
              id: feedbackTarget.id,
              name: feedbackTarget.courseUnit.name,
              opensAt: feedbackTarget.opensAt,
              closesAt: feedbackTarget.closesAt,
              language: user.language,
              noAdUser: user.username === user.id,
              userId: user.id,
              username: user.username,
            },
          ])
    }
  }
  /* eslint-enable */

  return emails
}

const createEmailsForSingleFeedbackTarget = async (feedbackTarget) => {
  const singleFbt = feedbackTarget[0]

  const students = singleFbt.users.filter(
    (user) => user.UserFeedbackTarget.accessStatus === 'STUDENT',
  )

  const emails = {}

  for (const user of students) {
    if (!user.email) {
      // eslint-disable-next-line
      continue
    }

    emails[user.email] = {
      id: singleFbt.id,
      name: singleFbt.courseUnit.name,
      opensAt: singleFbt.opensAt,
      closesAt: singleFbt.closesAt,
      language: user.language,
    }
  }

  return emails
}

const sendEmailAboutSurveyOpeningToStudents = async () => {
  const feedbackTargets = await getOpenFeedbackTargetsForStudents()

  const studentsWithFeedbackTargets = await aggregateFeedbackTargets(
    feedbackTargets,
  )

  const emailsToBeSent = Object.keys(studentsWithFeedbackTargets).map(
    (student) =>
      notificationAboutSurveyOpeningToStudents(
        student,
        studentsWithFeedbackTargets[student],
      ),
  )

  const rows = feedbackTargets.flatMap((target) =>
    target.users.map((user) => ({
      userId: user.UserFeedbackTarget.userId,
      feedbackTargetId: user.UserFeedbackTarget.feedbackTargetId,
    })),
  )

  for (const userFeedbackTarget of rows) {
    UserFeedbackTarget.update(
      {
        feedbackOpenEmailSent: true,
      },
      {
        where: {
          userId: {
            [Op.eq]: userFeedbackTarget.userId,
          },
          feedbackTargetId: {
            [Op.eq]: userFeedbackTarget.feedbackTargetId,
          },
        },
      },
    )
  }

  sendEmail(emailsToBeSent)

  return emailsToBeSent
}

const sendEmailReminderAboutSurveyOpeningToTeachers = async () => {
  const feedbackTargets = await getFeedbackTargetsAboutToOpenForTeachers()

  const teachersWithFeedbackTargets = await aggregateFeedbackTargets(
    feedbackTargets,
  )

  const emailsToBeSent = Object.keys(teachersWithFeedbackTargets).map(
    (teacher) =>
      emailReminderAboutSurveyOpeningToTeachers(
        teacher,
        teachersWithFeedbackTargets[teacher],
      ),
  )

  const rows = feedbackTargets.flatMap((target) =>
    target.users.map((user) => ({
      userId: user.UserFeedbackTarget.userId,
      feedbackTargetId: user.UserFeedbackTarget.feedbackTargetId,
    })),
  )

  for (const userFeedbackTarget of rows) {
    UserFeedbackTarget.update(
      {
        feedbackOpenEmailSent: true,
      },
      {
        where: {
          userId: {
            [Op.eq]: userFeedbackTarget.userId,
          },
          feedbackTargetId: {
            [Op.eq]: userFeedbackTarget.feedbackTargetId,
          },
        },
      },
    )
  }

  sendEmail(emailsToBeSent)

  return emailsToBeSent
}

const sendEmailReminderAboutFeedbackResponseToTeachers = async () => {
  const feedbackTargets = await getFeedbackTargetsWithoutResponseForTeachers()

  const teachersWithFeedbackTargets = await aggregateFeedbackTargets(
    feedbackTargets,
  )

  const emailsToBeSent = Object.keys(teachersWithFeedbackTargets).map(
    (teacher) =>
      emailReminderAboutFeedbackResponseToTeachers(
        teacher,
        teachersWithFeedbackTargets[teacher],
      ),
  )

  const ids = feedbackTargets.map((target) => target.id)

  FeedbackTarget.update(
    {
      feedbackResponseReminderEmailSent: true,
    },
    {
      where: {
        id: {
          [Op.in]: ids,
        },
      },
    },
  )

  sendEmail(emailsToBeSent)

  return emailsToBeSent
}

const returnEmailsToBeSentToday = async () => {
  const studentFeedbackTargets = await getOpenFeedbackTargetsForStudents()
  const teacherFeedbackTargets =
    await getFeedbackTargetsAboutToOpenForTeachers()
  const teacherReminderTargets =
    await getFeedbackTargetsWithoutResponseForTeachers()

  const teacherEmailCountFor7Days = await getTeacherEmailCounts()
  const studentEmailCountFor7Days = await getStudentEmailCounts()

  const studentsWithFeedbackTargets = await aggregateFeedbackTargets(
    studentFeedbackTargets,
  )

  const teachersWithFeedbackTargets = await aggregateFeedbackTargets(
    teacherFeedbackTargets,
  )

  const teacherRemindersWithFeedbackTargets = await aggregateFeedbackTargets(
    teacherReminderTargets,
  )

  const studentEmailsToBeSent = Object.keys(studentsWithFeedbackTargets).map(
    (student) =>
      notificationAboutSurveyOpeningToStudents(
        student,
        studentsWithFeedbackTargets[student],
      ),
  )

  const teacherSurveyReminderEmails = Object.keys(
    teachersWithFeedbackTargets,
  ).map((teacher) =>
    emailReminderAboutSurveyOpeningToTeachers(
      teacher,
      teachersWithFeedbackTargets[teacher],
    ),
  )

  const teacherFeedbackReminderEmails = Object.keys(
    teacherRemindersWithFeedbackTargets,
  ).map((teacher) =>
    emailReminderAboutFeedbackResponseToTeachers(
      teacher,
      teacherRemindersWithFeedbackTargets[teacher],
    ),
  )

  const teacherEmailsToBeSent = [
    ...teacherSurveyReminderEmails,
    ...teacherFeedbackReminderEmails,
  ]

  return {
    students: studentEmailsToBeSent,
    teachers: teacherEmailsToBeSent,
    teacherEmailCounts: teacherEmailCountFor7Days,
    studentEmailCounts: studentEmailCountFor7Days,
  }
}

const sendEmailToStudentsWhenOpeningImmediately = async (feedbackTargetId) => {
  const feedbackTarget = await getFeedbackTargetOpeningImmediately(
    feedbackTargetId,
  )

  if (!feedbackTarget.length)
    throw new ApplicationError(
      'Students already recieved a feedback open notification',
      400,
    )

  const studentsWithFeedbackTarget = await createEmailsForSingleFeedbackTarget(
    feedbackTarget,
  )

  const studentEmailsToBeSent = Object.keys(studentsWithFeedbackTarget).map(
    (student) =>
      notificationAboutSurveyOpeningToStudents(student, [
        studentsWithFeedbackTarget[student],
      ]),
  )

  FeedbackTarget.update(
    {
      feedbackOpeningReminderEmailSent: true,
      feedbackOpenNotificationEmailSent: true,
    },
    {
      where: {
        id: feedbackTargetId,
      },
    },
  )

  sendEmail(studentEmailsToBeSent)

  return studentEmailsToBeSent
}

module.exports = {
  sendEmailAboutSurveyOpeningToStudents,
  sendEmailReminderAboutSurveyOpeningToTeachers,
  sendEmailToStudentsWhenOpeningImmediately,
  sendEmailReminderAboutFeedbackResponseToTeachers,
  returnEmailsToBeSentToday,
}
