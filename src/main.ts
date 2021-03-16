import * as core from '@actions/core'
import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'
import {setMetadata, isOpticComment} from './pr'

async function run(): Promise<void> {
  try {
    // We allow for using `with` or `env`
    const repoToken =
      core.getInput('GITHUB_TOKEN') || process.env['GITHUB_TOKEN']

    const subscribers = core
      .getInput('subscribers')
      .split(',')
      .map(subscriber => subscriber.trim())

    const opticSpecPath = core.getInput('OPTIC_SPEC_PATH')

    if (!repoToken) {
      throw new Error(
        'Please provide a GitHub token. Set one with the repo-token input or GITHUB_TOKEN env variable.'
      )
    }

    const {
      payload: {repository, pull_request: pullRequest},
      sha: headSha
    } = github.context

    // We exit quietly because we can't determine any info about the job
    if (!repository) {
      core.info('Unable to determine repository')
      return
    }

    // We exit quietly when it's not a pull request
    if (!pullRequest) {
      core.info('Not a pull request')
      return
    }

    const octokit = github.getOctokit(repoToken)

    const {full_name: repoFullName = ''} = repository
    const [owner, repo] = repoFullName.split('/')

    // We need this to get head and base SHAs
    const prInfo = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullRequest.number
    })

    // Head SHA comes from job context
    // Base SHA comes from the PR
    const baseSha = prInfo.data.base.sha

    // TODO: Handle file not found
    const headContent = await getSpecificationContent(octokit, {
      owner,
      repo,
      ref: headSha,
      path: opticSpecPath
    })

    // TODO: Handle file not found
    const baseContent = await getSpecificationContent(octokit, {
      owner,
      repo,
      ref: baseSha,
      path: opticSpecPath
    })

    const headBatchId = getLatestBatchId(headContent)
    const baseBatchId = getLatestBatchId(baseContent)

    // TODO: if the IDs match, this should return

    const changes = getChangelogData({
      from: baseBatchId,
      to: headBatchId,
      spec: headContent
    })

    const message = createPrMessage(changes, subscribers)

    const issueComments = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: pullRequest.number
    })

    const botComments = issueComments.data
      .filter(comment => comment.user?.login === 'github-actions[bot]')
      .filter(comment => isOpticComment(comment.body!))

    if (botComments.length > 0) {
      const comment = botComments[0]
      // TODO: need to pull out metadata and combine with new (maybe)
      const body = setMetadata(message, {})
      await octokit.issues.updateComment({
        owner,
        repo,
        comment_id: comment.id,
        body
      })
    } else {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: pullRequest.number,
        body: setMetadata(message, {})
      })
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function getSpecificationContent(
  octokit: InstanceType<typeof GitHub>,
  {
    owner,
    repo,
    path,
    ref
  }: {owner: string; repo: string; path: string; ref: string}
): Promise<object[]> {
  const response = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref
  })

  if (!('content' in response.data)) {
    return []
  }

  const buff = Buffer.from(response.data.content, 'base64')
  const content = buff.toString('utf-8')
  return JSON.parse(content)
}

// TODO: using any for now
function getLatestBatchId(specContent: any[]): string {
  let batchId = 'none'

  for (const row of specContent) {
    if ('BatchCommitEnded' in row) {
      batchId = row.BatchCommitEnded.batchId
    }
  }

  return batchId
}

type Changelog = {
  data: {
    opticUrl: string
    endpoints: {
      change: {
        category: string
      }
      path: string
      method: string
    }[]
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getChangelogData(options: object): Changelog {
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

function createPrMessage(changes: Changelog, subscribers: string[]): string {
  const results = {
    added: 0,
    updated: 0,
    removed: 0
  }

  for (const endpoint of changes.data.endpoints) {
    switch (endpoint.change.category) {
      case 'added':
        results.added++
        break
      case 'updated':
        results.updated++
        break
      case 'removed':
        results.removed++
        break
    }
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/T/, ' ')
    .replace(/\..+/, '')

  const subscriberText = subscribers
    .map(subscriber => `@${subscriber}`)
    .join(', ')

  return `## Optic Changelog
  
* Endpoints added: ${results.added}
* Endpoints updated: ${results.updated}
* Endpoints removed: ${results.removed}

Last updated: ${timestamp}

[View documentation](${changes.data.opticUrl})

---

Pinging subscribers ${subscriberText}`
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}
