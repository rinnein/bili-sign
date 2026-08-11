import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type { PaginationState, SortingState } from '@tanstack/react-table'
import type { OAuthClient } from '@better-auth/oauth-provider'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import { Input } from '#/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { OAuthClientFormDialog } from '#/components/oauth-client-form-dialog'
import type {
  RegisteredOAuthClient,
  SafeOAuthClient,
} from '#/components/oauth-client-form-dialog'
import { appFetch, authClient } from '#/lib/auth-client'

export type ClientListScope = 'mine' | 'all'

const tableFeaturesConfig = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

const columnHelper = createColumnHelper<
  typeof tableFeaturesConfig,
  SafeOAuthClient
>()

const EMPTY_CLIENTS: Array<SafeOAuthClient> = []

function toSafeClient(value: OAuthClient | SafeOAuthClient): SafeOAuthClient {
  return {
    client_id: value.client_id,
    user_id: value.user_id ?? undefined,
    client_name: value.client_name ?? undefined,
    client_uri: value.client_uri ?? undefined,
    logo_uri: value.logo_uri ?? undefined,
    redirect_uris: value.redirect_uris,
    scope: value.scope ?? undefined,
    contacts: value.contacts ?? undefined,
    tos_uri: value.tos_uri ?? undefined,
    policy_uri: value.policy_uri ?? undefined,
    software_id: value.software_id ?? undefined,
    software_version: value.software_version ?? undefined,
    software_statement: value.software_statement ?? undefined,
    post_logout_redirect_uris: value.post_logout_redirect_uris ?? undefined,
    token_endpoint_auth_method: value.token_endpoint_auth_method ?? undefined,
    grant_types: value.grant_types ?? undefined,
    response_types: value.response_types ?? undefined,
    type: value.type,
    client_id_issued_at: value.client_id_issued_at,
    created_at:
      typeof value.created_at === 'string'
        ? value.created_at
        : typeof value.client_id_issued_at === 'number'
          ? new Date(value.client_id_issued_at * 1000).toISOString()
          : undefined,
    updated_at:
      typeof value.updated_at === 'string' ? value.updated_at : undefined,
    disabled: value.disabled,
    public: value.public,
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function OAuthClientManager({
  allowScopeSwitch = false,
  refreshKey = 0,
  createOpen = false,
  onCreateOpenChange,
  onCreated,
}: {
  allowScopeSwitch?: boolean
  refreshKey?: number
  createOpen?: boolean
  onCreateOpenChange?: (open: boolean) => void
  onCreated?: (client: RegisteredOAuthClient) => void
}) {
  const { data: session } = authClient.useSession()
  const [scope, setScope] = useState<ClientListScope>('mine')
  const [clients, setClients] = useState<Array<SafeOAuthClient>>(EMPTY_CLIENTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [selected, setSelected] = useState<SafeOAuthClient | null>(null)
  const [editing, setEditing] = useState<SafeOAuthClient | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadClients = useCallback(async () => {
    if (scope === 'mine') {
      const result = await authClient.oauth2.getClients()
      if (result.error || !Array.isArray(result.data)) {
        throw new Error(result.error?.message ?? 'Client 列表读取失败。')
      }
      setClients(result.data.map((client) => toSafeClient(client)))
      return
    }

    const response = await appFetch(`/api/admin/clients?scope=${scope}`)
    const result = (await response.json()) as
      | Array<SafeOAuthClient>
      | { message?: string }
    if (!response.ok || !Array.isArray(result)) {
      throw new Error(
        !Array.isArray(result) && result.message
          ? result.message
          : 'Client 列表读取失败。',
      )
    }
    setClients(result.map(toSafeClient))
  }, [scope])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void loadClients()
      .catch((loadError) => {
        if (!cancelled) {
          setClients(EMPTY_CLIENTS)
          setError(errorMessage(loadError, 'Client 列表读取失败。'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadClients, refreshKey])

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }, [globalFilter, scope])

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor(
          (client) =>
            [
              client.client_name,
              client.client_id,
              client.client_uri,
              client.user_id,
              ...client.redirect_uris,
            ]
              .filter(Boolean)
              .join(' '),
          {
            id: 'application',
            header: ({ column }) => <SortHeader column={column} label="应用" />,
            cell: ({ row }) => (
              <div className="grid gap-1">
                <span className="font-medium">
                  {row.original.client_name || '未命名应用'}
                </span>
                <code className="text-xs text-muted-foreground">
                  {row.original.client_id}
                </code>
                {row.original.client_uri ? (
                  <a
                    href={row.original.client_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="max-w-56 truncate text-xs text-muted-foreground underline underline-offset-4"
                  >
                    {row.original.client_uri}
                  </a>
                ) : null}
              </div>
            ),
          },
        ),
        ...(scope === 'all'
          ? [
              columnHelper.accessor('user_id', {
                header: ({ column }) => (
                  <SortHeader column={column} label="创建者" />
                ),
                cell: ({ getValue }) => (
                  <code className="text-xs">{getValue() ?? '—'}</code>
                ),
              }),
            ]
          : []),
        columnHelper.accessor((client) => client.redirect_uris.join(' '), {
          id: 'redirect_uris',
          header: '回调地址',
          enableSorting: false,
          cell: ({ row }) => (
            <span className="block max-w-64 truncate text-xs text-muted-foreground">
              {row.original.redirect_uris.join(', ')}
            </span>
          ),
        }),
        columnHelper.accessor('created_at', {
          header: ({ column }) => (
            <SortHeader column={column} label="创建时间" />
          ),
          cell: ({ getValue }) => (
            <span className="text-xs text-muted-foreground">
              {formatDate(getValue())}
            </span>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          header: '操作',
          cell: ({ row }) => {
            const client = row.original
            const canEdit =
              scope === 'mine' || client.user_id === session?.user.id
            return (
              <div className="flex justify-end gap-1">
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`编辑 ${client.client_name || client.client_id}`}
                    onClick={() => setEditing(client)}
                  >
                    <EditIcon />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`删除 ${client.client_name || client.client_id}`}
                  onClick={() => setSelected(client)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            )
          },
        }),
      ]),
    [scope, session?.user.id],
  )

  const table = useTable(
    {
      features: tableFeaturesConfig,
      columns,
      data: clients,
      state: { globalFilter, pagination, sorting },
      onGlobalFilterChange: setGlobalFilter,
      onPaginationChange: setPagination,
      onSortingChange: setSorting,
    },
    (state) => ({
      globalFilter: state.globalFilter,
      pagination: state.pagination,
      sorting: state.sorting,
    }),
  )

  async function deleteClient() {
    if (!selected) return
    setDeleting(true)
    setError('')
    try {
      if (scope === 'mine') {
        const result = await authClient.oauth2.deleteClient({
          client_id: selected.client_id,
        })
        if (result.error)
          throw new Error(result.error.message ?? 'Client 删除失败。')
      } else {
        const response = await appFetch('/api/admin/clients', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: selected.client_id }),
        })
        const result = (await response.json()) as { message?: string }
        if (!response.ok) throw new Error(result.message ?? 'Client 删除失败。')
      }
      setClients((current) =>
        current.filter((client) => client.client_id !== selected.client_id),
      )
      setSelected(null)
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Client 删除失败。'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>已创建的 Client</CardTitle>
          <CardDescription>
            {scope === 'all'
              ? '管理所有开发者创建的应用。'
              : '管理本账户创建的应用。'}
          </CardDescription>
        </div>
        {allowScopeSwitch ? (
          <div
            className="flex shrink-0 rounded-md border p-1"
            role="tablist"
            aria-label="Client 范围"
          >
            <Button
              type="button"
              size="sm"
              variant={scope === 'mine' ? 'secondary' : 'ghost'}
              role="tab"
              aria-selected={scope === 'mine'}
              onClick={() => setScope('mine')}
            >
              本用户
            </Button>
            <Button
              type="button"
              size="sm"
              variant={scope === 'all' ? 'secondary' : 'ghost'}
              role="tab"
              aria-selected={scope === 'all'}
              onClick={() => setScope('all')}
            >
              全部用户
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>操作失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {!loading && clients.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="搜索应用、Client ID、创建者或 URI"
              aria-label="搜索 Client"
              className="border-b-input px-3 sm:max-w-sm"
            />
            <span className="text-xs text-muted-foreground">
              共 {table.getFilteredRowModel().rows.length} 个 Client
            </span>
          </div>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="animate-spin" />
            正在读取…
          </div>
        ) : table.getFilteredRowModel().rows.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyTitle>
                {globalFilter ? '没有匹配的 Client' : '还没有 Client'}
              </EmptyTitle>
              <EmptyDescription>
                {globalFilter
                  ? '尝试更换搜索关键词。'
                  : '创建应用后会显示在这里。'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder ? null : (
                            <table.FlexRender header={header} />
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getAllCells().map((cell) => (
                        <TableCell key={cell.id}>
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">
                第 {pagination.pageIndex + 1} /{' '}
                {Math.max(table.getPageCount(), 1)} 页
              </span>
              <div className="flex items-center gap-2">
                <label
                  className="text-xs text-muted-foreground"
                  htmlFor="client-page-size"
                >
                  每页
                </label>
                <select
                  id="client-page-size"
                  value={pagination.pageSize}
                  onChange={(event) =>
                    table.setPageSize(Number(event.target.value))
                  }
                  className="h-9 border border-input bg-background px-2 text-sm"
                >
                  {[10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="上一页"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="下一页"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
      <AlertDialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个 Client？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，使用它发起的新 OAuth 授权将无法继续，且不能恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault()
                void deleteClient()
              }}
            >
              {deleting ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editing || createOpen ? (
        <OAuthClientFormDialog
          key={`${editing ? 'edit' : 'create'}-${editing?.client_id ?? 'new'}`}
          mode={editing ? 'edit' : 'create'}
          client={editing}
          open={Boolean(editing) || createOpen}
          onOpenChange={(open) => {
            if (open) return
            setEditing(null)
            onCreateOpenChange?.(false)
          }}
          onSaved={(updatedClient) => {
            const safeClient = toSafeClient(updatedClient)
            setClients((current) =>
              current.map((client) =>
                client.client_id === safeClient.client_id
                  ? { ...client, ...safeClient }
                  : client,
              ),
            )
            setEditing(null)
          }}
          onCreated={(createdClient) => {
            onCreated?.(createdClient)
            setEditing(null)
            onCreateOpenChange?.(false)
            setError('')
            void loadClients()
          }}
        />
      ) : null}
    </Card>
  )
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('zh-CN')
}

type SortableColumn = {
  getCanSort: () => boolean
  getIsSorted: () => false | 'asc' | 'desc'
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined
}

function SortHeader({
  column,
  label,
}: {
  column: SortableColumn
  label: string
}) {
  const sorted = column.getIsSorted()
  const Icon =
    sorted === 'asc'
      ? ArrowUpIcon
      : sorted === 'desc'
        ? ArrowDownIcon
        : ArrowUpDownIcon
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-3"
      disabled={!column.getCanSort()}
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      <Icon data-icon="inline-end" />
    </Button>
  )
}
