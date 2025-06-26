import { LoginUserResponse, MonitorResponse, ServerGroupResponse, ServiceResponse, SettingResponse } from "@/types/nezha-api"

let lastestRefreshTokenAt = 0

export const fetchServerGroup = async (): Promise<ServerGroupResponse> => {
  const response = await fetch("/api/v1/server-group")
  const data = await response.json()
  if (data.error) {
    throw new Error(data.error)
  }
  return data
}

export const fetchLoginUser = async (): Promise<LoginUserResponse> => {
  const response = await fetch("/api/v1/profile")
  const data = await response.json()
  if (data.error) {
    throw new Error(data.error)
  }

  // auto refresh token
  if (document.cookie && (!lastestRefreshTokenAt || Date.now() - lastestRefreshTokenAt > 1000 * 60 * 60)) {
    lastestRefreshTokenAt = Date.now()
    fetch("/api/v1/refresh-token")
  }

  return data
}

export const fetchMonitor = async (server_id: number): Promise<MonitorResponse> => {
  const response = await fetch(`/api/v1/service/${server_id}`)
  const data = await response.json()
  if (data.error) {
    throw new Error(data.error)
  }
  return data
}

export const fetchService = async (): Promise<ServiceResponse> => {
  const response = await fetch("/api/v1/service")
  const data = await response.json()
  if (data.error) {
    throw new Error(data.error)
  }
  return data
}

export const fetchSetting = async (): Promise<SettingResponse> => {
  const response = await fetch("/api/v1/setting")
  const data = await response.json()
  if (data.error) {
    throw new Error(data.error)
  }
  return data
}

export const updateServerName = async (serverId: number, name: string): Promise<{ success: boolean; error?: string }> => {
  const response = await fetch(`/api/v1/server/${serverId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name.trim()
    })
  })
  
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Update failed')
  }
  
  return data
}
