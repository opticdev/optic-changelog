// # Optic PR Check
// _Last updated @ {{ updateTime }} UTC_

import {CLOUD_SPEC_VIEWER_BASE, COMMENT_HEADER_IMG} from '../constants'
import {Changelog, Endpoint} from '../types'
import {endpointTable} from './endpoints'

// {{#specs}}

// {{content}}

// {{/specs}}

// #### Powered by [Optic](https://www.useoptic.com). [Not seeing changes?](https://www.useoptic.com/docs/documenting-your-api/)

function subscribersPing({subscribers}: {subscribers: string[]}): string {
  const filteredSubs = subscribers.filter(f => f?.length > 0)

  if (filteredSubs.length > 0) {
    return `
---
Pinging subscribers:
${filteredSubs.map(sub => `* @${sub}`).join('\n')}
`
  } else {
    return ''
  }
}

export type MainProps = {
  changes: Changelog
  baseBatchCommit: string | null
  specId: string
  specPath: string
  subscribers?: string[]
}

export function mainCommentTemplate({
  changes,
  specPath,
  baseBatchCommit,
  specId,
  subscribers = []
}: MainProps): string {
  const linkGen = (endpoint: Endpoint): string => {
    if (baseBatchCommit) {
      return `${CLOUD_SPEC_VIEWER_BASE}/${specId}/changes-since/${baseBatchCommit}/paths/${endpoint.pathId}/methods/${endpoint.method}`
    } else {
      return `${CLOUD_SPEC_VIEWER_BASE}/${specId}/documentation/paths/${endpoint.pathId}/methods/${endpoint.method}`
    }
  }

  const changes_by_category = changes.data.endpointChanges.endpoints.reduce(
    (accum, current) => {
      return {
        ...accum,
        [current.change.category]: [
          ...(accum[current.change.category] || []),
          current
        ]
      }
    },
    {} as {[key: string]: typeof changes.data.endpointChanges.endpoints}
  )

  const tables = Object.entries(changes_by_category).map(
    ([category, category_changes]) =>
      endpointTable({
        type: category as any,
        endpoints: category_changes,
        endpointLinkGenerator: linkGen
      })
  )

  const specUrl = `${CLOUD_SPEC_VIEWER_BASE}/${specId}/${
    baseBatchCommit ? `changes-since/${baseBatchCommit}` : `documentation`
  }`

  const projectName = 'Name'

  return `![changelog](${COMMENT_HEADER_IMG})

[Click Here to See the Documentation](${specUrl})

##### Changelog for ${projectName} \`/${specPath}\

${tables.join('\n')}

${subscribersPing({subscribers})}
> Powered by [Optic](https://www.useoptic.com). [Learn how it works!](https://www.useoptic.com/docs/using/baseline)
`
}
