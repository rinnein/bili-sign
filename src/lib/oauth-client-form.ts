export type OAuthClientFormValues = {
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

export function parseOAuthClientLines(value: string) {
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

export function validateOAuthClientFormValues(
  values: OAuthClientFormValues,
  mode: 'create' | 'edit',
) {
  if (mode === 'create' && !values.client_name.trim()) {
    return '请填写应用名称。'
  }
  if (mode === 'create' && !values.client_uri.trim()) {
    return '请填写应用主页 URL。'
  }

  const redirectUris = parseOAuthClientLines(values.redirect_uris)
  if (!redirectUris.length) return '至少需要填写一个 OAuth 回调 URL。'
  if (!values.response_types.includes('code')) {
    return '当前 OAuth provider 必须保留 code response type。'
  }
  if (!values.grant_types.length) return '至少需要选择一个 Grant type。'

  try {
    validateHttpUrls(redirectUris, 'OAuth 回调 URL')
    const postLogoutRedirectUris = parseOAuthClientLines(
      values.post_logout_redirect_uris,
    )
    if (postLogoutRedirectUris.length) {
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
  } catch (error) {
    return errorMessage(error, '请输入有效的 URL。')
  }

  return null
}

export function toOAuthClientRequestValues(
  values: OAuthClientFormValues,
  mode: 'create' | 'edit',
) {
  const optionalCreateValue = (value: string) => {
    const trimmed = value.trim()
    return mode === 'create' && !trimmed ? undefined : trimmed
  }
  const contacts = parseOAuthClientLines(values.contacts)
  const postLogoutRedirectUris = parseOAuthClientLines(
    values.post_logout_redirect_uris,
  )

  return {
    client_name: values.client_name.trim(),
    client_uri: values.client_uri.trim(),
    logo_uri: optionalCreateValue(values.logo_uri),
    redirect_uris: parseOAuthClientLines(values.redirect_uris),
    scope: optionalCreateValue(values.scope),
    contacts: contacts.length ? contacts : undefined,
    tos_uri: optionalCreateValue(values.tos_uri),
    policy_uri: optionalCreateValue(values.policy_uri),
    software_id: optionalCreateValue(values.software_id),
    software_version: optionalCreateValue(values.software_version),
    software_statement: optionalCreateValue(values.software_statement),
    post_logout_redirect_uris: postLogoutRedirectUris.length
      ? postLogoutRedirectUris
      : undefined,
    grant_types: values.grant_types as Array<
      'authorization_code' | 'client_credentials' | 'refresh_token'
    >,
    response_types: values.response_types as Array<'code'>,
    type: values.type,
  }
}
