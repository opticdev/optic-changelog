import {runOpticChangelog} from "../src/changelog"

const baseGitProvider = {
  getFileContent: async () => "[]",
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
  opticSpecPath: ".optic/api/specification.yml",
  gitProvider: baseGitProvider,
  headSha: "asdf",
  baseSha: "jkl",
  baseBranch: "main",
  prNumber: 100,
  jobRunner: mockJobRunner
}

describe("Changelog", () => {
  afterEach(() => {
    jest.clearAllMocks();
  })

  it("creates a comment", async () => {
    await runOpticChangelog(baseOpticChangelog)
    commentWasCreated()
  })

  it("updates a comment", async () => {
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
    commentWasUpdated()
  })
  it("fails silently when there isn't a spec in the current branch", async () => {
    const gitProvider = {
      ...baseGitProvider,
      getFileContent: jest.fn()
        .mockImplementationOnce(async () => {
          throw Error();
        })
    }
    await runOpticChangelog({
      ...baseOpticChangelog,
      gitProvider
    })
    failedSilently()
    expect(mockJobRunner.info).toMatchSnapshot()
  })
  it("fails silently when there isn't a spec in the head branch", async () => {
    const gitProvider = {
      ...baseGitProvider,
      getFileContent: jest.fn()
        .mockImplementationOnce(async () => "[]")
        .mockImplementationOnce(async () => {
          throw Error("Can't find base file");
        })
    }
    await runOpticChangelog({
      ...baseOpticChangelog,
      gitProvider
    })
    failedSilently()
    expect(mockJobRunner.info).toMatchSnapshot()
  })
})

function commentWasCreated() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(1)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
}

function commentWasUpdated() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(0)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(1)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
}

function failedSilently() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(0)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
}