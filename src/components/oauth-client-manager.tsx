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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '#/components/ui/field'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { appFetch, authClient } from '#/lib/auth-client'

export type ClientListScope = 'mine' | 'all'

export type SafeOAuthClient = {
  client_id: string
  user_id?: string
  client_name?: string
  client_uri?: string
  logo_uri?: string
  redirect_uris: Array<string>
  scope?: string
  contacts?: Array<string>
  tos_uri?: string
  policy_uri?: string
  software_id?: string
  software_version?: string
  software_statement?: string
  post_logout_redirect_uris?: Array<string>
  token_endpoint_auth_method?: string
  grant_types?: Array<string>
  response_types?: Array<string>
  type?: 'web' | 'native' | 'user-agent-based'
  client_id_issued_at?: number
  created_at?: string
  updated_at?: string
  disabled?: boolean
  public?: boolean
}

type ClientEditorValues = {
  client_name: string
  client_uri: string
  logo_uri: string
  redirect_uris: string
  scope: string
  contacts: string
  tos_uri: string
  policy_uri: string
  software_id: string
  software_version: string
  software_statement: string
  post_logout_redirect_uris: string
  grant_types: Array<string>
  response_types: Array<string>
  type: 'web' | 'native' | 'user-agent-based'
}

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
const DEFAULT_EDITOR_VALUES: ClientEditorValues = {
  client_name: '',
  client_uri: '',
  logo_uri: '',
  redirect_uris: '',
  scope: '',
  contacts: '',
  tos_uri: '',
  policy_uri: '',
  software_id: '',
  software_version: '',
  software_statement: '',
  post_logout_redirect_uris: '',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  type: 'web',
}

const GRANT_TYPES = [
  ['authorization_code', 'Authorization Code'],
  ['client_credentials', 'Client Credentials'],
  ['refresh_token', 'Refresh Token'],
] as const

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

function toEditorValues(client: SafeOAuthClient): ClientEditorValues {
  return {
    client_name: client.client_name ?? '',
    client_uri: client.client_uri ?? '',
    logo_uri: client.logo_uri ?? '',
    redirect_uris: client.redirect_uris.join('\n'),
    scope: client.scope ?? '',
    contacts: client.contacts?.join('\n') ?? '',
    tos_uri: client.tos_uri ?? '',
    policy_uri: client.policy_uri ?? '',
    software_id: client.software_id ?? '',
    software_version: client.software_version ?? '',
    software_statement: client.software_statement ?? '',
    post_logout_redirect_uris:
      client.post_logout_redirect_uris?.join('\n') ?? '',
    grant_types: client.grant_types ?? DEFAULT_EDITOR_VALUES.grant_types,
    response_types:
      client.response_types ?? DEFAULT_EDITOR_VALUES.response_types,
    type: client.type ?? DEFAULT_EDITOR_VALUES.type,
  }
}

function parseLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function validateHttpUrls(values: Array<string>, label: string) {
  for (const value of values) {
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      throw new Error(`${label}必须是有效的 URL。`)
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`${label}必须使用 HTTP 或 HTTPS。`)
    }
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function OAuthClientManager({
  allowScopeSwitch = false,
  refreshKey = 0,
}: {
  allowScopeSwitch?: boolean
  refreshKey?: number
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
    <Card>
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
              <Table>
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
      <ClientEditorDialog
        client={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={(updatedClient) => {
          setClients((current) =>
            current.map((client) =>
              client.client_id === updatedClient.client_id
                ? { ...client, ...updatedClient }
                : client,
            ),
          )
          setEditing(null)
        }}
      />
    </Card>
  )
}

function ClientEditorDialog({
  client,
  open,
  onOpenChange,
  onSaved,
}: {
  client: SafeOAuthClient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (client: SafeOAuthClient) => void
}) {
  const [values, setValues] = useState<ClientEditorValues>(
    DEFAULT_EDITOR_VALUES,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!client || !open) return
    setValues(toEditorValues(client))
    setError('')
  }, [client, open])

  function updateValue<Key extends keyof ClientEditorValues>(
    key: Key,
    value: ClientEditorValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function toggleGrantType(value: string) {
    updateValue(
      'grant_types',
      values.grant_types.includes(value)
        ? values.grant_types.filter((item) => item !== value)
        : [...values.grant_types, value],
    )
  }

  function toggleResponseType(value: string) {
    updateValue(
      'response_types',
      values.response_types.includes(value)
        ? values.response_types.filter((item) => item !== value)
        : [...values.response_types, value],
    )
  }

  async function save() {
    if (!client) return
    setBusy(true)
    setError('')
    try {
      const redirectUris = parseLines(values.redirect_uris)
      if (redirectUris.length === 0) {
        throw new Error('至少需要填写一个 OAuth 回调 URL。')
      }
      if (!values.response_types.includes('code')) {
        throw new Error('当前 OAuth provider 必须保留 code response type。')
      }
      validateHttpUrls(redirectUris, 'OAuth 回调 URL')
      const postLogoutRedirectUris = parseLines(
        values.post_logout_redirect_uris,
      )
      if (postLogoutRedirectUris.length > 0) {
        validateHttpUrls(postLogoutRedirectUris, '退出登录回调 URL')
      }
      for (const [value, label] of [
        [values.client_uri, '应用主页 URL'],
        [values.logo_uri, 'Logo URL'],
        [values.tos_uri, '服务条款 URL'],
        [values.policy_uri, '隐私政策 URL'],
      ] as const) {
        if (value.trim()) validateHttpUrls([value.trim()], label)
      }

      const result = await authClient.oauth2.updateClient({
        client_id: client.client_id,
        update: {
          client_name: values.client_name.trim(),
          client_uri: values.client_uri.trim(),
          logo_uri: values.logo_uri.trim(),
          redirect_uris: redirectUris,
          scope: values.scope.trim(),
          contacts: parseLines(values.contacts).length
            ? parseLines(values.contacts)
            : undefined,
          tos_uri: values.tos_uri.trim(),
          policy_uri: values.policy_uri.trim(),
          software_id: values.software_id.trim(),
          software_version: values.software_version.trim(),
          software_statement: values.software_statement.trim(),
          post_logout_redirect_uris: postLogoutRedirectUris.length
            ? postLogoutRedirectUris
            : undefined,
          grant_types: values.grant_types as Array<
            'authorization_code' | 'client_credentials' | 'refresh_token'
          >,
          response_types: values.response_types as Array<'code'>,
          type: values.type,
        },
      })
      if (result.error)
        throw new Error(result.error.message ?? 'Client 更新失败。')
      onSaved(toSafeClient(result.data))
    } catch (saveError) {
      setError(errorMessage(saveError, 'Client 更新失败。'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑 OAuth Client</DialogTitle>
          <DialogDescription>
            Client ID、Secret 和所有者不可修改。数组字段请每行填写一个值。
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>更新失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="oauth-client-name">应用名称</FieldLabel>
            <Input
              id="oauth-client-name"
              value={values.client_name}
              onChange={(event) =>
                updateValue('client_name', event.target.value)
              }
              disabled={busy}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-uri">应用主页 URL</FieldLabel>
            <Input
              id="oauth-client-uri"
              value={values.client_uri}
              onChange={(event) =>
                updateValue('client_uri', event.target.value)
              }
              disabled={busy}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-redirect-uris">
              OAuth 回调 URL
            </FieldLabel>
            <textarea
              id="oauth-client-redirect-uris"
              value={values.redirect_uris}
              onChange={(event) =>
                updateValue('redirect_uris', event.target.value)
              }
              disabled={busy}
              aria-invalid={Boolean(error)}
              className="min-h-24 w-full border border-transparent border-b-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-b-ring"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-scope">允许的 Scope</FieldLabel>
            <Input
              id="oauth-client-scope"
              value={values.scope}
              onChange={(event) => updateValue('scope', event.target.value)}
              disabled={busy}
            />
          </Field>
          <FieldSet>
            <FieldLegend>授权能力</FieldLegend>
            <FieldGroup className="gap-3">
              {GRANT_TYPES.map(([value, label]) => (
                <Field key={value} orientation="horizontal">
                  <Checkbox
                    checked={values.grant_types.includes(value)}
                    onCheckedChange={() => toggleGrantType(value)}
                    disabled={busy}
                  />
                  <FieldLabel>{label}</FieldLabel>
                </Field>
              ))}
            </FieldGroup>
            <FieldDescription>
              Grant type 可以多选；当前 OAuth provider 只支持 code response
              type。
            </FieldDescription>
          </FieldSet>
          <FieldSet>
            <FieldLegend>Response Type</FieldLegend>
            <Field orientation="horizontal">
              <Checkbox
                checked={values.response_types.includes('code')}
                onCheckedChange={() => toggleResponseType('code')}
                disabled={busy}
              />
              <FieldLabel>code</FieldLabel>
            </Field>
            <FieldDescription>
              保存时必须保留 code，否则 OAuth provider 会拒绝更新。
            </FieldDescription>
          </FieldSet>
          <Field>
            <FieldLabel htmlFor="oauth-client-type">应用类型</FieldLabel>
            <select
              id="oauth-client-type"
              value={values.type}
              onChange={(event) =>
                updateValue(
                  'type',
                  event.target.value as ClientEditorValues['type'],
                )
              }
              disabled={busy}
              className="h-10 border border-input bg-background px-3 text-sm"
            >
              <option value="web">Web</option>
              <option value="native">Native</option>
              <option value="user-agent-based">User Agent Based</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-logo-uri">Logo URL</FieldLabel>
            <Input
              id="oauth-client-logo-uri"
              value={values.logo_uri}
              onChange={(event) => updateValue('logo_uri', event.target.value)}
              disabled={busy}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-contacts">联系人</FieldLabel>
            <textarea
              id="oauth-client-contacts"
              value={values.contacts}
              onChange={(event) => updateValue('contacts', event.target.value)}
              disabled={busy}
              className="min-h-20 w-full border border-transparent border-b-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-b-ring"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-post-logout-uris">
              退出登录回调 URL
            </FieldLabel>
            <textarea
              id="oauth-client-post-logout-uris"
              value={values.post_logout_redirect_uris}
              onChange={(event) =>
                updateValue('post_logout_redirect_uris', event.target.value)
              }
              disabled={busy}
              className="min-h-20 w-full border border-transparent border-b-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-b-ring"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-tos-uri">服务条款 URL</FieldLabel>
            <Input
              id="oauth-client-tos-uri"
              value={values.tos_uri}
              onChange={(event) => updateValue('tos_uri', event.target.value)}
              disabled={busy}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-policy-uri">
              隐私政策 URL
            </FieldLabel>
            <Input
              id="oauth-client-policy-uri"
              value={values.policy_uri}
              onChange={(event) =>
                updateValue('policy_uri', event.target.value)
              }
              disabled={busy}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-software-id">
              Software ID
            </FieldLabel>
            <Input
              id="oauth-client-software-id"
              value={values.software_id}
              onChange={(event) =>
                updateValue('software_id', event.target.value)
              }
              disabled={busy}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-software-version">
              Software Version
            </FieldLabel>
            <Input
              id="oauth-client-software-version"
              value={values.software_version}
              onChange={(event) =>
                updateValue('software_version', event.target.value)
              }
              disabled={busy}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-software-statement">
              Software Statement
            </FieldLabel>
            <textarea
              id="oauth-client-software-statement"
              value={values.software_statement}
              onChange={(event) =>
                updateValue('software_statement', event.target.value)
              }
              disabled={busy}
              className="min-h-20 w-full border border-transparent border-b-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-b-ring"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? (
              <LoaderCircleIcon
                className="animate-spin"
                data-icon="inline-start"
              />
            ) : null}
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
