import React, { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createTerminalSession, getAuthToken } from "@/lib/nezha-api"
import { useLogin } from "@/hooks/use-login"

interface WebShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverName: string
  serverId: number
}

interface TerminalSession {
  session_id: string
  server_id: number
  server_name: string
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export default function WebShell({ open, onOpenChange, serverName, serverId }: WebShellProps) {
  const { isLogin } = useLogin()
  const [command, setCommand] = useState("")
  const [terminalOutput, setTerminalOutput] = useState("")
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [session, setSession] = useState<TerminalSession | null>(null)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [reconnectCount, setReconnectCount] = useState(0)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  // 清理连接
  const cleanupConnection = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnectionStatus('disconnected')
    setSession(null)
  }, [])

  // 创建终端会话
  const createSession = useCallback(async () => {
    try {
      setConnectionStatus('connecting')
      const token = getAuthToken()
      if (!token) {
        throw new Error('未找到认证token，请先登录')
      }

      const response = await createTerminalSession(serverId)
      if (response.success && response.data) {
        setSession(response.data)
        return response.data
      } else {
        throw new Error(response.error || '创建终端会话失败')
      }
    } catch (error) {
      setConnectionStatus('error')
      throw error
    }
  }, [serverId])

  // 建立WebSocket连接
  const connectWebSocket = useCallback(async (sessionData: TerminalSession) => {
    try {
      const token = getAuthToken()
      if (!token) {
        throw new Error('未找到认证token')
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/api/v1/ws/terminal/${sessionData.session_id}?token=${encodeURIComponent(token)}`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      return new Promise<void>((resolve, reject) => {
        let isResolved = false
        
        ws.onopen = () => {
          if (!isResolved) {
            isResolved = true
            setConnectionStatus('connected')
            setTerminalOutput('')
            setReconnectCount(0)
            toast.success(`已连接到服务器 ${sessionData.server_name}`)
            resolve()
          }
        }

        ws.onmessage = (event) => {
          if (event.data instanceof Blob) {
            // 处理二进制消息（终端输出）
            const reader = new FileReader()
            reader.onload = () => {
              const arrayBuffer = reader.result as ArrayBuffer
              const uint8Array = new Uint8Array(arrayBuffer)
              const output = new TextDecoder('utf-8').decode(uint8Array)
              setTerminalOutput(prev => prev + output)
              scrollToBottom()
            }
            reader.readAsArrayBuffer(event.data)
          } else if (typeof event.data === 'string') {
            // 处理文本消息
            setTerminalOutput(prev => prev + event.data)
            scrollToBottom()
          }
        }

        ws.onclose = (event) => {
          if (connectionStatus === 'connected') {
            console.warn('WebSocket连接已断开:', event.code, event.reason)
            if (event.code !== 1000) { // 非正常关闭
              setConnectionStatus('error')
              toast.error('连接断开，请重新连接')
            } else {
              setConnectionStatus('disconnected')
            }
          }
        }

        ws.onerror = (error) => {
          console.error('WebSocket错误:', error)
          if (!isResolved) {
            isResolved = true
            setConnectionStatus('error')
            reject(new Error('WebSocket连接失败'))
          }
        }

        // 5秒超时
        setTimeout(() => {
          if (!isResolved) {
            isResolved = true
            reject(new Error('连接超时'))
          }
        }, 5000)
      })
    } catch (error) {
      setConnectionStatus('error')
      throw error
    }
  }, [connectionStatus, scrollToBottom])

  // 连接到服务器
  const handleConnect = useCallback(async () => {
    if (!isLogin) {
      toast.error('请先登录后再使用WebShell功能')
      return
    }
    
    try {
      const sessionData = await createSession()
      await connectWebSocket(sessionData)
    } catch (error) {
      console.error('连接失败:', error)
      setConnectionStatus('error')
      toast.error(`连接失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }, [isLogin, createSession, connectWebSocket])

  // 断开连接
  const handleDisconnect = useCallback(() => {
    cleanupConnection()
    setTerminalOutput('')
    setCommand('')
    setCommandHistory([])
    setHistoryIndex(-1)
    toast.info('已断开连接')
  }, [cleanupConnection])

  // 发送命令
  const sendCommand = useCallback((cmd: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // 发送文本消息到服务器
      wsRef.current.send(cmd)
      
      // 添加到命令历史
      if (cmd.trim()) {
        setCommandHistory(prev => [...prev.slice(-49), cmd.trim()])
        setHistoryIndex(-1)
      }
    }
  }, [])

  // 执行命令
  const executeCommand = useCallback(() => {
    if (!command.trim() || connectionStatus !== 'connected') return

    const cmd = command + '\r'
    sendCommand(cmd)
    setCommand('')
  }, [command, connectionStatus, sendCommand])

  // 清除终端输出
  const clearTerminal = useCallback(() => {
    setTerminalOutput('')
  }, [])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      executeCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setCommand(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1)
          setCommand("")
        } else {
          setHistoryIndex(newIndex)
          setCommand(commandHistory[newIndex])
        }
      }
    } else if (e.ctrlKey && e.key === 'c') {
      // Ctrl+C 中断命令
      e.preventDefault()
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('\x03') // 发送中断信号
      }
    } else if (e.ctrlKey && e.key === 'l') {
      // Ctrl+L 清屏
      e.preventDefault()
      clearTerminal()
    }
  }, [executeCommand, commandHistory, historyIndex, clearTerminal])

  // 效果钩子
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  // 组件卸载时清理连接
  useEffect(() => {
    return () => {
      cleanupConnection()
    }
  }, [cleanupConnection])

  // 自动重连逻辑
  useEffect(() => {
    if (connectionStatus === 'error' && session && reconnectCount < 3) {
      const timer = setTimeout(() => {
        setReconnectCount(prev => prev + 1)
        toast.info(`正在尝试重连 (${reconnectCount + 1}/3)...`)
        connectWebSocket(session).catch(() => {
          // 重连失败，继续等待下次重试
        })
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [connectionStatus, session, reconnectCount, connectWebSocket])

  // 获取连接状态显示文本
  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connecting': return '连接中...'
      case 'connected': return '已连接'
      case 'error': return '连接错误'
      default: return '未连接'
    }
  }

  // 获取连接状态颜色
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connecting': return 'text-yellow-600 dark:text-yellow-400'
      case 'connected': return 'text-green-600 dark:text-green-400'
      case 'error': return 'text-red-600 dark:text-red-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

    return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>WebShell - {serverName}</span>
            <div className="flex items-center gap-3">
              <span className={cn("text-xs flex items-center gap-1", getStatusColor())}>
                <span className={cn("w-2 h-2 rounded-full", {
                  'bg-green-500': connectionStatus === 'connected',
                  'bg-yellow-500': connectionStatus === 'connecting',
                  'bg-red-500': connectionStatus === 'error',
                  'bg-gray-500': connectionStatus === 'disconnected'
                })}></span>
                {getStatusText()}
              </span>
              
              {connectionStatus === 'disconnected' && (
                <Button size="sm" onClick={handleConnect} disabled={!isLogin}>
                  连接
                </Button>
              )}
              
              {connectionStatus === 'connecting' && (
                <Button size="sm" disabled>
                  连接中...
                </Button>
              )}
              
              {connectionStatus === 'connected' && (
                <Button size="sm" variant="destructive" onClick={handleDisconnect}>
                  断开
                </Button>
              )}
              
              {connectionStatus === 'error' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleConnect}>
                    重连
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleDisconnect}>
                    断开
                  </Button>
                </div>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            通过WebShell连接到服务器进行命令行操作
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* 终端输出区域 */}
          <div 
            className="flex-1 border rounded bg-black text-green-400 font-mono text-sm p-4 overflow-y-auto whitespace-pre-wrap" 
            ref={scrollRef}
            style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
          >
            {connectionStatus === 'disconnected' ? (
              <div className="text-center text-gray-400 py-8">
                <p>WebShell 终端</p>
                <p className="text-xs mt-2">
                  {!isLogin ? "请先登录后使用WebShell功能" : `点击"连接"按钮连接到服务器 ${serverName}`}
                </p>
              </div>
            ) : connectionStatus === 'connecting' ? (
              <div className="text-center text-yellow-400 py-8">
                <p>正在连接到服务器...</p>
              </div>
            ) : connectionStatus === 'error' ? (
              <div className="text-center text-red-400 py-8">
                <p>连接失败</p>
                <p className="text-xs mt-2">请检查网络连接或服务器状态</p>
              </div>
            ) : (
              <div>{terminalOutput || <div className="text-gray-400">等待终端初始化...</div>}</div>
            )}
          </div>
          
          {/* 命令输入区域 */}
          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 mt-4 p-3 border rounded bg-black">
              <span className="text-blue-400 font-mono text-sm shrink-0">$</span>
              <Input
                ref={inputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入命令..."
                className="bg-transparent border-none text-green-400 font-mono focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
              />
            </div>
          )}
          
          {connectionStatus === 'connected' && (
            <div className="text-xs text-muted-foreground mt-2 flex justify-between">
              <span>提示: ↑↓ 浏览历史 | Ctrl+C 中断 | Ctrl+L 清屏</span>
              <span>会话: {session?.session_id.slice(0, 8)}...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 