import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Bot, CheckCircle2 } from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import { messageError, messageSuccess } from '#/lib/message'
import { AdminGate } from '#/components/admin/admin-gate.tsx'
import { BreadcrumbBar } from '#/components/detail/breadcrumb-bar.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Field } from '#/components/ui/form-field.tsx'
import { Loading, PageHeader } from '#/components/ui/misc.tsx'

const DEFAULT_BOT_NAME = 'CRM机器人'

export const Route = createFileRoute('/admin/settings')({
  component: SettingsPage,
})

interface NotifySettings {
  bot_configured: boolean
  bot_userid: number | null
  bot_name: string | null
  notify_enabled: boolean
}

function SettingsPage() {
  return (
    <div>
      <BreadcrumbBar
        items={[{ label: '管理', to: '/admin' }, { label: '动态推送' }]}
      />
      <AdminGate>
        <SettingsManager />
      </AdminGate>
    </div>
  )
}

function SettingsManager() {
  const [data, setData] = useState<NotifySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function reload() {
    const res = await api<NotifySettings>('/admin/settings')
    setData(res)
    setName(res.bot_name || DEFAULT_BOT_NAME)
  }

  async function saveName() {
    const v = name.trim()
    if (v.length < 2 || v.length > 20) {
      messageError('机器人名称需 2-20 个字符')
      return
    }
    setSavingName(true)
    try {
      const res = await api<NotifySettings>('/admin/settings', {
        method: 'PUT',
        json: { bot_name: v },
      })
      setData(res)
      setName(res.bot_name || DEFAULT_BOT_NAME)
      messageSuccess('已保存机器人名称')
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '保存失败')
    } finally {
      setSavingName(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    reload()
      .catch((e) => {
        if (!cancelled)
          messageError(e instanceof ApiError ? e.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 清除已缓存的机器人：下次关联任务时会用操作人账号重新自动创建。
  async function resetBot() {
    setResetting(true)
    try {
      const res = await api<NotifySettings>('/admin/settings', {
        method: 'PUT',
        json: { bot_token: '' },
      })
      setData(res)
      messageSuccess('已重置，下次关联任务时会重新创建机器人')
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '操作失败')
    } finally {
      setResetting(false)
    }
  }

  async function toggleNotify() {
    if (!data) return
    setToggling(true)
    try {
      const res = await api<NotifySettings>('/admin/settings', {
        method: 'PUT',
        json: { notify_enabled: !data.notify_enabled },
      })
      setData(res)
      messageSuccess(res.notify_enabled ? '已开启动态推送' : '已关闭动态推送')
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '操作失败')
    } finally {
      setToggling(false)
    }
  }

  if (loading || !data) {
    return (
      <Card className="py-0">
        <CardContent className="p-0">
          <Loading center />
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        title="动态推送"
        description="客户/商机变更与跟进到期，由 CRM 机器人推送到关联任务的聊天"
      />

      <div className="grid gap-4">
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="size-4" />
              CRM 机器人
            </div>
            <Field
              label="机器人名称"
              hint="动态以该名称的机器人身份发送；修改后会同步重命名已创建的机器人。"
            >
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={DEFAULT_BOT_NAME}
                  maxLength={20}
                />
                <Button onClick={saveName} disabled={savingName}>
                  {savingName ? '保存中…' : '保存'}
                </Button>
              </div>
            </Field>
            {data.bot_configured ? (
              <>
                <p className="flex items-center gap-1.5 text-sm text-green-600">
                  <CheckCircle2 className="size-4" />
                  已就绪：{data.bot_name}（#{data.bot_userid}）
                </p>
                <p className="text-sm text-muted-foreground">
                  动态以该机器人身份发送。如机器人异常，可重置后在下次关联任务时重新创建。
                </p>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={resetting}
                  onClick={resetBot}
                >
                  {resetting ? '重置中…' : '重置机器人'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                无需手动配置：首次关联任务时，会用你的账号自动创建一个「CRM机器人」并接入任务群，之后复用。
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">动态推送总开关</p>
              <p className="text-sm text-muted-foreground">
                关闭后不再向任务聊天发送任何 CRM 动态与到期提醒。
              </p>
            </div>
            <Button
              variant={data.notify_enabled ? 'default' : 'outline'}
              disabled={toggling}
              onClick={toggleNotify}
            >
              {data.notify_enabled ? '已开启' : '已关闭'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
