const _ = require('lodash')
const { FeedbackTarget, User, Organisation, Survey, Question, CourseUnit } = require('../models')
const { UNIVERSITY_ROOT_ID } = require('../util/config')

const seedUsers = async users => {
  for (const user of users) {
    await User.findOrCreate({
      where: {
        id: user.id,
      },
      defaults: user,
    })
  }
}

const seedUniversity = async () => {
  const university = await Organisation.create(
    {
      id: UNIVERSITY_ROOT_ID,
      name: {
        fi: 'Testiyliopisto',
        en: 'Test university',
        sv: 'Testuniversitetet',
      },
      code: 'TEST_UNIVERSITY',
    },
    {
      hooks: false,
    }
  )

  const questionIds = await Promise.all(
    _.range(1, 6).map(async idx => {
      const q = await Question.create({
        type: 'LIKERT',
        required: true,
        data: {
          label: {
            fi: `Testikysymys ${idx}`,
            en: `Test question ${idx}`,
            sv: `Testfråga ${idx}`,
          },
        },
      })
      return q.id
    })
  )

  const survey = await Survey.create(
    {
      typeId: UNIVERSITY_ROOT_ID,
      type: 'university',
      questionIds,
    },
    {
      hooks: false,
    }
  )
}

const seedDb = async () => {
  // First reset all tables

  await FeedbackTarget.destroy({ where: {}, truncate: true, cascade: true })
  await User.destroy({ where: {}, truncate: true, cascade: true })
  await CourseUnit.destroy({ where: {}, truncate: true, cascade: true })
  await Organisation.destroy({ where: {}, truncate: true, cascade: true })

  // Create university & university survey
  await seedUniversity()
}

module.exports = {
  seedDb,
  seedUsers,
}
