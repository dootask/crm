// 跟进正文 HTML 消毒（仅服务端使用，依赖纯 Node 的 sanitize-html，无需 DOM）。
// 在保存时按白名单过滤，因此渲染端可直接信任库里的 HTML（见 rich-text-content.tsx）。

import sanitizeHtml from 'sanitize-html'

// 与 Tiptap 编辑器实际启用的扩展一一对应：段落/换行、加粗/斜体/下划线/删除线、
// 有序/无序列表、链接、图片。其余标签与全部 on* 事件属性一律剥除。
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'a',
    'img',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'data-transparent'],
  },
  // 链接只允许这些协议；javascript: / data: 等会被丢弃。
  allowedSchemes: ['http', 'https', 'mailto'],
  // 图片只允许 http(s)（相对路径如 /apps/crm/api/uploads/... 不带协议，默认放行）。
  allowedSchemesByTag: { img: ['http', 'https'] },
  // 外链统一新窗口打开并加防护 rel。
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    }),
  },
}

/** 消毒跟进正文 HTML，返回只含白名单标签的安全 HTML。 */
export function sanitizeFollowUpHtml(dirty: string): string {
  return sanitizeHtml(dirty, OPTIONS)
}

/** 去掉所有标签得到纯文本（用于「内容是否为空」判定）。 */
export function stripTags(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
}
