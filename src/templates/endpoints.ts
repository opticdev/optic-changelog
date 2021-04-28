// ### {{ icon }} {{ type}} Endpoints

import {Endpoint} from '../types'

// | Endpoint | Description |     |
// | -------- | ----------- | --: |
// {{#endpoints}}
// | **{{ method }}** {{{ route }}} | {{ description}} | [**Review**]({{{endpointLink}}}) |
// {{/endpoints}}

export type EndpointRowProps = {
  endpoint: Endpoint
  description: string
  endpointLink: string
}

export function endpointRow({
  endpoint,
  description,
  endpointLink
}: EndpointRowProps): string {
  return `**${endpoint.method}** ${endpoint.path} | ${description} | [**Review**](${endpointLink}) |`
}

const iconMap = {
  added: '🟢',
  updated: '📝',
  removed: '❌'
}

export type EndpointTableProps = {
  type: keyof typeof iconMap
  endpoints: Endpoint[]
  endpointLinkGenerator: (e: Endpoint) => string
}

export function endpointTable({
  type,
  endpoints,
  endpointLinkGenerator
}: EndpointTableProps): string {
  return `###### ${iconMap[type]}\u2003${type} Endpoints (${endpoints.length})

| Endpoint | Description |     |
| -------- | ----------- | --: |
${endpoints.map(endpoint =>
  endpointRow({
    endpoint,
    description: 'not yet',
    endpointLink: endpointLinkGenerator(endpoint)
  })
)}`
}
