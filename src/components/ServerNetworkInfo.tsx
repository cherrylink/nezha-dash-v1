import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

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

  // 如果没有网络信息，不显示组件
  if (!ip_address && !asn) {
    return null
  }

  if (showInline) {
    // 内联显示模式（用于卡片视图）
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {ip_address && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-5 font-mono bg-background/50"
                >
                  IP
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono">{ip_address}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {asn && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 h-5 bg-background/50"
                >
                  ASN
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{asn}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
          <div className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">{ip_address}</div>
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