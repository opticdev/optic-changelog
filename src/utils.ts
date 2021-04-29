import * as Sentry from '@sentry/node'
import {Span} from '@sentry/tracing'

export async function sentryInstrument<T>(
  cb: (
    transaction: ReturnType<typeof Sentry['startTransaction']>,
    span: Span
  ) => Promise<T>
): Promise<T> {
  const transaction =
    Sentry.getCurrentHub().getScope()?.getTransaction() ??
    Sentry.startTransaction({
      op: 'gitbot_run',
      name: 'Gitbot Run'
    })

  const span = transaction.startChild()
  try {
    return await cb(transaction, span)
  } catch (e) {
    Sentry.captureException(e)
    throw e
  } finally {
    span.finish()
  }
}
