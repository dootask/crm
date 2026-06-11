import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Field } from '#/components/ui/form-field.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import { api, ApiError } from '#/lib/api'
import { searchDooTaskTasks } from '#/lib/dootask'
import type { DooTaskTaskHit } from '#/lib/dootask'

/** 关联选择结果：关联现有任务 或 创建并关联新任务。 */
export type TaskSelection =
  | { kind: 'existing'; task_id: number; title: string }
  | {
      kind: 'create'
      project_id: number
      column_id: number | null
      name: string
      title: string
    }

interface ProjectLite {
  id: number
  name: string
  columns: Array<{ id: number; name: string }>
}

/**
 * 关联任务选择器（搜索我的任务 / 创建并关联），客户与商机、详情页与新增对话框共用。
 * onPicked 由调用方完成实际关联（POST）；抛错则在弹窗内提示，成功则关闭。
 */
export function TaskPickerDialog({
  open,
  onOpenChange,
  onPicked,
  defaultName,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPicked: (sel: TaskSelection) => Promise<void>
  /** 「创建并关联」时任务标题的默认值（一般为客户/商机名）。 */
  defaultName?: string
}) {
  const [mode, setMode] = useState<'search' | 'create'>('search')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setMode('search')
      setError(null)
      setBusy(false)
    }
  }, [open])

  async function pick(sel: TaskSelection) {
    setBusy(true)
    setError(null)
    try {
      await onPicked(sel)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '关联失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>关联 DooTask 任务</DialogTitle>
        </DialogHeader>

        <div className="mb-1 flex gap-1 rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 ${mode === 'search' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            onClick={() => setMode('search')}
          >
            关联现有任务
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 ${mode === 'create' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            onClick={() => setMode('create')}
          >
            创建并关联
          </button>
        </div>

        {mode === 'search' ? (
          <SearchPane busy={busy} onPick={pick} />
        ) : (
          <CreatePane busy={busy} defaultName={defaultName} onPick={pick} />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}

function SearchPane({
  busy,
  onPick,
}: {
  busy: boolean
  onPick: (sel: TaskSelection) => void
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Array<DooTaskTaskHit>>([])
  const [loading, setLoading] = useState(false)
  // null = 独立模式，降级为手动输入任务 ID。
  const [standalone, setStandalone] = useState(false)
  const [manualId, setManualId] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const seq = useRef(0)

  useEffect(() => {
    const key = q.trim()
    if (!key) {
      setHits([])
      return
    }
    const my = ++seq.current
    setLoading(true)
    const t = setTimeout(async () => {
      const res = await searchDooTaskTasks(key)
      if (my !== seq.current) return
      if (res === null) {
        setStandalone(true)
        setHits([])
      } else {
        setHits(res)
      }
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  if (standalone) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          当前不在 DooTask 中，无法搜索，请手动输入任务 ID。
        </p>
        <Field label="任务 ID">
          <Input
            type="number"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="DooTask 任务 ID"
          />
        </Field>
        <Field label="备注（可选）">
          <Input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="便于识别的名称"
          />
        </Field>
        <DialogFooter>
          <Button
            disabled={busy}
            onClick={() => {
              const id = Number(manualId.trim())
              if (Number.isFinite(id) && id > 0)
                onPick({ kind: 'existing', task_id: id, title: manualTitle.trim() })
            }}
          >
            {busy ? '关联中…' : '关联'}
          </Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索我的任务…"
          className="pl-8"
        />
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 搜索中…
          </div>
        ) : q.trim() === '' ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            输入关键词搜索你参与的任务
          </p>
        ) : hits.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            未找到匹配的任务
          </p>
        ) : (
          <ul className="divide-y">
            {hits.map((t) => (
              <li key={t.task_id}>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent/50 disabled:opacity-60"
                  onClick={() =>
                    onPick({ kind: 'existing', task_id: t.task_id, title: t.name })
                  }
                >
                  <span className="text-sm font-medium">
                    {t.name || `任务 #${t.task_id}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #{t.task_id}
                    {t.project_name ? ` · ${t.project_name}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        只能关联你负责的任务（关联时会把 CRM 机器人加入该任务以推送动态）。
      </p>
    </div>
  )
}

function CreatePane({
  busy,
  defaultName,
  onPick,
}: {
  busy: boolean
  defaultName?: string
  onPick: (sel: TaskSelection) => void
}) {
  const [projects, setProjects] = useState<Array<ProjectLite> | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string>('')
  const [columnId, setColumnId] = useState<string>('')
  const [name, setName] = useState(defaultName ?? '')

  useEffect(() => {
    setName(defaultName ?? '')
  }, [defaultName])

  useEffect(() => {
    let cancelled = false
    api<{ items: Array<ProjectLite> }>('/dootask/projects')
      .then((res) => {
        if (cancelled) return
        setProjects(res.items)
      })
      .catch((e) => {
        if (!cancelled)
          setLoadErr(e instanceof ApiError ? e.message : '加载项目失败')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const project = projects?.find((p) => String(p.id) === projectId)

  if (loadErr) return <p className="py-6 text-sm text-destructive">{loadErr}</p>
  if (!projects)
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> 加载项目…
      </div>
    )
  if (projects.length === 0)
    return (
      <p className="py-6 text-sm text-muted-foreground">
        没有可用的项目，请先在 DooTask 中创建项目。
      </p>
    )

  return (
    <div className="space-y-3">
      <Field label="项目">
        <Select
          value={projectId}
          onValueChange={(v) => {
            setProjectId(v)
            setColumnId('')
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="列表">
        <Select
          value={columnId}
          onValueChange={setColumnId}
          disabled={!project || project.columns.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={project ? '选择列表（默认第一个）' : '请先选择项目'} />
          </SelectTrigger>
          <SelectContent>
            {project?.columns.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="任务标题">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="任务标题"
        />
      </Field>
      <DialogFooter>
        <Button
          disabled={busy || !projectId || !name.trim()}
          onClick={() =>
            onPick({
              kind: 'create',
              project_id: Number(projectId),
              column_id: columnId ? Number(columnId) : null,
              name: name.trim(),
              title: name.trim(),
            })
          }
        >
          <Plus className="size-4" />
          {busy ? '创建中…' : '创建并关联'}
        </Button>
      </DialogFooter>
    </div>
  )
}

/**
 * 把一个选择结果落库为任务关联（详情页：实体已存在；新增页：实体刚创建）。
 * 返回可能的 warning（关联成功但机器人未能接入任务聊天时），由调用方提示。
 */
export async function linkTaskSelection(
  entityType: 'customer' | 'opportunity',
  entityId: number,
  sel: TaskSelection,
): Promise<{ warning?: string }> {
  const json =
    sel.kind === 'existing'
      ? {
          entity_type: entityType,
          entity_id: entityId,
          task_id: sel.task_id,
          title: sel.title || undefined,
        }
      : {
          entity_type: entityType,
          entity_id: entityId,
          create: {
            project_id: sel.project_id,
            column_id: sel.column_id,
            name: sel.name,
          },
          title: sel.title || undefined,
        }
  const res = await api<{ warning?: string }>('/task-links', {
    method: 'POST',
    json,
  })
  return { warning: res?.warning }
}

/**
 * 逐条落库待关联任务（新增客户/商机后调用）。返回需要提示的文案
 * （失败的错误 + 成功但机器人未接入的 warning）；个别失败不抛出
 * （实体已创建，不应因关联失败而回滚）。
 */
export async function linkPendingTasks(
  entityType: 'customer' | 'opportunity',
  entityId: number,
  selections: Array<TaskSelection>,
): Promise<Array<string>> {
  const notices: Array<string> = []
  for (const sel of selections) {
    try {
      const { warning } = await linkTaskSelection(entityType, entityId, sel)
      if (warning) notices.push(warning)
    } catch (e) {
      notices.push(e instanceof ApiError ? e.message : '关联失败')
    }
  }
  return notices
}
