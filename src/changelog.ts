// TODO: refactor to not rely on @actions/core
import * as core from '@actions/core'
import {Changelog} from './types'
import {setMetadata, isOpticComment, generateCommentBody} from './pr'

export async function runOpticChangelog({
  subscribers,
  opticSpecPath,
  gitHubRepo,
  headSha,
  baseSha,
  baseBranch,
  prNumber
}): Promise<void> {
  let headContent, baseContent

  // Could be moved or removed
  try {
    headContent = await gitHubRepo.getFileContent(headSha, opticSpecPath)
  } catch (error) {
    // Failing silently here
    // TODO: Throw instead of log and return
    core.info(
      `Could not find the Optic spec in the current branch. Looking in ${opticSpecPath}.`
    )
    return
  }

  // Could be moved or new Optic setup
  try {
    baseContent = await gitHubRepo.getFileContent(baseSha, opticSpecPath)
  } catch (error) {
    // Failing silently here
    // TODO: Throw instead of log and return
    core.info(
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
    // TODO: Throw instead of log and return
    core.info('No API changes in this PR.')
    return
  }

  try {
    // TODO: probably should be simplified a bit
    const existingBotComments = (
      await gitHubRepo.getPrBotComments(prNumber)
    ).filter(comment => isOpticComment(comment.body!))
    core.info(JSON.stringify(existingBotComments))
    if (existingBotComments.length > 0) {
      const comment = existingBotComments[0]
      // TODO: need to pull out metadata and combine with new (maybe)
      const body = setMetadata(comment.body, {})
      await gitHubRepo.updatePrComment(prNumber, comment.id, body)
    } else {
      const message = generateCommentBody(changes, subscribers)
      await gitHubRepo.createPrComment(prNumber, setMetadata(message, {}))
    }
  } catch (error) {
    // TODO: Throw instead of log and return
    core.setFailed(
      `There was an error creating a PR comment. Error message: ${error.message}`
    )
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
