// # Optic PR Check
// _Last updated @ {{ updateTime }} UTC_

import {Changelog, Endpoint} from '../types'
import {endpointTable} from './endpoints'
import {spec} from './spec'

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

const cloudSpecViewerBase = `https://spec.useoptic.com/public-specs`

export function mainCommentTemplate({
  changes,
  specPath,
  baseBatchCommit,
  specId,
  subscribers = []
}: MainProps): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/T/, ' ')
    .replace(/\..+/, '')

  const linkGen = (endpoint: Endpoint): string => {
    if (baseBatchCommit) {
      return `${cloudSpecViewerBase}/${specId}/changes-since/${baseBatchCommit}/paths/${endpoint.pathId}/methods/${endpoint.method}`
    } else {
      return `${cloudSpecViewerBase}/${specId}/documentation/paths/${endpoint.pathId}/methods/${endpoint.method}`
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

  return `# Optic PR Check
_Last updated @ ${timestamp} UTC_

${spec(
  {
    name: 'Project name',
    specPath,
    title: `Optic detected ${Object.entries(changes_by_category)
      .map(
        ([category, category_changes]) =>
          `${category_changes.length} ${category} endpoint(s)`
      )
      .join(', ')}`,
    specUrl: `${cloudSpecViewerBase}/${specId}/documentation`
  },
  tables.join('\n')
)}
${subscribersPing({subscribers})}
#### Powered by [Optic](https://www.useoptic.com). [Not seeing changes?](https://www.useoptic.com/docs/using/baseline)
`
}