type Frequency = 'weekly' | 'monthly' | 'yearly'

interface RecurringParams {
  frequency: Frequency
  start_date: string
  last_generated: string | null
}

function addInterval(date: Date, frequency: Frequency): Date {
  const d = new Date(date)
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  else if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else d.setUTCFullYear(d.getUTCFullYear() + 1)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function computeMissingOccurrences(
  params: RecurringParams,
  upTo: Date = new Date()
): string[] {
  const todayStr = toDateStr(upTo)

  let next: Date
  if (params.last_generated) {
    next = addInterval(new Date(params.last_generated), params.frequency)
  } else {
    next = new Date(params.start_date)
  }

  const results: string[] = []
  while (toDateStr(next) <= todayStr) {
    results.push(toDateStr(next))
    next = addInterval(next, params.frequency)
  }
  return results
}
