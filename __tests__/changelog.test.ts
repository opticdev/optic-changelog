import * as fs from 'fs'
import * as path from 'path'
import {generateEndpointChanges} from '@useoptic/changelog'
import {ChangelogParams, runOpticChangelog} from '../src/changelog'
import {IGitProvider} from '../src/types'

const BASE_SHA = 'base-sha'
const HEAD_SHA = 'head-sha'
const NEXT_SHA = 'next-sha'

const pathMap = {
  [BASE_SHA]: 'specs/add-method/initial.json',
  [HEAD_SHA]: 'specs/add-method/current.json',
  [NEXT_SHA]: 'specs/add-method/next.json'
}

const baseGitProvider: IGitProvider = {
  getFileContent: async (sha: string) => {
    return fs.readFileSync(path.join(__dirname, pathMap[sha])).toString()
  },
  getPrBotComments: async () => [],
  updatePrComment: jest.fn(),
  createPrComment: jest.fn(),
  getPrInfo: jest.fn(),
  getRepoInfo: jest.fn()
}

const mockJobRunner = {
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  setFailed: jest.fn(),
  exportVariable: jest.fn()
}

const baseOpticChangelog: ChangelogParams = {
  apiKey: 'pizza',
  subscribers: [],
  opticSpecPath: '.optic/api/specification.yml',
  gitProvider: baseGitProvider,
  headSha: HEAD_SHA,
  baseSha: BASE_SHA,
  baseBranch: 'main',
  prNumber: 100,
  jobRunner: mockJobRunner,
  generateEndpointChanges,
  uploadSpec: jest
    .fn()
    .mockResolvedValue({specId: 'spec-id', personId: 'person-id'})
}

describe('Changelog', () => {
  beforeAll(() => {
    Date.prototype.toISOString = jest.fn(() => '2021-04-21T15:06:33.601Z')
  })

  it('creates a comment', async () => {
    await runOpticChangelog(baseOpticChangelog)
    expectCommentWasCreated()
    expect(mockJobRunner.exportVariable).toBeCalledTimes(1)
  })

  it("doesn't create a comment when new commits don't change the spec", async () => {
    await runOpticChangelog(baseOpticChangelog)
    expectCommentWasCreated()

    await runOpticChangelog({
      ...baseOpticChangelog,
      baseSha: HEAD_SHA
    })

    expectCommentWasCreated()
  })

  it.skip('creates a new comment when new commits change the spec', async () => {
    await runOpticChangelog(baseOpticChangelog)
    expectCommentWasCreated()

    await runOpticChangelog({
      ...baseOpticChangelog,
      baseSha: HEAD_SHA,
      headSha: NEXT_SHA
    })

    expect(baseGitProvider.createPrComment).toBeCalledTimes(2)
    expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
    expect(mockJobRunner.setFailed).toBeCalledTimes(0)
    expect(mockJobRunner.debug.mock.calls).toMatchSnapshot()
  })

  // TODO: resolve issue with next.json
  it('includes purpose on comment', async () => {
    const gitProvider = {
      ...baseGitProvider,
      getFileContent: jest.fn().mockImplementation((sha, path) => {
        if (sha === baseOpticChangelog.baseSha) throw Error()
        return baseGitProvider.getFileContent(sha, path)
      })
    }

    await runOpticChangelog({
      ...baseOpticChangelog,
      gitProvider,
      baseSha: BASE_SHA,
      headSha: NEXT_SHA
    })

    expect(baseGitProvider.createPrComment).toBeCalledTimes(1)
    expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
    expect(mockJobRunner.setFailed).toBeCalledTimes(0)
    expect(mockJobRunner.debug.mock.calls).toMatchSnapshot()
  })

  it("fails silently when there isn't a spec in the head branch", async () => {
    const gitProvider = {
      ...baseGitProvider,
      getFileContent: jest.fn().mockImplementation(sha => {
        if (sha === baseOpticChangelog.headSha) throw Error()
        return '[]'
      })
    }
    await runOpticChangelog({
      ...baseOpticChangelog,
      gitProvider
    })
    expectToFailSilently()
    expect(mockJobRunner.info).toMatchSnapshot()
  })

  it("works correctly when there isn't a spec in the base branch", async () => {
    const gitProvider = {
      ...baseGitProvider,
      getFileContent: jest.fn().mockImplementation((sha, path) => {
        if (sha === baseOpticChangelog.baseSha) throw Error()
        return baseGitProvider.getFileContent(sha, path)
      })
    }
    await runOpticChangelog({
      ...baseOpticChangelog,
      gitProvider
    })
    expectCommentWasCreated()
  })
})

function expectCommentWasCreated() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(1)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
  expect(mockJobRunner.debug.mock.calls).toMatchSnapshot()
  expect(mockJobRunner.info.mock.calls).toMatchSnapshot()
  expect(mockJobRunner.warning.mock.calls).toMatchSnapshot()
}

function expectToFailSilently() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(0)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
}
