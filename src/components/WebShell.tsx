import React, { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createTerminalSession } from "@/lib/nezha-api"
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [session, setSession] = useState<TerminalSession | null>(null)
  const [reconnectCount, setReconnectCount] = useState(0)
  
  const terminalRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const xtermRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)

  // 初始化 xterm.js
  const initializeTerminal = useCallback(async () => {
    if (!terminalRef.current || xtermRef.current) return

    try {
      // 动态导入 xterm.js 和插件
      const { Terminal } = await import('xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')
      
      // 导入 CSS
      await import('xterm/css/xterm.css')

      const terminal = new Terminal({
        cursorBlink: true,
        theme: {
          background: '#000000',
          foreground: '#00ff00',
          cursor: '#00ff00',
          selectionBackground: '#ffffff40',
        },
        fontSize: 14,
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        rows: 24,
        cols: 80,
      })

      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()

      terminal.loadAddon(fitAddon)
      terminal.loadAddon(webLinksAddon)

      terminal.open(terminalRef.current)
      fitAddon.fit()

      // 处理用户输入
      terminal.onData((data) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(data)
        }
      })

      xtermRef.current = terminal
      fitAddonRef.current = fitAddon

      // 显示欢迎信息
      if (connectionStatus === 'disconnected') {
        terminal.writeln('\x1b[32mWebShell 终端\x1b[0m')
        terminal.writeln(!isLogin ? '请先登录后使用WebShell功能' : `点击"连接"按钮连接到服务器 ${serverName}`)
      }
    } catch (error) {
      console.error('Failed to initialize terminal:', error)
      toast.error('终端初始化失败，请刷新页面重试')
    }
  }, [connectionStatus, isLogin, serverName])

  // 清理终端
  const cleanupTerminal = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
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
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/api/v1/ws/terminal/${sessionData.session_id}`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      return new Promise<void>((resolve, reject) => {
        let isResolved = false
        
        ws.onopen = () => {
          if (!isResolved) {
            isResolved = true
            setConnectionStatus('connected')
            setReconnectCount(0)
            toast.success(`已连接到服务器 ${sessionData.server_name}`)
            
            // 清空终端并显示连接成功信息
            if (xtermRef.current) {
              xtermRef.current.clear()
              xtermRef.current.writeln(`\x1b[32m已连接到服务器: ${sessionData.server_name}\x1b[0m`)
            }
            resolve()
          }
        }

        ws.onmessage = (event) => {
          if (xtermRef.current) {
            if (event.data instanceof Blob) {
              // 处理二进制消息
              const reader = new FileReader()
              reader.onload = () => {
                const arrayBuffer = reader.result as ArrayBuffer
                const uint8Array = new Uint8Array(arrayBuffer)
                const output = new TextDecoder('utf-8').decode(uint8Array)
                xtermRef.current.write(output)
              }
              reader.readAsArrayBuffer(event.data)
            } else if (typeof event.data === 'string') {
              // 处理文本消息
              xtermRef.current.write(event.data)
            }
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
  }, [connectionStatus])

  // 连接到服务器
  const handleConnect = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
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
    if (xtermRef.current) {
      xtermRef.current.clear()
      xtermRef.current.writeln('\x1b[33m连接已断开\x1b[0m')
    }
    toast.info('已断开连接')
  }, [cleanupConnection])

  // 清除终端
  const handleClear = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear()
    }
  }, [])

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

  // 初始化和清理
  useEffect(() => {
    if (open) {
      initializeTerminal()
    }
    return () => {
      cleanupConnection()
      cleanupTerminal()
    }
  }, [open, initializeTerminal, cleanupConnection, cleanupTerminal])

  // 窗口大小变化时调整终端大小
  useEffect(() => {
    if (open && fitAddonRef.current) {
      const handleResize = () => {
        setTimeout(() => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit()
          }
        }, 100)
      }

      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [open])

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
      <DialogContent 
        className="max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        onMouseUp={(e) => {
          e.stopPropagation()
        }}
      >
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
              
              {connectionStatus === 'connected' && (
                <Button size="sm" variant="outline" onClick={handleClear}>
                  清屏
                </Button>
              )}
              
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
          {/* xterm.js 终端容器 */}
          <div 
            ref={terminalRef}
            className="flex-1 border rounded bg-black"
            style={{ minHeight: '400px' }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // 聚焦到终端
              if (xtermRef.current) {
                xtermRef.current.focus()
              }
            }}
          />
          
          {connectionStatus === 'connected' && session && (
            <div className="text-xs text-muted-foreground mt-2 flex justify-between">
              <span>提示: 使用标准终端快捷键 | Ctrl+C 中断 | Ctrl+L 清屏</span>
              <span>会话: {session.session_id.slice(0, 8)}...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 