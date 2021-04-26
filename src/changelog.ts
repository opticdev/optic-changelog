import {Changelog, IJobRunner} from './types'
import fetch from "node-fetch";
import {setMetadata, isOpticComment, generateCommentBody, generateBadApiKeyCommentBody} from './pr'

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
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(metadata)
  });

  if(!newSpecResp.ok){
    throw new Error(`Error creating spec to upload: ${newSpecResp.statusText}: ${await newSpecResp.text()}`)
  }

  const {id: specId, upload_url} = await newSpecResp.json();
  jobRunner.debug(`Spec created: ${specId}. Uploading...`);

  const uploadResult = await fetch(upload_url, {
    method: "PUT",
    headers: {
      "x-amz-server-side-encryption": "AES256",
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
  let headContent: any[], baseContent: any[]

  // This may fail if the file was moved or it's a new Optic setup
  try {
    headContent = JSON.parse(await gitProvider.getFileContent(headSha, opticSpecPath))
  } catch (error) {
    // Failing silently here
    jobRunner.info(
      `Could not find the Optic spec in the current branch. Looking in ${opticSpecPath}.`
    )
    return
  }

  // This may fail if the file was moved or it's a new Optic setup
  try {
    baseContent = JSON.parse(await gitProvider.getFileContent(baseSha, opticSpecPath))
  } catch (error) {
    // Failing silently here
    jobRunner.info(
      `Could not find the Optic spec in the base branch ${baseBranch}. Looking in ${opticSpecPath}.`
    )
    baseContent = [];
  }

  // TODO: use new changelog library here
  const changes: Changelog = await generateEndpointChanges(
    baseContent,
    headContent
  )
  jobRunner.debug(changes)

  let specId: string|undefined = undefined;
  if(apiKey && apiKey.length > 0 && changes.data.endpointChanges.endpoints.length > 0){
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
  }

  if (changes.data.endpointChanges.endpoints.length === 0) {
    jobRunner.info('No API changes in this PR.');
    return;
  }

  let message: string;
  if(apiKey){
    message = generateCommentBody({changes, subscribers, specId})
  } else {
    message = generateBadApiKeyCommentBody();
  }

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
