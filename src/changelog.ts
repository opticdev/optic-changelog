import {Changelog} from './types'

// TODO: this is fake data for now
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getChangelogData(options: object): Changelog {
  return {
    data: {
      opticUrl: 'https://example.com',
      endpoints: [
        {
          change: {
            category: 'added'
          },
          path: '/foo',
          method: 'get'
        },
        {
          change: {
            category: 'updated'
          },
          path: '/bar',
          method: 'post'
        }
      ]
    }
  }
}
