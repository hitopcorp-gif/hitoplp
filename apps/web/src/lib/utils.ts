import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// LPの公開アドレス（hi-top.net の在庫ページ）。中身は Worker が配り、hi-top.net 側（FIWサーバー）が取り次いで見せる。
export const LP_PUBLIC_BASE = 'https://hi-top.net/stock'
export const LP_PUBLIC_LABEL = 'hi-top.net/stock'
// hi-top.net に出るのは在庫一覧に載った車（公開中・SOLD）だけ。下書きの確認は Worker のアドレスで開く。
export const LP_DRAFT_BASE = 'https://hitoplp-api.hitopcorp.workers.dev'
export const LP_DRAFT_LABEL = 'hitoplp-api.hitopcorp.workers.dev'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    + '-' + Date.now().toString(36)
}

export function formatPrice(price: string, isAsk: boolean): string {
  if (isAsk) return 'ASK'
  return price
}
