import { Suspense } from 'react'
import { getTransactions } from '@/app/actions/transactions'
import { getCategories } from '@/app/actions/categories'
import { TransactionListClient } from '@/components/app/TransactionListClient'
import { TransactionRowSkeleton } from '@/components/app/Skeletons'

interface Props {
  searchParams: Promise<{ month?: string; type?: string; category?: string; q?: string; page?: string; sort?: string; order?: string }>
}

export default async function TransactionsPage({ searchParams }: Props) {
  const params = await searchParams
  const [{ data: transactions, count }, categories] = await Promise.all([
    getTransactions({
      month: params.month,
      type: params.type as 'expense' | 'income' | undefined,
      category_id: params.category,
      q: params.q,
      sort: params.sort,
      order: params.order as 'asc' | 'desc' | undefined,
      page: params.page ? Number(params.page) : 1,
    }),
    getCategories(),
  ])

  return (
    <div>
      <Suspense fallback={<>{Array.from({ length: 5 }).map((_, i) => <TransactionRowSkeleton key={i} />)}</>}>
        <TransactionListClient
          transactions={transactions as Parameters<typeof TransactionListClient>[0]['transactions']}
          categories={categories}
          totalCount={count}
          currentPage={params.page ? Number(params.page) : 1}
          searchParams={params}
        />
      </Suspense>
    </div>
  )
}
