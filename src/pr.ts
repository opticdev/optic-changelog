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

export function generateBadApiKeyCommentBody(): string {
  return `## Optic Changelog

Your \`OPTIC_API_KEY\` is missing or invalid. Follow these docs!
`
}
