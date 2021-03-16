export type Changelog = {
  data: {
    opticUrl: string
    endpoints: {
      change: {
        category: string
      }
      path: string
      method: string
    }[]
  }
}
