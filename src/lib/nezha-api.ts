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

// 分组管理API函数
export const createServerGroup = async (name: string, servers: number[] = []): Promise<{ success: boolean; error?: string }> => {
  const response = await fetch('/api/v1/server-group', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name.trim(),
      servers
    })
  })
  
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Create group failed')
  }
  
  return data
}

export const updateServerGroup = async (groupId: number, name: string, servers: number[]): Promise<{ success: boolean; error?: string }> => {
  const response = await fetch(`/api/v1/server-group/${groupId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name.trim(),
      servers
    })
  })
  
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Update group failed')
  }
  
  return data
}

export const deleteServerGroup = async (groupId: number): Promise<{ success: boolean; error?: string }> => {
  const response = await fetch(`/api/v1/server-group/${groupId}`, {
    method: 'DELETE'
  })
  
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Delete group failed')
  }
  
  return data
}

// WebShell相关API函数
export const createTerminalSession = async (serverId: number): Promise<{ 
  success: boolean; 
  data?: { 
    session_id: string; 
    server_id: number; 
    server_name: string; 
  }; 
  error?: string; 
}> => {
  const response = await fetch('/api/v1/terminal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 确保包含cookie
    body: JSON.stringify({
      server_id: serverId
    })
  })
  
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Create terminal session failed')
  }
  
  return data
}

export const getAuthToken = (): string | null => {
  // 尝试从cookie中获取token
  const cookies = document.cookie.split(';')
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === 'nz-jwt') {
      return value
    }
  }
  
  // 如果cookie中没有，尝试从localStorage获取
  return localStorage.getItem('nz-jwt') || localStorage.getItem('token')
}
