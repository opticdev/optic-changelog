import {Changelog} from './types'

const REGEX = /\n\n<!-- optic = (.*) -->/

export function isOpticComment(body: string): boolean {
  return body.match(REGEX) ? true : false
}

export function getMetadata(body: string): any {
  const match = body.match(REGEX)

  if (match) {
    return JSON.parse(match[1])
  }

  return {}
}

export function setMetadata(body: string, data: any): string {
  let currentData = {}

  const bodyText = body.replace(REGEX, (_, json) => {
    currentData = JSON.parse(json)
    return ''
  })

  return `${bodyText}\n\n<!-- optic = ${JSON.stringify({
    ...currentData,
    ...data
  })} -->`
}

export function generateCommentBody(
  changes: Changelog,
  subscribers: string[]
): string {
  const results = {
    added: 0,
    updated: 0,
    removed: 0
  }

  for (const endpoint of changes.data.endpoints) {
    switch (endpoint.change.category) {
      case 'added':
        results.added++
        break
      case 'updated':
        results.updated++
        break
      case 'removed':
        results.removed++
        break
    }
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/T/, ' ')
    .replace(/\..+/, '')

  const baseBody = `## Optic Changelog
  
* Endpoints added: ${results.added}
* Endpoints updated: ${results.updated}

Last updated: ${timestamp}

[View documentation](${changes.data.opticUrl})
`

  if (subscribers.length) {
    const subscriberText = subscribers
      .map(subscriber => `@${subscriber}`)
      .join(', ')
    return `${baseBody}
---

Pinging subscribers ${subscriberText}`
  }

  return baseBody
}
