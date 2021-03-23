import * as core from '@actions/core'
import * as github from '@actions/github'
import {runOpticChangelog} from './changelog'
import {getJobInputs, getRepoInfo, GitHubRepository} from './github'

async function run(): Promise<void> {
  try {
    const {repoToken, subscribers, opticSpecPath} = getJobInputs()

    if (!repoToken) {
      throw new Error(
        'Please provide a GitHub token. Set one with the repo-token input or GITHUB_TOKEN env variable.'
      )
    }

    const octokit = github.getOctokit(repoToken)

    const {prNumber, owner, repo, headSha} = getRepoInfo()

    // We exit quietly when it's not a pull request
    if (!prNumber) {
      core.info('Not a pull request')
      return
    }

    const gitHubRepo = new GitHubRepository(octokit, owner, repo)
    const {baseSha, baseBranch} = await gitHubRepo.getPrInfo(prNumber)

    await runOpticChangelog({
      subscribers,
      opticSpecPath,
      gitHubRepo,
      headSha,
      baseBranch,
      baseSha,
      prNumber
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}
