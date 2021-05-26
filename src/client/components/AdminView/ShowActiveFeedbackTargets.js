import React from 'react'

import { Link } from 'react-router-dom'

import { lightFormat } from 'date-fns'

import { CircularProgress, makeStyles } from '@material-ui/core'

import useActiveFeedbackTargets from '../../hooks/useActiveFeedbackTargets'

const useStyles = makeStyles((theme) => ({
  heading: {
    marginBottom: theme.spacing(2),
  },
  progressContainer: {
    padding: theme.spacing(4, 0),
    display: 'flex',
    justifyContent: 'center',
  },
  languageTabs: {
    marginBottom: theme.spacing(2),
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0px 20px',
  },
}))

const formatDate = (date) => lightFormat(new Date(date), 'd.M.yyyy')

const ShowActiveFeedbackTargets = () => {
  const classes = useStyles()

  const { feedbackTargets, isLoading } = useActiveFeedbackTargets()

  if (isLoading) {
    return (
      <div className={classes.progressContainer}>
        <CircularProgress />
      </div>
    )
  }

  feedbackTargets.sort((a, b) =>
    a.courseUnit.courseCode < b.courseUnit.courseCode ? -1 : 1,
  )

  return (
    <>
      <h2>Feedbacks that are configured ({feedbackTargets.length} courses)</h2>
      {feedbackTargets.map((target) => (
        <div key={target.id} className={classes.row}>
          <div>
            <b>{target.courseUnit.courseCode}</b>
            {'\t'}
            <Link to={`/targets/${target.id}/results`}>
              {target.courseRealisation.name.fi}
            </Link>
            , {formatDate(target.opensAt)} - {formatDate(target.closesAt)}
          </div>
          <div>
            <b>{target.feedbackCount}</b> feedbacks given
          </div>
        </div>
      ))}
    </>
  )
}

export default ShowActiveFeedbackTargets
