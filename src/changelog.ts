import {Changelog, IJobRunner} from './types'
import {setMetadata, isOpticComment, generateCommentBody} from './pr'

// TODO(jshearer): Possibly parameterize this?
const API_BASE = "https://api.useoptic.com";
async function uploadSpec({
  apiKey,
  specContents, 
  jobRunner,
  metadata = {}
}: {
  apiKey: string,
  specContents: string,
  jobRunner: IJobRunner,
  metadata?: Record<string, any>
}): Promise<string> {
  jobRunner.debug("Creating new spec to upload")
  const newSpecResp = await fetch(`${API_BASE}/api/account/specs`, {
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(metadata)
  });

  if(!newSpecResp.ok){
    throw new Error(`Error creating spec to upload: ${newSpecResp.statusText}: ${await newSpecResp.text()}`)
  }

  const {spec: {id: specId}, upload_url} = await newSpecResp.json();
  jobRunner.debug(`Spec created: ${specId}. Uploading...`);

  const uploadResult = await fetch(upload_url, {
    headers: {
      "Content-Type": "application/json"
    },
    body: specContents
  });

  if(!uploadResult.ok){
    throw new Error(`Error uploading spec: ${uploadResult.statusText}: ${await uploadResult.text()}`)
  }

  jobRunner.info(`Spec ${specId} uploaded successfully`);

  return specId;
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
  generateEndpointChanges
}): Promise<void> {
  let headContent: string, baseContent: string

  // This may fail if the file was moved or it's a new Optic setup
  try {
    headContent = await gitProvider.getFileContent(headSha, opticSpecPath)
  } catch (error) {
    // Failing silently here
    jobRunner.info(
      `Could not find the Optic spec in the current branch. Looking in ${opticSpecPath}.`
    )
    return
  }

  // This may fail if the file was moved or it's a new Optic setup
  try {
    baseContent = await gitProvider.getFileContent(baseSha, opticSpecPath)
  } catch (error) {
    // Failing silently here
    jobRunner.info(
      `Could not find the Optic spec in the base branch ${baseBranch}. Looking in ${opticSpecPath}.`
    )
    return
  }

  // TODO: use new changelog library here
  const changes: Changelog = await generateEndpointChanges(
    JSON.parse(baseContent),
    JSON.parse(headContent)
  )
  jobRunner.debug(changes)

  if (changes.data.endpointChanges.endpoints.length === 0) {
    jobRunner.info('No API changes in this PR.')
    return
  }

  let specId: string|undefined = undefined;
  if(apiKey && apiKey.length > 0 && changes.data.endpointChanges.endpoints.length > 0){
    specId = await uploadSpec({
      apiKey,
      specContents: headContent,
      jobRunner,
      metadata: {
        prNumber,
        baseBranch,
        ...gitProvider.getRepoInfo()
      }
    })
  }

  const message = generateCommentBody({changes, subscribers, specId})
  const body = setMetadata(message, {})

  jobRunner.debug('Created body for comment')
  jobRunner.debug(body)

  try {
    // TODO: probably should be simplified a bit
    const existingBotComments = (
      await gitProvider.getPrBotComments(prNumber)
    ).filter(comment => isOpticComment(comment.body!))

    if (existingBotComments.length) {
      const comment = existingBotComments[0]
      jobRunner.debug(`Updating comment ${comment.id}`)
      // TODO: need to pull out metadata and combine with new (maybe)
      await gitProvider.updatePrComment(comment.id, body)
    } else {
      jobRunner.debug(`Creating comment for PR ${prNumber}`)
      await gitProvider.createPrComment(prNumber, body)
    }
  } catch (error) {
    jobRunner.info(
      `There was an error creating or updating a PR comment. Error message: ${error.message}`
    )
    return
  }
}
