import {
  ArrowRightIcon,
  BookOpenIcon,
  LockKeyholeIcon,
  PuzzleIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  KeyRoundIcon,
} from 'lucide-react'
import { Link, createFileRoute } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'

export const Route = createFileRoute('/docs')({ component: Docs })

function Docs() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12">
          <Badge variant="outline">DOCUMENTATION</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            安全、隐私与接入说明
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            这里集中放置验证原理和 OAuth 2.1
            接入细节，首页和验证页只保留完成任务所需的信息。
          </p>
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheckIcon />
                安全与隐私
              </CardTitle>
              <CardDescription>验证不依赖 B 站登录态。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
              <p>
                本服务只通过 B 站公开资料确认
                MID、昵称、头像、签名、粉丝、等级、VIP 和账号状态，不要求输入 B
                站密码，也不会获取或保存 Cookie、access token 或隐私接口响应。
              </p>
              <p>
                验证时需要临时修改个人签名。原签名只在当前标签页的
                sessionStorage
                中保存，用于完成后的恢复提示。请在个人设备上使用，并在验证完成后恢复原签名。
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockKeyholeIcon />
                验证流程
              </CardTitle>
              <CardDescription>
                一次性 challenge 会绑定 MID 和有效期。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
              <ol className="flex list-decimal flex-col gap-2 pl-5">
                <li>
                  在
                  <Link to="/verify" className="mx-1">
                    验证页面
                  </Link>
                  输入 B 站 MID，确认公开资料。
                </li>
                <li>复制服务生成的临时签名指令，前往 B 站个人设置写入签名。</li>
                <li>
                  返回服务确认，服务端重新读取公开签名并完成注册、登录或绑定。
                </li>
                <li>复制页面缓存的原签名，恢复 B 站设置。</li>
              </ol>
              <Separator />
              <p>
                如果 challenge
                过期或签名不匹配，请重新查询并生成新的指令。challenge
                不能重复消费。
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenIcon />
                OAuth 2.1 接入
              </CardTitle>
              <CardDescription>
                仅支持 authorization code + S256 PKCE。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
              <p>
                授权服务提供 discovery、动态客户端注册、授权码、token、userinfo
                和 OIDC metadata 端点。客户端必须使用 S256
                PKCE，不支持隐式授权。
              </p>
              <p>
                可申请的 scope 只有 <code>openid</code>、<code>profile</code> 和{' '}
                <code>bili:public</code>。只有明确申请 `bili:public`
                时，userinfo 才会返回当前绑定的公开 B 站 MID。
              </p>
              <p>
                创建 Client 需要先登录本服务，请前往
                <Link to="/developer" className="mx-1">
                  开发者设置
                </Link>
                填写应用名称、主页 URL 和 OAuth 回调 URL。
              </p>
              <pre className="overflow-x-auto border bg-muted p-4 text-xs leading-6">
                <code>
                  {[
                    'GET /.well-known/oauth-authorization-server',
                    'GET /.well-known/openid-configuration',
                    'GET /oauth2/authorize',
                    'POST /oauth2/token',
                    'GET /oauth2/userinfo',
                    'POST /oauth2/register',
                  ].join('\n')}
                </code>
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRoundIcon />
                登录方式
              </CardTitle>
              <CardDescription>登录页支持多种设备登录方式。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
              <p>
                <Link to="/login" className="underline underline-offset-4">
                  登录页
                </Link>
                支持 B 站签名登录和 Passkey 登录。B
                站登录同时覆盖新用户注册、已有用户登录和已登录用户绑定。
              </p>
              <p className="flex items-start gap-2">
                <SmartphoneIcon className="mt-1 size-4 shrink-0" />
                已登录设备可以在账户面板生成一次性设备登录码，复制到其它设备的登录页使用。设备码过期或使用后不可再次使用。
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PuzzleIcon />
                浏览器插件能力
              </CardTitle>
              <CardDescription>插件能力按声明逐项启用。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
              <p>
                网站会通过 `window.postMessage`
                与插件握手。插件返回名称、版本和能力列表后，网站才会显示对应功能。
              </p>
              <div className="grid gap-3">
                <div>
                  <code>bili.mid.read</code>
                  <p>向验证页提供当前 B 站 MID，用于自动预填。</p>
                </div>
                <div>
                  <code>bili.api.proxy</code>
                  <p>
                    代理 B
                    站请求，优先覆盖当前账号读取、公开资料和签名验证；响应可能包含用户主动授权的登录态资料。
                  </p>
                </div>
                <div>
                  <code>bili.direct-login</code>
                  <p>自动完成临时签名、验证和原签名恢复。</p>
                </div>
              </div>
              <p>
                代理请求使用 <code>bili.api.request</code>，只接受 B 站 HTTPS
                地址和 GET/POST 方法。签名写入使用 <code>user_sign</code>，CSRF
                由插件在本地注入；快捷登录恢复使用可等待的
                <code>direct-login.finish</code>{' '}
                请求，网站确认恢复成功后才会继续。
              </p>
              <Separator />
              <p>
                插件可以在本地使用自身的 B
                站登录状态来完成请求转发或自动签名操作。网站不会接收插件的
                Cookie、CSRF、access token、refresh token
                或密码，但代理响应可能包含当前登录态允许读取的资料；
                只有在信任插件和当前网站时才应启用该能力。握手必须回传网站提供的
                nonce，请求使用 requestId，网站会校验来源、超时和响应字段。
              </p>
              <pre className="overflow-x-auto border bg-muted p-4 text-xs leading-6">
                <code>
                  {[
                    'bili-sign:hello',
                    'bili-sign:ready',
                    'bili-sign:request',
                    'bili-sign:response',
                    'bili-sign:event',
                  ].join('\n')}
                </code>
              </pre>
            </CardContent>
          </Card>
          <Alert>
            <ShieldCheckIcon />
            <AlertTitle>需要开始验证？</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              使用 B 站签名完成所有权验证。
              <Button asChild size="sm">
                <Link to="/login">
                  前往登录
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </AppShell>
  )
}
