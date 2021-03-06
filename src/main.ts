import * as core from '@actions/core'
import * as github from '@actions/github'
import {generateEndpointChanges} from '@useoptic/changelog'
import {runOpticChangelog} from './changelog'
import {getJobInputs, getRepoInfo, GitHubRepository} from './github'
import * as Sentry from '@sentry/node'
import {SENTRY_DSN} from './constants'
import {sentryInstrument} from './utils'

//https://github.com/getsentry/sentry-javascript/blob/master/packages/node/src/sdk.ts#L95
// Otherwise Sentry reports the release as the git commit sha of the user's repo, which is _not_ what we want
Sentry.init({dsn: SENTRY_DSN, tracesSampleRate: 1.0, release: null as any})

async function run(): Promise<void> {
  try {
    sentryInstrument({op: 'main'}, async transaction => {
      const {
        repoToken,
        subscribers,
        opticSpecPath,
        opticApiKey
      } = getJobInputs()

      if (!repoToken) {
        throw new Error(
          'Please provide a GitHub token. Set one with the repo-token input or GITHUB_TOKEN env variable.'
        )
      }

      if (!opticApiKey) {
        core.warning(
          "No OPTIC_API_KEY provided, spec links won't get generated."
        )
      }

      const octokit = github.getOctokit(repoToken)

      const {prNumber, owner, repo, headSha} = getRepoInfo()

      for (const [k, v] of Object.entries({prNumber, owner, repo, headSha})) {
        transaction.setTag(k, v)
      }

      // We exit quietly when it's not a pull request
      if (!prNumber) {
        core.info('Not a pull request')
        return
      }

      const gitHubRepo = new GitHubRepository(octokit, owner, repo)
      const {baseSha, baseBranch} = await gitHubRepo.getPrInfo(prNumber)

      transaction.setTag('baseSha', baseSha)
      transaction.setTag('baseBranch', baseBranch)

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
