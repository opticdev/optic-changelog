import {Changelog} from './types'
import {setMetadata, isOpticComment, generateCommentBody} from './pr'

export async function runOpticChangelog({
  subscribers,
  opticSpecPath,
  gitProvider,
  headSha,
  baseSha,
  baseBranch,
  prNumber,
  jobRunner
}): Promise<void> {
  let headContent: string, baseContent: string

  // This may fail if the file was moved or it's a new Optic setup
  try {
    headContent = await gitProvider.getFileContent(headSha, opticSpecPath)
  } catch (error) {
    // Failing silently here
    jobRunner.info(
      `Could not find the Optic spec in the current branch. Looking in ${opticSpecPath}.`
    )
    return
  }

  // This may fail if the file was moved or it's a new Optic setup
  try {
    baseContent = await gitProvider.getFileContent(baseSha, opticSpecPath)
  } catch (error) {
    // Failing silently here
    jobRunner.info(
      `Could not find the Optic spec in the base branch ${baseBranch}. Looking in ${opticSpecPath}.`
    )
    return
  }

  // TODO: use new changelog library here
  const changes = getChangelogData({
    from: JSON.parse(baseContent),
    to: JSON.parse(headContent)
  })

  if (changes.data.endpoints.length === 0) {
    jobRunner.info('No API changes in this PR.')
    return
  }

  const message = generateCommentBody(changes, subscribers)
  const body = setMetadata(message, {})

  jobRunner.debug('Created body for comment')
  jobRunner.debug(body)

  try {
    // TODO: probably should be simplified a bit
    const existingBotComments = (
      await gitProvider.getPrBotComments(prNumber)
    ).filter(comment => isOpticComment(comment.body!))

    if (existingBotComments.length) {
      const comment = existingBotComments[0]
      jobRunner.debug(`Updating comment ${comment.id}`)
      // TODO: need to pull out metadata and combine with new (maybe)
      await gitProvider.updatePrComment(comment.id, body)
    } else {
      jobRunner.debug(`Creating comment for PR ${prNumber}`)
      await gitProvider.createPrComment(prNumber, body)
    }
  } catch (error) {
    jobRunner.info(
      `There was an error creating or updating a PR comment. Error message: ${error.message}`
    )
    return
  }
}

// TODO: this is fake data for now
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getChangelogData(options: object): Changelog {
  return {
    data: {
      opticUrl: 'https://example.com',
      endpoints: [
        {
          change: {
            category: 'added'
          },
          path: '/foo',
          method: 'get'
        },
        {
          change: {
            category: 'updated'
          },
          path: '/bar',
          method: 'post'
        }
      ]
    }
  }
}
