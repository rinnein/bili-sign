import { LoaderCircleIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { authFetch } from '#/lib/auth-client'

export type ClientListScope = 'mine' | 'all'

export type SafeOAuthClient = {
  client_id: string
  user_id?: string
  client_name?: string
  client_uri?: string
  redirect_uris: Array<string>
  scope?: string
  created_at?: string
  updated_at?: string
}

export function OAuthClientManager({
  allowScopeSwitch = false,
  refreshKey = 0,
}: {
  allowScopeSwitch?: boolean
  refreshKey?: number
}) {
  const [scope, setScope] = useState<ClientListScope>('mine')
  const [clients, setClients] = useState<Array<SafeOAuthClient>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<SafeOAuthClient | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void authFetch(`/api/admin/clients?scope=${scope}`, {
      credentials: 'include',
    })
      .then(async (response) => {
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
        if (!cancelled) setClients(result)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setClients([])
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Client 列表读取失败。',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, scope])

  async function deleteClient() {
    if (!selected) return
    setDeleting(true)
    setError('')
    try {
      const response = await authFetch('/api/admin/clients', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selected.client_id }),
      })
      const result = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(result.message ?? 'Client 删除失败。')
      setClients((current) =>
        current.filter((client) => client.client_id !== selected.client_id),
      )
      setSelected(null)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Client 删除失败。',
      )
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
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>操作失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="animate-spin" />
            正在读取…
          </div>
        ) : clients.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyTitle>还没有 Client</EmptyTitle>
              <EmptyDescription>创建应用后会显示在这里。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>应用</TableHead>
                {scope === 'all' ? <TableHead>创建者</TableHead> : null}
                <TableHead>回调地址</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="w-0 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.client_id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">
                        {client.client_name || '未命名应用'}
                      </span>
                      <code className="text-xs text-muted-foreground">
                        {client.client_id}
                      </code>
                      {client.client_uri ? (
                        <a
                          href={client.client_uri}
                          target="_blank"
                          rel="noreferrer"
                          className="max-w-56 truncate text-xs text-muted-foreground underline underline-offset-4"
                        >
                          {client.client_uri}
                        </a>
                      ) : null}
                    </div>
                  </TableCell>
                  {scope === 'all' ? (
                    <TableCell>
                      <code className="text-xs">{client.user_id ?? '—'}</code>
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <span className="max-w-64 truncate text-xs text-muted-foreground">
                      {client.redirect_uris.join(', ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(client.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`删除 ${client.client_name || client.client_id}`}
                      onClick={() => setSelected(client)}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    </Card>
  )
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('zh-CN')
}
