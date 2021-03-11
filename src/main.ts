import * as core from '@actions/core'
import * as github from '@actions/github'
// import {HttpClient} from '@actions/http-client'
// import {
//   Endpoints,
// } from '@octokit/types'

// type ListCommitPullsResponseData = Endpoints['GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls']['response']['data']
// type CreateIssueCommentResponseData = Endpoints['POST /repos/:owner/:repo/issues/:issue_number/comments']['response']['data']
// type GetRepoContentResponseData = Endpoints['GET /repos/{owner}/{repo}/contents/{path}']['response']['data']['']
// type RepoContentResponse = Endpoints['GET /repos/{owner}/{repo}/contents/{path}']['response']

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

    const {full_name: repoFullName = ''} = repository
    const [owner, repo] = repoFullName.split('/')

    const octokit = github.getOctokit(repoToken)

    const readme = await octokit.repos.getContent({
      owner,
      repo,
      path: 'README.md',
      ref: commitSha
    })

    if (!('content' in readme.data)) {
      core.info('No file content')
      return
    }

    const buff = Buffer.from(readme.data.content, 'base64')
    const content = buff.toString('utf-8')

    core.info(content)
  } catch (error) {
    core.setFailed(error.message)
  }
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}
