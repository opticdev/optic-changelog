import * as Sentry from '@sentry/node'
import {SpanContext} from '@sentry/types/dist'
import {Span} from '@sentry/tracing'

export async function sentryInstrument<T>(
  spanParams: Partial<SpanContext>,
  cb: (
    transaction: ReturnType<typeof Sentry['startTransaction']>,
    span: Span
  ) => Promise<T>
): Promise<T> {
  const existingTxn = !!Sentry.getCurrentHub().getScope()?.getTransaction()
  const transaction =
    Sentry.getCurrentHub().getScope()?.getTransaction() ??
    Sentry.startTransaction({
      op: 'gitbot_run',
      name: 'Gitbot Run'
    })

  const existingSpan = Sentry.getCurrentHub().getScope()?.getSpan()

  const span = existingSpan
    ? existingSpan.startChild(spanParams)
    : transaction.startChild(spanParams)

  Sentry.getCurrentHub().configureScope(s => s.setSpan(span))
  try {
    return await cb(transaction, span)
  } catch (e) {
    Sentry.captureException(e)
    throw e
  } finally {
    span.finish()
    if (existingSpan) {
      Sentry.getCurrentHub().configureScope(s => s.setSpan(existingSpan))
    } else {
      Sentry.getCurrentHub().configureScope(s => s.setSpan(transaction))
    }
    if (!existingTxn) {
      // We started the txn, so we need to finish it
      transaction.finish()
    }
  }
}
