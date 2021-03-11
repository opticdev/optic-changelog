import * as core from '@actions/core'
import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'

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

    const octokit = github.getOctokit(repoToken)

    const {full_name: repoFullName = ''} = repository
    const [owner, repo] = repoFullName.split('/')

    const content = await getSpecificationContent(octokit, {
      owner,
      repo,
      ref: commitSha
    })

    core.info(JSON.stringify(content, null, 4))
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function getSpecificationContent(
  octokit: InstanceType<typeof GitHub>,
  {
    owner,
    repo,
    path = '.optic/api/specification.json1',
    ref
  }: {owner: string; repo: string; path?: string; ref: string}
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

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}
