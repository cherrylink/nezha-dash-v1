import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { toast } from "sonner"

interface ServerNetworkInfoProps {
  ip_address?: string
  asn?: string
  className?: string
  showInline?: boolean
}

export default function ServerNetworkInfo({ 
  ip_address, 
  asn, 
  className,
  showInline = false 
}: ServerNetworkInfoProps) {
  const { t } = useTranslation()
  const [copying, setCopying] = useState(false)

  // 如果没有网络信息，不显示组件
  if (!ip_address && !asn) {
    return null
  }

  const handleCopyIP = async () => {
    if (!ip_address || copying) return
    
    try {
      setCopying(true)
      await navigator.clipboard.writeText(ip_address)
      toast.success("IP地址已复制到剪贴板")
    } catch (error) {
      toast.error("复制失败")
      console.error("复制失败:", error)
    } finally {
      setTimeout(() => setCopying(false), 500)
    }
  }

  if (showInline) {
    // 内联显示模式（用于卡片视图）
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {ip_address && (
          <div 
            className={cn(
              "text-[10px] px-2 py-1 rounded border bg-background/50 font-mono cursor-pointer transition-colors hover:bg-accent/50",
              copying && "bg-green-100 dark:bg-green-900/20"
            )}
            onClick={handleCopyIP}
            title="点击复制IP地址"
          >
            {ip_address}
          </div>
        )}
        {asn && (
          <div className="text-[10px] px-2 py-1 rounded bg-muted/50 text-muted-foreground">
            {asn}
          </div>
        )}
      </div>
    )
  }

  // 详细显示模式（用于详情页）
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {ip_address && (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">{t("serverDetail.ipAddress")}</p>
          <div 
            className={cn(
              "text-xs font-mono bg-muted/50 px-2 py-1 rounded cursor-pointer transition-colors hover:bg-accent/50",
              copying && "bg-green-100 dark:bg-green-900/20"
            )}
            onClick={handleCopyIP}
            title="点击复制IP地址"
          >
            {ip_address}
          </div>
        </div>
      )}
      {asn && (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">{t("serverDetail.asn")}</p>
          <div className="text-xs bg-muted/50 px-2 py-1 rounded">{asn}</div>
        </div>
      )}
    </div>
  )
} 