export type Changelog = {
  data: {
    endpointChanges: {
      endpoints: {
        change: {
          category: string
        }
        contributions: {
          purpose?: string
        }
        pathId: string
        path: string
        method: string
      }[]
    }
  }
}

export type Endpoint = Changelog['data']['endpointChanges']['endpoints'][0]

export type JobInputs = {
  repoToken?: string
  subscribers: string[]
  opticSpecPath: string
  opticApiKey?: string
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
  getRepoInfo(): RepoInfo
  getPrBotComments(prNumber: number): Promise<PrComment[]>
}

export declare interface IJobRunner {
  debug(message: string): void
  info(message: string): void
  setFailed(message: string | Error): void
}
