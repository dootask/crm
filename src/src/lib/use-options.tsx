import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { api } from '#/lib/api'
import { CUSTOMER_STATUS, OPPORTUNITY_STAGE } from '#/lib/types'
import type { OptionCategory, OptionItem } from '#/lib/types'

type OptionsData = Record<OptionCategory, Array<OptionItem>>

// 与 badge.tsx 一致的默认 tone，仅用于构造首屏兜底项。
const DEFAULT_TONES: Record<string, string> = {
  lead: 'gray',
  following: 'blue',
  signed: 'green',
  lost: 'red',
  initial: 'gray',
  qualified: 'cyan',
  proposal: 'violet',
  negotiation: 'amber',
}

function defaultsFor(
  category: OptionCategory,
  constMap: Record<string, string>,
): Array<OptionItem> {
  return Object.entries(constMap).map(([value, label], i) => ({
    id: -(i + 1),
    category,
    value,
    label,
    tone: DEFAULT_TONES[value] ?? 'gray',
    sort_order: i,
    archived: 0,
  }))
}

// 选项尚未从后端加载时的兜底（避免首屏闪原始码值）。
const FALLBACK: OptionsData = {
  customer_status: defaultsFor('customer_status', CUSTOMER_STATUS),
  opportunity_stage: defaultsFor('opportunity_stage', OPPORTUNITY_STAGE),
}

interface OptionsContextValue {
  data: OptionsData
  refresh: () => void
}

const OptionsContext = createContext<OptionsContextValue>({
  data: FALLBACK,
  refresh: () => {},
})

/** 应用级 Provider：挂载后拉取 /options，供徽章与下拉使用。 */
export function OptionsProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OptionsData>(FALLBACK)

  const refresh = useCallback(() => {
    api<OptionsData>('/options')
      .then((d) => setData(d))
      .catch(() => {
        /* 加载失败保留兜底默认项 */
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(() => ({ data, refresh }), [data, refresh])
  return (
    <OptionsContext.Provider value={value}>{children}</OptionsContext.Provider>
  )
}

/** 触发全局选项重新加载（管理页增删改后调用）。 */
export function useOptionsRefresh(): () => void {
  return useContext(OptionsContext).refresh
}

/** 某分类「未停用」的选项（供新建/筛选下拉）。 */
export function useOptionList(category: OptionCategory): Array<OptionItem> {
  const { data } = useContext(OptionsContext)
  return useMemo(
    () => data[category].filter((o) => o.archived === 0),
    [data, category],
  )
}

export const useCustomerStatusOptions = () => useOptionList('customer_status')
export const useOpportunityStageOptions = () =>
  useOptionList('opportunity_stage')

/** 按 value 解析展示用 label + tone（含已停用，查不到则兜底灰色+原值）。 */
export function useOptionMeta(
  category: OptionCategory,
  value: string,
): { label: string; tone: string } {
  const { data } = useContext(OptionsContext)
  const found = data[category].find((o) => o.value === value)
  return found
    ? { label: found.label, tone: found.tone }
    : { label: value, tone: 'gray' }
}
