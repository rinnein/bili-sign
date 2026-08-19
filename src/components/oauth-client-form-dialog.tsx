import { useEffect, useMemo, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import type { OAuthClient } from '@better-auth/oauth-provider'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '#/components/ui/field'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import {
  normalizeOAuthGrantTypes,
  parseOAuthClientLines,
  toOAuthClientRequestValues,
  validateOAuthClientFormValues,
} from '#/lib/oauth-client-form'
import type { OAuthClientFormValues } from '#/lib/oauth-client-form'

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
  application_type?: 'web' | 'native'
  client_id_issued_at?: number
  created_at?: string
  updated_at?: string
  disabled?: boolean
  public?: boolean
}

export type RegisteredOAuthClient = {
  client_id: string
  client_secret?: string
  client_secret_expires_at?: number
  client_name?: string
  client_uri?: string
  redirect_uris?: Array<string>
  scope?: string
}

const DEFAULT_FORM_VALUES: OAuthClientFormValues = {
  client_name: '',
  client_uri: '',
  logo_uri: '',
  redirect_uris: '',
  scope: 'openid profile bili:public',
  contacts: '',
  tos_uri: '',
  policy_uri: '',
  software_id: '',
  software_version: '',
  software_statement: '',
  post_logout_redirect_uris: '',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  application_type: 'web',
}

const GRANT_TYPES = [
  ['authorization_code', 'Authorization Code'],
  ['refresh_token', 'Refresh Token'],
] as const

const TYPE_OPTIONS = [
  ['web', 'Web'],
  ['native', 'Native'],
] as const

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function toFormValues(client?: SafeOAuthClient | null): OAuthClientFormValues {
  if (!client) return DEFAULT_FORM_VALUES
  return {
    client_name: client.client_name ?? '',
    client_uri: client.client_uri ?? '',
    logo_uri: client.logo_uri ?? '',
    redirect_uris: client.redirect_uris.join('\n'),
    scope: client.scope ?? DEFAULT_FORM_VALUES.scope,
    contacts: client.contacts?.join('\n') ?? '',
    tos_uri: client.tos_uri ?? '',
    policy_uri: client.policy_uri ?? '',
    software_id: client.software_id ?? '',
    software_version: client.software_version ?? '',
    software_statement: client.software_statement ?? '',
    post_logout_redirect_uris:
      client.post_logout_redirect_uris?.join('\n') ?? '',
    grant_types: normalizeOAuthGrantTypes(
      client.grant_types ?? DEFAULT_FORM_VALUES.grant_types,
    ),
    response_types: client.response_types ?? DEFAULT_FORM_VALUES.response_types,
    application_type:
      client.application_type ?? DEFAULT_FORM_VALUES.application_type,
  }
}

function FieldValidation({ errors }: { errors: Array<unknown> }) {
  if (!errors.length) return null
  return (
    <FieldError>{errors.map((error) => String(error)).join('、')}</FieldError>
  )
}

function LabelWithRequirement({
  children,
  required = false,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <>
      <span>{children}</span>
      <span className="text-xs font-normal text-muted-foreground">
        {required ? '必填' : '可选'}
      </span>
    </>
  )
}

export function OAuthClientFormDialog({
  mode,
  client,
  open,
  onOpenChange,
  onSaved,
  onCreated,
}: {
  mode: 'create' | 'edit'
  client?: SafeOAuthClient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (client: OAuthClient) => void
  onCreated: (client: RegisteredOAuthClient) => void
}) {
  const initialValues = useMemo(() => toFormValues(client), [client])
  const [submitError, setSubmitError] = useState('')
  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      setSubmitError('')
      const validationError = validateOAuthClientFormValues(value, mode)
      if (validationError) {
        setSubmitError(validationError)
        return
      }

      try {
        const requestValues = toOAuthClientRequestValues(value, mode)
        if (mode === 'create') {
          const result = await authClient.oauth2.register({
            ...requestValues,
            token_endpoint_auth_method:
              requestValues.application_type === 'native'
                ? 'none'
                : 'client_secret_basic',
          })
          if (result.error) {
            throw new Error(result.error.message ?? 'Client 创建失败。')
          }
          onCreated(result.data)
          onOpenChange(false)
          return
        }

        if (!client) return
        const result = await authClient.oauth2.updateClient({
          client_id: client.client_id,
          update: requestValues,
        })
        if (result.error) {
          throw new Error(result.error.message ?? 'Client 更新失败。')
        }
        onSaved(result.data)
        onOpenChange(false)
      } catch (error) {
        setSubmitError(errorMessage(error, 'Client 保存失败。'))
      }
    },
  })

  useEffect(() => {
    if (open) {
      form.reset(initialValues)
      setSubmitError('')
    }
  }, [form, initialValues, open])

  const title = mode === 'create' ? '创建 OAuth Client' : '编辑 OAuth Client'
  const actionLabel = mode === 'create' ? '创建 Client' : '保存修改'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Client ID、Secret 和所有者不可修改。数组字段请每行填写一个值。
          </DialogDescription>
        </DialogHeader>
        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>
              {mode === 'create' ? '创建失败' : '更新失败'}
            </AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup className="gap-5">
            <form.Field
              name="client_name"
              validators={{
                onSubmit: ({ value }) =>
                  mode === 'create' && !value.trim()
                    ? '请填写应用名称。'
                    : undefined,
              }}
            >
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="oauth-client-name">
                    <LabelWithRequirement required={mode === 'create'}>
                      应用名称
                    </LabelWithRequirement>
                  </FieldLabel>
                  <Input
                    id="oauth-client-name"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    disabled={form.state.isSubmitting}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  <FieldValidation errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field
              name="client_uri"
              validators={{
                onSubmit: ({ value }) =>
                  mode === 'create' && !value.trim()
                    ? '请填写应用主页 URL。'
                    : undefined,
              }}
            >
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="oauth-client-uri">
                    <LabelWithRequirement required={mode === 'create'}>
                      应用主页 URL
                    </LabelWithRequirement>
                  </FieldLabel>
                  <Input
                    id="oauth-client-uri"
                    type="url"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    disabled={form.state.isSubmitting}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  <FieldValidation errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field
              name="redirect_uris"
              validators={{
                onSubmit: ({ value }) =>
                  parseOAuthClientLines(value).length
                    ? undefined
                    : '至少需要填写一个 OAuth 回调 URL。',
              }}
            >
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="oauth-client-redirect-uris">
                    <LabelWithRequirement required>
                      OAuth 回调 URL
                    </LabelWithRequirement>
                  </FieldLabel>
                  <textarea
                    id="oauth-client-redirect-uris"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    disabled={form.state.isSubmitting}
                    aria-invalid={field.state.meta.errors.length > 0}
                    className="min-h-24 w-full border border-transparent border-b-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-b-ring"
                  />
                  <FieldDescription>每行填写一个回调地址。</FieldDescription>
                  <FieldValidation errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="scope">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="oauth-client-scope">
                    <LabelWithRequirement>允许的 Scope</LabelWithRequirement>
                  </FieldLabel>
                  <Input
                    id="oauth-client-scope"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    disabled={form.state.isSubmitting}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="grant_types">
              {(field) => (
                <FieldSet>
                  <FieldLegend>
                    <LabelWithRequirement>授权能力</LabelWithRequirement>
                  </FieldLegend>
                  <FieldGroup className="gap-3">
                    {GRANT_TYPES.map(([value, label]) => (
                      <Field key={value} orientation="horizontal">
                        <Checkbox
                          checked={field.state.value.includes(value)}
                          onCheckedChange={(checked) =>
                            field.handleChange(
                              checked
                                ? [...field.state.value, value]
                                : field.state.value.filter(
                                    (item: string) => item !== value,
                                  ),
                            )
                          }
                          disabled={form.state.isSubmitting}
                        />
                        <FieldLabel>{label}</FieldLabel>
                      </Field>
                    ))}
                  </FieldGroup>
                  <FieldDescription>Grant type 可以多选。</FieldDescription>
                </FieldSet>
              )}
            </form.Field>
            <form.Field name="response_types">
              {(field) => (
                <FieldSet>
                  <FieldLegend>
                    <LabelWithRequirement>Response Type</LabelWithRequirement>
                  </FieldLegend>
                  <Field orientation="horizontal">
                    <Checkbox
                      checked={field.state.value.includes('code')}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked ? ['code'] : [])
                      }
                      disabled={form.state.isSubmitting}
                    />
                    <FieldLabel>code</FieldLabel>
                  </Field>
                  <FieldDescription>
                    当前 OAuth provider 必须保留 code。
                  </FieldDescription>
                </FieldSet>
              )}
            </form.Field>
            <form.Field name="application_type">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="oauth-client-application-type">
                    <LabelWithRequirement>应用类型</LabelWithRequirement>
                  </FieldLabel>
                  <select
                    id="oauth-client-application-type"
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(
                        () =>
                          event.target
                            .value as OAuthClientFormValues['application_type'],
                      )
                    }
                    disabled={form.state.isSubmitting}
                    className="h-10 border border-input bg-background px-3 text-sm"
                  >
                    {TYPE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </form.Field>
            <form.Field name="logo_uri">
              {(field) => (
                <TextField
                  id="oauth-client-logo-uri"
                  label="Logo URL"
                  value={field.state.value}
                  disabled={form.state.isSubmitting}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
            <form.Field name="contacts">
              {(field) => (
                <TextAreaField
                  id="oauth-client-contacts"
                  label="联系人"
                  description="每行填写一个联系人。"
                  value={field.state.value}
                  disabled={form.state.isSubmitting}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
            <form.Field name="post_logout_redirect_uris">
              {(field) => (
                <TextAreaField
                  id="oauth-client-post-logout-uris"
                  label="退出登录回调 URL"
                  description="每行填写一个地址；留空表示不发送。"
                  value={field.state.value}
                  disabled={form.state.isSubmitting}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
            <form.Field name="tos_uri">
              {(field) => (
                <TextField
                  id="oauth-client-tos-uri"
                  label="服务条款 URL"
                  value={field.state.value}
                  disabled={form.state.isSubmitting}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
            <form.Field name="policy_uri">
              {(field) => (
                <TextField
                  id="oauth-client-policy-uri"
                  label="隐私政策 URL"
                  value={field.state.value}
                  disabled={form.state.isSubmitting}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
            <form.Field name="software_id">
              {(field) => (
                <TextField
                  id="oauth-client-software-id"
                  label="Software ID"
                  value={field.state.value}
                  disabled={form.state.isSubmitting}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
            <form.Field name="software_version">
              {(field) => (
                <TextField
                  id="oauth-client-software-version"
                  label="Software Version"
                  value={field.state.value}
                  disabled={form.state.isSubmitting}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
            <form.Field name="software_statement">
              {(field) => (
                <TextAreaField
                  id="oauth-client-software-statement"
                  label="Software Statement"
                  value={field.state.value}
                  disabled={form.state.isSubmitting}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
          </FieldGroup>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => onOpenChange(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '正在保存…' : actionLabel}
                </Button>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TextField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        <LabelWithRequirement>{label}</LabelWithRequirement>
      </FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </Field>
  )
}

function TextAreaField({
  id,
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  id: string
  label: string
  description?: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        <LabelWithRequirement>{label}</LabelWithRequirement>
      </FieldLabel>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="min-h-20 w-full border border-transparent border-b-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-b-ring"
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  )
}
