import * as fs from 'fs'
import * as path from 'path'
import {generateEndpointChanges} from '@useoptic/changelog'
import {runOpticChangelog} from '../src/changelog'

const BASE_SHA = 'base-sha'
const HEAD_SHA = 'head-sha'

const baseGitProvider = {
  getFileContent: async (sha: string) => {
    if (sha === BASE_SHA) {
      return fs
        .readFileSync(path.join(__dirname, 'specs/add-method/initial.json'))
        .toString()
    }
    return fs
      .readFileSync(path.join(__dirname, 'specs/add-method/current.json'))
      .toString()
  },
  getPrBotComments: async () => [],
  updatePrComment: jest.fn(),
  createPrComment: jest.fn()
}

const mockJobRunner = {
  info: jest.fn(),
  debug: jest.fn(),
  setFailed: jest.fn()
}

const baseOpticChangelog = {
  subscribers: [],
  opticSpecPath: '.optic/api/specification.yml',
  gitProvider: baseGitProvider,
  headSha: HEAD_SHA,
  baseSha: BASE_SHA,
  baseBranch: 'main',
  prNumber: 100,
  jobRunner: mockJobRunner,
  generateEndpointChanges
}

describe('Changelog', () => {
  beforeAll(() => {
    Date.prototype.toISOString = jest.fn(() => '2021-04-21T15:06:33.601Z')
  })

  it('creates a comment', async () => {
    await runOpticChangelog(baseOpticChangelog)
    expectCommentWasCreated()
  })

  it('updates a comment', async () => {
    const gitProvider = {
      ...baseGitProvider,
      getPrBotComments: async () => [
        {
          id: 1,
          body: 'Optic comment\n\n<!-- optic = {} -->'
        }
      ]
    }
    await runOpticChangelog({
      ...baseOpticChangelog,
      gitProvider
    })
    expectCommentWasUpdated()
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

  it("fails silently when there isn't a spec in the base branch", async () => {
    const gitProvider = {
      ...baseGitProvider,
      getFileContent: jest.fn().mockImplementation(sha => {
        if (sha === baseOpticChangelog.baseSha) throw Error()
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
})

function expectCommentWasCreated() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(1)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
  expect(mockJobRunner.debug.mock.calls).toMatchSnapshot()
}

function expectCommentWasUpdated() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(0)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(1)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
  expect(mockJobRunner.debug.mock.calls).toMatchSnapshot()
}

function expectToFailSilently() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(0)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
}
