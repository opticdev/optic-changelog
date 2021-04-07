export type Changelog = {
  data: {
    endpoints: {
      change: {
        category: string
      }
      path: string
      method: string
    }[]
  }
}

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

export declare interface IGitProvider {
  getFileContent(sha: string, path: string): Promise<string>
  getPrInfo(prNumber: number): Promise<PrInfo>
  updatePrComment(commentId: number, body: string): Promise<void>
  createPrComment(prNumber: number, body: string): Promise<void>
  getPrBotComments(prNumber: number): Promise<PrComment[]>
}

export declare interface IJobRunner {
  debug(message: string): void
  info(message: string): void
  setFailed(message: string | Error): void
}
