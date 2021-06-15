import * as fs from 'fs'
import * as path from 'path'
import {generateEndpointChanges} from '@useoptic/changelog'
import {ChangelogParams, runOpticChangelog} from '../src/changelog'
import {IGitProvider} from '../src/types'

const BASE_SHA = 'base-sha'
const UNRELATED_SHA = 'unrelated-sha'
const REGRESSION_1 = 'regression-1'

const pathMap = {
  [BASE_SHA]: null,
  [UNRELATED_SHA]: 'specs/add-method/next.json',
  [REGRESSION_1]: 'specs/regression/regression_1.json'
}

const baseGitProvider: IGitProvider = {
  getFileContent: async (sha: string) => {
    if (!sha) {
      return '[]'
    } else {
      return fs.readFileSync(path.join(__dirname, pathMap[sha])).toString()
    }
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
  headSha: '',
  baseSha: BASE_SHA,
  baseBranch: 'main',
  prNumber: 100,
  jobRunner: mockJobRunner,
  generateEndpointChanges,
  uploadSpec: jest
    .fn()
    .mockResolvedValue({specId: 'spec-id', personId: 'person-id'})
}

describe('Regression', () => {
  beforeAll(() => {
    Date.prototype.toISOString = jest.fn(() => '2021-04-21T15:06:33.601Z')
  })

  it('shouldnt error on unrelated history', async () => {
    await runOpticChangelog({
      ...baseOpticChangelog,
      baseSha: UNRELATED_SHA,
      headSha: REGRESSION_1
    })
    expectCommentWasCreated()
    expect(mockJobRunner.exportVariable).toBeCalledTimes(1)
  })
})

function expectCommentWasCreated() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(1)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
  expect(mockJobRunner.debug.mock.calls).toMatchSnapshot()
  expect(mockJobRunner.warning.mock.calls).toMatchSnapshot()
}

function expectToFailSilently() {
  expect(baseGitProvider.createPrComment).toBeCalledTimes(0)
  expect(baseGitProvider.updatePrComment).toBeCalledTimes(0)
  expect(mockJobRunner.setFailed).toBeCalledTimes(0)
}
