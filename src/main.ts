import * as core from '@actions/core'
import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'
import {setMetadata, isOpticComment, generateCommentBody} from './pr'
import {getChangelogData} from './changelog'

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

type JobInputs = {
  repoToken?: string
  subscribers: string[]
  opticSpecPath: string
}

type RepoInfo = {
  owner: string
  repo: string
  prNumber?: number
  headSha: string
}

type PrComment = {
  id: number
  body: string
}

type PrInfo = {
  baseSha: string
  baseBranch: string
}

// interface IGitProvider {
//   getFileContent(sha: string, path: string): Promise<string>
//   getPrInfo(prNumber: number): Promise<PrInfo>
//   updatePrComment(
//     prNumber: number,
//     commentId: number,
//     body: string
//   ): Promise<void>
//   createPrComment(prNumber: number, body: string): Promise<void>
//   getPrBotComments(prNumber: number): Promise<PrComment[]>
// }

function getJobInputs(): JobInputs {
  const repoToken =
    core.getInput('GITHUB_TOKEN')! || process.env['GITHUB_TOKEN']!

  const subscribers = core
    .getInput('subscribers')
    .split(',')
    .map(subscriber => subscriber.trim())

  const opticSpecPath = core.getInput('OPTIC_SPEC_PATH')

  return {repoToken, subscribers, opticSpecPath}
}

function getRepoInfo(): RepoInfo {
  const {
    payload: {repository, pull_request: pullRequest},
    sha: headSha
  } = github.context
  const {full_name: repoFullName = ''} = repository!
  const [owner, repo] = repoFullName.split('/')

  return {
    prNumber: pullRequest?.number,
    owner,
    repo,
    headSha
  }
}

async function runOpticChangelog({
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
    core.info('No API changes in this PR.')
    return
  }

  try {
    const existingBotComments = await gitHubRepo.getPrBotComments(prNumber)
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
    core.setFailed(
      `There was an error creating a PR comment. Error message: ${error.message}`
    )
  }
}

class GitHubRepository {
  constructor(
    private octokit: InstanceType<typeof GitHub>,
    private owner: string,
    private repo: string
  ) {}

  async getFileContent(sha: string, path: string): Promise<string> {
    const response = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
      ref: sha
    })
    if (!('content' in response.data)) {
      return ''
    }

    const buff = Buffer.from(response.data.content, 'base64')
    return buff.toString('utf-8')
  }

  async getPrInfo(prNumber: number): Promise<PrInfo> {
    const prInfo = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    })
    return {
      baseSha: prInfo.data.base.sha,
      baseBranch: prInfo.data.base.ref
    }
  }

  async updatePrComment(
    prNumber: number,
    commentId: number,
    body: string
  ): Promise<void> {
    await this.octokit.issues.updateComment({
      owner: this.owner,
      repo: this.repo,
      comment_id: commentId,
      body
    })
  }

  async createPrComment(prNumber: number, body: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body
    })
  }

  async getPrBotComments(prNumber: number): Promise<PrComment[]> {
    const issueComments = await this.octokit.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber
    })
    const existingBotComments = issueComments.data
      .filter(comment => comment.user?.login === 'github-actions[bot]')
      .filter(comment => isOpticComment(comment.body!))
    return existingBotComments.map(comment => ({
      id: comment.id,
      body: comment.body!
    }))
  }
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}
