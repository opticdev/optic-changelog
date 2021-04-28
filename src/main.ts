import * as core from '@actions/core'
import * as github from '@actions/github'
import {generateEndpointChanges} from '@useoptic/changelog'
import {runOpticChangelog} from './changelog'
import {getJobInputs, getRepoInfo, GitHubRepository} from './github'

async function run(): Promise<void> {
  try {
    const {repoToken, subscribers, opticSpecPath, opticApiKey} = getJobInputs()

    if (!repoToken) {
      throw new Error(
        'Please provide a GitHub token. Set one with the repo-token input or GITHUB_TOKEN env variable.'
      )
    }

    if(!opticApiKey){
      core.warning("No OPTIC_API_KEY provided, spec links won't get generated.")
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
      apiKey: opticApiKey,
      subscribers,
      opticSpecPath,
      gitProvider: gitHubRepo,
      headSha,
      baseBranch,
      baseSha,
      prNumber,
      jobRunner: core,
      generateEndpointChanges
    })
  } catch (error) {
    core.info(`Failed with unexpected error ${error.message}`)
    return
  }
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}
