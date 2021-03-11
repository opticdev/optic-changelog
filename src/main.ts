import * as core from '@actions/core'
import * as github from '@actions/github'
// import {HttpClient} from '@actions/http-client'
import {
  Endpoints
  // RequestHeaders
  // IssuesListCommentsResponseData
} from '@octokit/types'

// type ListCommitPullsResponseData = Endpoints['GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls']['response']['data']
// type CreateIssueCommentResponseData = Endpoints['POST /repos/:owner/:repo/issues/:issue_number/comments']['response']['data']
// type GetRepoContent = Endpoints['GET /repos/{owner}/{repo}/contents/{path}']['response']['data']

async function run(): Promise<void> {
  try {
    // We allow for using `with` or `env`
    const repoToken =
      core.getInput('GITHUB_TOKEN') || process.env['GITHUB_TOKEN']

    if (!repoToken) {
      throw new Error(
        'Please provide a GitHub token. Set one with the repo-token input or GITHUB_TOKEN env variable.'
      )
    }

    const {
      payload: {repository},
      sha: commitSha
    } = github.context

    core.info(`Commit sha: ${commitSha}`)

    if (!repository) {
      core.info('Unable to determine repository')
      return
    }

    const {full_name: repoFullName} = repository
    const [owner, repo] = repoFullName!.split('/')

    const octokit = github.getOctokit(repoToken)

    const readme = await octokit.repos.getContent({
      owner,
      repo,
      path: 'README.md',
      ref: commitSha
    })

    core.info(readme.data.toString());
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function getChangelogData(): Promise<object> {
  // TODO: fake data for now, get from Spectacle later
  return Promise.resolve({
    data: {
      opticUrl: 'https://example.com',
      endpoints: [
        {
          change: {
            category: 'add'
          },
          path: '/foo',
          method: 'get'
        },
        {
          change: {
            category: 'update'
          },
          path: '/bar',
          method: 'post'
        }
      ]
    }
  })
}

function buildCommentMessage(changelogData: object): string {
  return 'Fake comment message'
}

;(async function () {
  await run()
})()
