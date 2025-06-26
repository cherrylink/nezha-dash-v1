import ServerFlag from "@/components/ServerFlag"
import ServerUsageBar from "@/components/ServerUsageBar"
import ServerNetworkInfo from "@/components/ServerNetworkInfo"
import EditableServerName from "@/components/EditableServerName"
import { formatBytes } from "@/lib/format"
import { GetFontLogoClass, GetOsName, MageMicrosoftWindows } from "@/lib/logo-class"
import { cn, formatNezhaInfo, parsePublicNote } from "@/lib/utils"
import { NezhaServer } from "@/types/nezha-api"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import PlanInfo from "./PlanInfo"
import BillingInfo from "./billingInfo"
import { Card } from "./ui/card"
import { Separator } from "./ui/separator"

export default function ServerCardInline({ now, serverInfo }: { now: number; serverInfo: NezhaServer }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { name, country_code, online, cpu, up, down, mem, stg, platform, uptime, net_in_transfer, net_out_transfer, public_note, ip_address, asn } = formatNezhaInfo(
    now,
    serverInfo,
  )

  const cardClick = (e: React.MouseEvent) => {
    // 如果点击的是可编辑名称组件，不触发导航
    if ((e.target as HTMLElement).closest('.editable-server-name')) {
      return
    }
    sessionStorage.setItem("fromMainPage", "true")
    navigate(`/server/${serverInfo.id}`)
  }

  const showFlag = true

  const customBackgroundImage = (window.CustomBackgroundImage as string) !== "" ? window.CustomBackgroundImage : undefined

  const parsedData = parsePublicNote(public_note)

  return online ? (
    <section>
      <Card
        className={cn(
          "flex items-center lg:flex-row justify-start gap-3 p-3 md:px-5 cursor-pointer hover:bg-accent/50 transition-colors min-w-[1200px] w-full",
          {
            "bg-card/70": customBackgroundImage,
          },
        )}
        onClick={cardClick}
      >
        <section className={cn("grid items-center gap-2 min-w-[144px] flex-shrink-0")} style={{ gridTemplateColumns: "auto auto 1fr" }}>
          <span className="h-2 w-2 shrink-0 rounded-full bg-green-500 self-center"></span>
          <div className={cn("flex items-center justify-center", showFlag ? "min-w-[17px]" : "min-w-0")}>
            {showFlag ? <ServerFlag country_code={country_code} /> : null}
          </div>
          <div className="relative flex flex-col min-w-[112px] flex-1">
            <div className="editable-server-name">
              <EditableServerName
                serverId={serverInfo.id}
                initialName={name}
                className={cn(showFlag ? "text-xs " : "text-sm")}
              />
            </div>
            {parsedData?.billingDataMod && <BillingInfo parsedData={parsedData} />}
          </div>
        </section>
        <Separator orientation="vertical" className="h-8 mx-0 ml-2" />
        <div className="flex flex-col gap-1">
          <section className={cn("grid grid-cols-10 items-center gap-3 flex-1")}>
            <div className={"flex w-32 flex-col"}>
              <p className="text-xs text-muted-foreground">{t("serverDetail.ipAddress")}</p>
              <ServerNetworkInfo 
                ip_address={ip_address} 
                asn={asn} 
                showInline={true}
                serverName={name}
                serverId={serverInfo.id}
              />
            </div>
            <div className={"items-center flex flex-row gap-2 whitespace-nowrap"}>
              <div className="text-xs font-semibold">
                {platform.includes("Windows") ? (
                  <MageMicrosoftWindows className="size-[10px]" />
                ) : (
                  <p className={`fl-${GetFontLogoClass(platform)}`} />
                )}
              </div>
              <div className={"flex w-14 flex-col"}>
                <p className="text-xs text-muted-foreground">{t("serverCard.system")}</p>
                <div className="flex items-center text-[10.5px] font-semibold">{platform.includes("Windows") ? "Windows" : GetOsName(platform)}</div>
              </div>
            </div>
            <div className={"flex w-24 flex-col"}>
              <p className="text-xs text-muted-foreground">{t("serverCard.uptime")}</p>
              <div className="flex items-center text-xs font-semibold">
                {uptime / 86400 >= 1
                  ? `${(uptime / 86400).toFixed(0)} ${t("serverCard.days")}`
                  : `${(uptime / 3600).toFixed(0)} ${t("serverCard.hours")}`}
              </div>
            </div>
            <div className={"flex w-14 flex-col"}>
              <p className="text-xs text-muted-foreground">{"CPU"}</p>
              <div className="flex items-center text-xs font-semibold">{cpu.toFixed(2)}%</div>
              <ServerUsageBar value={cpu} />
            </div>
            <div className={"flex w-14 flex-col"}>
              <p className="text-xs text-muted-foreground">{t("serverCard.mem")}</p>
              <div className="flex items-center text-xs font-semibold">{mem.toFixed(2)}%</div>
              <ServerUsageBar value={mem} />
            </div>
            <div className={"flex w-14 flex-col"}>
              <p className="text-xs text-muted-foreground">{t("serverCard.stg")}</p>
              <div className="flex items-center text-xs font-semibold">{stg.toFixed(2)}%</div>
              <ServerUsageBar value={stg} />
            </div>
            <div className={"flex w-20 flex-col"}>
              <p className="text-xs text-muted-foreground">{t("serverCard.upload")}</p>
              <div className="flex items-center text-xs font-semibold">
                {up >= 1024 ? `${(up / 1024).toFixed(2)}G/s` : up >= 1 ? `${up.toFixed(2)}M/s` : `${(up * 1024).toFixed(2)}K/s`}
              </div>
            </div>
            <div className={"flex w-20 flex-col"}>
              <p className="text-xs text-muted-foreground">{t("serverCard.download")}</p>
              <div className="flex items-center text-xs font-semibold">
                {down >= 1024 ? `${(down / 1024).toFixed(2)}G/s` : down >= 1 ? `${down.toFixed(2)}M/s` : `${(down * 1024).toFixed(2)}K/s`}
              </div>
            </div>
            <div className={"flex w-24 flex-col"}>
              <p className="text-xs text-muted-foreground">{t("serverCard.totalUpload")}</p>
              <div className="flex items-center text-xs font-semibold">{formatBytes(net_out_transfer)}</div>
            </div>
            <div className={"flex w-24 flex-col"}>
              <p className="text-xs text-muted-foreground">{t("serverCard.totalDownload")}</p>
              <div className="flex items-center text-xs font-semibold">{formatBytes(net_in_transfer)}</div>
            </div>
          </section>
          {parsedData?.planDataMod && <PlanInfo parsedData={parsedData} />}
        </div>
      </Card>
    </section>
  ) : (
    <Card
      className={cn(
        "flex  min-h-[61px] min-w-[1200px] items-center justify-start p-3 md:px-5 flex-row cursor-pointer hover:bg-accent/50 transition-colors",
        {
          "bg-card/70": customBackgroundImage,
        },
      )}
      onClick={cardClick}
    >
      <section className={cn("grid items-center gap-2 min-w-[160px] flex-shrink-0")} style={{ gridTemplateColumns: "auto auto 1fr" }}>
        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 self-center"></span>
        <div className={cn("flex items-center justify-center", showFlag ? "min-w-[17px]" : "min-w-0")}>
          {showFlag ? <ServerFlag country_code={country_code} /> : null}
        </div>
        <div className="relative flex flex-col min-w-[112px] flex-1">
          <div className="editable-server-name">
            <EditableServerName
              serverId={serverInfo.id}
              initialName={name}
              className={cn(showFlag ? "text-xs" : "text-sm")}
            />
          </div>
          {parsedData?.billingDataMod && <BillingInfo parsedData={parsedData} />}
        </div>
      </section>
      <Separator orientation="vertical" className="h-8 ml-3 lg:ml-1 mr-3" />
      {parsedData?.planDataMod && <PlanInfo parsedData={parsedData} />}
    </Card>
  )
}
