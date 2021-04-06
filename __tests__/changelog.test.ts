import {runOpticChangelog} from '../src/changelog'

const baseGitProvider = {
  getFileContent: async () => '[]',
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
  headSha: 'head-sha',
  baseSha: 'base-sha',
  baseBranch: 'main',
  prNumber: 100,
  jobRunner: mockJobRunner
}

describe('Changelog', () => {
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
}

function expectCommentWasUpdated() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(0)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(1)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
}

function expectToFailSilently() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(0)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
}
