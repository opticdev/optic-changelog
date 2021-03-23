import * as core from '@actions/core'
import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'

export type JobInputs = {
  repoToken?: string
  subscribers: string[]
  opticSpecPath: string
}

export type RepoInfo = {
  owner: string
  repo: string
  prNumber?: number
  headSha: string
}

export type PrComment = {
  id: number
  body: string
}

export type PrInfo = {
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

export function getJobInputs(): JobInputs {
  const repoToken =
    core.getInput('GITHUB_TOKEN')! || process.env['GITHUB_TOKEN']!

  const subscribers = core
    .getInput('subscribers')
    .split(',')
    .map(subscriber => subscriber.trim())

  const opticSpecPath = core.getInput('OPTIC_SPEC_PATH')

  return {repoToken, subscribers, opticSpecPath}
}

export function getRepoInfo(): RepoInfo {
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

export class GitHubRepository {
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
    const existingBotComments = issueComments.data.filter(
      comment => comment.user?.login === 'github-actions[bot]'
    )
    return existingBotComments.map(comment => ({
      id: comment.id,
      body: comment.body!
    }))
  }
}
