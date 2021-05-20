import {Changelog, IGitProvider, IJobRunner} from './types'
import fetch from 'node-fetch'
import hash from 'object-hash'
import yaml from 'js-yaml'
import {
  setMetadata,
  isOpticComment,
  generateBadApiKeyCommentBody,
  getMetadata
} from './pr'
import {InMemoryOpticContextBuilder} from '@useoptic/spectacle/build/in-memory'
import * as OpticEngine from '@useoptic/diff-engine-wasm/engine/build'
import {makeSpectacle} from '@useoptic/spectacle'
import {mainCommentTemplate} from './templates/main'
import {API_BASE} from './constants'
import {join} from 'path'
import {sentryInstrument} from './utils'
import {SpanStatus} from '@sentry/tracing'
import * as Sentry from '@sentry/node'

export type UploadParams = {
  apiKey: string
  specContents: string
  jobRunner: IJobRunner
  metadata?: Record<string, any>
}

async function identify({apiKey}: {apiKey: string}): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/account`, {
    headers: {Authorization: `Token ${apiKey}`}
  })
  const {id, email} = await resp.json()

  Sentry.getCurrentHub().configureScope(s => s.setUser({id, email}))
}

async function networkUpload({
  apiKey,
  specContents,
  jobRunner,
  metadata = {}
}: UploadParams): Promise<string> {
  const identProm = identify({apiKey})

  return sentryInstrument({op: 'upload_spec'}, async (_tx, span) => {
    jobRunner.debug('Creating new spec to upload')
    const newSpecResp = await fetch(`${API_BASE}/api/account/specs`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    })

    if (!newSpecResp.ok) {
      throw new Error(
        `Error creating spec to upload: ${
          newSpecResp.statusText
        }: ${await newSpecResp.text()}`
      )
    }

    const {id: specId, upload_url} = await newSpecResp.json()
    jobRunner.debug(`Spec created: ${specId}. Uploading...`)

    const uploadResult = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'x-amz-server-side-encryption': 'AES256'
      },
      body: specContents
    })

    if (!uploadResult.ok) {
      throw new Error(
        `Error uploading spec: ${
          uploadResult.statusText
        }: ${await uploadResult.text()}`
      )
    }

    jobRunner.info(`Spec ${specId} uploaded successfully`)

    span.setData('specId', specId)
    span.setStatus(SpanStatus.Ok)

    await identProm

    return specId
  })
}

export type ChangelogParams = {
  apiKey: string | undefined
  subscribers: string[]
  opticSpecPath: string
  gitProvider: IGitProvider
  headSha: string
  baseSha: string
  baseBranch: string
  prNumber: number
  jobRunner: IJobRunner
  generateEndpointChanges: any // todo(jshearer): specify this type
  uploadSpec?: (up: UploadParams) => Promise<string>
}

async function getLatestBatchCommit(events: any[]): Promise<string | null> {
  if (events.length < 1) {
    return null
  }

  // Mostly copied from `opticdev/optic/workspaces/changelog/src/index.ts
  const initialOpticContext = await InMemoryOpticContextBuilder.fromEvents(
    OpticEngine,
    events
  )
  const initialSpectacle = await makeSpectacle(initialOpticContext)

  const batchCommitResults: any = await initialSpectacle.queryWrapper({
    query: `{
      batchCommits {
        createdAt
        batchId
      }
    }`,
    variables: {}
  })

  const latestBatchCommit = batchCommitResults.data?.batchCommits?.reduce(
    (result: any, batchCommit: any) => {
      return batchCommit.createdAt > result.createdAt ? batchCommit : result
    }
  )

  return latestBatchCommit.batchId
}

export async function runOpticChangelog({
  apiKey,
  subscribers,
  opticSpecPath,
  gitProvider,
  headSha,
  baseSha,
  baseBranch,
  prNumber,
  jobRunner,
  generateEndpointChanges,
  uploadSpec = networkUpload
}: ChangelogParams): Promise<void> {
  return sentryInstrument(
    {
      op: 'run_changelog'
    },
    async (tx, span) => {
      let headContent: any[], baseContent: any[], baseBatchCommit: string | null

      // This may fail if the file was moved or it's a new Optic setup
      try {
        headContent = JSON.parse(
          await gitProvider.getFileContent(headSha, opticSpecPath)
        )
      } catch (error) {
        // Failing silently here
        jobRunner.info(
          `Could not find the Optic spec in the current branch. Looking in ${opticSpecPath}.`
        )
        return
      }

      try {
        baseContent = JSON.parse(
          await gitProvider.getFileContent(baseSha, opticSpecPath)
        )
        baseBatchCommit = await getLatestBatchCommit(baseContent)
        jobRunner.exportVariable('SINCE_BATCH_COMMIT_ID', baseBatchCommit)
        span.setTag('baseBatchCommit', baseBatchCommit)
      } catch (error) {
        jobRunner.info(
          `Could not find the Optic spec in the base branch ${baseBranch}. Looking in ${opticSpecPath}.`
        )
        span.setTag('baseBatchCommit', null)
        span.setTag('newOptic', true)
        baseContent = []
        baseBatchCommit = null
      }

      // TODO: use new changelog library here
      const changes: Changelog = await generateEndpointChanges(
        baseContent,
        headContent
      )
      jobRunner.debug(JSON.stringify(changes, null, 4))

      span.setData('changeCount', changes.data.endpointChanges.endpoints.length)

      let specId: string | undefined = undefined
      if (
        apiKey &&
        apiKey.length > 0 &&
        changes.data.endpointChanges.endpoints.length > 0 &&
        uploadSpec
      ) {
        specId = await uploadSpec({
          apiKey,
          specContents: JSON.stringify(headContent),
          jobRunner,
          metadata: {
            prNumber,
            baseBranch,
            ...gitProvider.getRepoInfo()
          }
        })
        span.setData('cloudSpecId', specId)
      }

      if (changes.data.endpointChanges.endpoints.length === 0) {
        jobRunner.info('No API changes in this PR.')
        return
      }

      let message: string
      if (apiKey && specId) {
        const opticYamlPath = join(opticSpecPath, '../../../optic.yml')
        let projectName: string | null
        try {
          const opticYaml: {name: string} = yaml.load(
            await gitProvider.getFileContent(headSha, opticYamlPath)
          ) as any
          projectName = opticYaml.name
          tx.setData('projectName', projectName)
        } catch (e) {
          projectName = null
        }
        message = mainCommentTemplate({
          changes,
          specPath: opticSpecPath,
          subscribers,
          specId,
          baseBatchCommit,
          projectName
        })
      } else {
        message = generateBadApiKeyCommentBody()
      }

      const msgHash = hash({changes, subscribers, opticSpecPath})

      const body = setMetadata(message, {messageHash: msgHash})

      jobRunner.debug('Created body for comment')
      jobRunner.debug(body)

      try {
        // TODO: probably should be simplified a bit
        const existingBotComments = (
          await gitProvider.getPrBotComments(prNumber)
        ).filter(comment => isOpticComment(comment.body))

        // Bail because of existing comment with same hash
        if (existingBotComments.length) {
          const comment = existingBotComments[existingBotComments.length - 1]

          const commentMeta = getMetadata(comment.body)

          if (commentMeta?.messageHash === msgHash) {
            if (comment.body === body) {
              jobRunner.debug(
                `Existing comment with same hash, and no comment differences found. No changes!`
              )
              return
            } else {
              jobRunner.debug(
                `Existing comment with same hash, but some comment differences found. Updating that comment!`
              )
              await gitProvider.updatePrComment(comment.id, body)
              return
            }
          }
        }

        // Or make a new comment -- no updating
        jobRunner.debug(`Creating comment for PR ${prNumber}`)
        await gitProvider.createPrComment(prNumber, body)
      } catch (error) {
        jobRunner.info(
          `There was an error creating a PR comment. Error message: ${error.message}`
        )
        return
      }
    }
  )
}
