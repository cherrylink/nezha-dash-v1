import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { cn, copyToClipboard } from "@/lib/utils"
import { toast } from "sonner"
import { useLogin } from "@/hooks/use-login"
import { CommandLineIcon } from "@heroicons/react/20/solid"
import WebShell from "./WebShell"

interface ServerNetworkInfoProps {
  ip_address?: string
  asn?: string
  className?: string
  showInline?: boolean
  serverName?: string
  serverId?: number
}

export default function ServerNetworkInfo({ 
  ip_address, 
  asn, 
  className,
  showInline = false,
  serverName = "Unknown",
  serverId = 0
}: ServerNetworkInfoProps) {
  const { t } = useTranslation()
  const { isLogin } = useLogin()
  const [copying, setCopying] = useState(false)
  const [webShellOpen, setWebShellOpen] = useState(false)

  // 如果没有网络信息或未登录，不显示组件
  if (!ip_address && !asn) {
    return null
  }

  // 未登录时不显示IP地址和ASN信息
  if (!isLogin) {
    return null
  }

  const handleCopyIP = async (e: React.MouseEvent) => {
    e.stopPropagation() // 阻止事件冒泡
    if (!ip_address || copying) return
    
    try {
      setCopying(true)
      const success = await copyToClipboard(ip_address)
      
      if (success) {
        toast.success("IP地址已复制到剪贴板")
      } else {
        toast.error("复制失败，请手动复制")
      }
    } catch (error) {
      toast.error("复制失败，请手动复制")
      console.error("复制失败:", error)
    } finally {
      setTimeout(() => setCopying(false), 500)
    }
  }

  const handleWebShell = (e: React.MouseEvent) => {
    e.preventDefault() // 阻止默认行为
    e.stopPropagation() // 阻止事件冒泡
    setWebShellOpen(true)
  }

  if (showInline) {
    // 内联显示模式（用于卡片视图）
    return (
      <>
        <div className={cn("flex flex-col gap-0.5 text-xs", className)}>
          <div className="flex items-center gap-1">
            <button
              onClick={handleWebShell}
              className="webshell-button w-4 h-4 flex items-center justify-center text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title={isLogin ? "打开WebShell" : "请先登录"}
            >
              <CommandLineIcon className="w-3 h-3" />
            </button>
            {ip_address && (
              <div 
                className={cn(
                  "font-mono cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors truncate",
                  copying && "text-green-600 dark:text-green-400"
                )}
                onClick={handleCopyIP}
                title="点击复制IP地址"
              >
                {ip_address}
              </div>
            )}
          </div>
          {asn && (
            <div className="text-muted-foreground text-[10px] truncate">
              {asn}
            </div>
          )}
        </div>
        
        <WebShell
          open={webShellOpen}
          onOpenChange={setWebShellOpen}
          serverName={serverName}
          serverId={serverId}
        />
      </>
    )
  }

  // 详细显示模式（用于详情页）
  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {isLogin && (
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">WebShell</p>
            <button
              onClick={handleWebShell}
              className="webshell-button text-xs bg-muted/50 px-2 py-1 rounded cursor-pointer transition-colors hover:bg-accent/50 flex items-center gap-1"
              title="打开WebShell"
            >
              <CommandLineIcon className="w-3 h-3" />
              连接
            </button>
          </div>
        )}
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
      
      <WebShell
        open={webShellOpen}
        onOpenChange={setWebShellOpen}
        serverName={serverName}
        serverId={serverId}
      />
    </>
  )
} 