import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createTerminalSession } from "@/lib/nezha-api"
import { useLogin } from "@/hooks/use-login"

// 动态导入类型
type Terminal = any
type FitAddon = any

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
  const [terminalReady, setTerminalReady] = useState(false)
  
  const terminalRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // 初始化终端
  const initializeTerminal = useCallback(async () => {
    if (!terminalRef.current || xtermRef.current) return

    try {
      // 动态导入 xterm.js 模块
      const [
        { Terminal },
        { FitAddon },
        { WebLinksAddon }
      ] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-web-links')
      ])

      // 动态导入 CSS
      await import('@xterm/xterm/css/xterm.css')

      // 创建终端实例
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
        scrollback: 1000,
        allowProposedApi: true
      })

      // 创建插件
      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()

      // 加载插件
      terminal.loadAddon(fitAddon)
      terminal.loadAddon(webLinksAddon)

      // 打开终端
      terminal.open(terminalRef.current)
      
      // 适配大小
      fitAddon.fit()

      // 处理用户输入
      terminal.onData((data: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(data)
        }
      })

      // 保存引用
      xtermRef.current = terminal
      fitAddonRef.current = fitAddon

      // 显示欢迎信息
      terminal.writeln('\x1b[32m✓ WebShell 终端已初始化\x1b[0m')
      if (!isLogin) {
        terminal.writeln('\x1b[33m⚠ 请先登录后使用WebShell功能\x1b[0m')
      } else {
        terminal.writeln(`\x1b[36m→ 点击"连接"按钮连接到服务器 ${serverName}\x1b[0m`)
      }

      setTerminalReady(true)
    } catch (error) {
      console.error('终端初始化失败:', error)
      toast.error('终端初始化失败，请刷新页面重试')
    }
  }, [isLogin, serverName])

  // 清理终端
  const cleanupTerminal = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.dispose()
      xtermRef.current = null
    }
    if (fitAddonRef.current) {
      fitAddonRef.current = null
    }
    setTerminalReady(false)
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
            toast.success(`已连接到服务器 ${sessionData.server_name}`)
            
            if (xtermRef.current) {
              xtermRef.current.clear()
              xtermRef.current.writeln(`\x1b[32m✓ 已连接到服务器: ${sessionData.server_name}\x1b[0m`)
              xtermRef.current.writeln('\x1b[36m→ 终端已就绪，您可以开始输入命令\x1b[0m')
            }
            resolve()
          }
        }

        ws.onmessage = (event) => {
          if (!xtermRef.current) return

          if (event.data instanceof Blob) {
            const reader = new FileReader()
            reader.onload = () => {
              if (xtermRef.current && reader.result) {
                const arrayBuffer = reader.result as ArrayBuffer
                const uint8Array = new Uint8Array(arrayBuffer)
                const text = new TextDecoder('utf-8').decode(uint8Array)
                xtermRef.current.write(text)
              }
            }
            reader.readAsArrayBuffer(event.data)
          } else if (typeof event.data === 'string') {
            xtermRef.current.write(event.data)
          }
        }

        ws.onclose = (event) => {
          if (connectionStatus === 'connected') {
            console.warn('WebSocket连接已断开:', event.code, event.reason)
            if (event.code !== 1000) {
              setConnectionStatus('error')
              toast.error('连接断开，请重新连接')
              if (xtermRef.current) {
                xtermRef.current.writeln('\r\n\x1b[31m✗ 连接已断开\x1b[0m')
              }
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
  const handleConnect = useCallback(async () => {
    if (!isLogin) {
      toast.error('请先登录后再使用WebShell功能')
      return
    }

    if (!terminalReady) {
      toast.error('终端尚未初始化，请稍后重试')
      return
    }
    
    try {
      const sessionData = await createSession()
      await connectWebSocket(sessionData)
    } catch (error) {
      console.error('连接失败:', error)
      setConnectionStatus('error')
      toast.error(`连接失败: ${error instanceof Error ? error.message : '未知错误'}`)
      if (xtermRef.current) {
        xtermRef.current.writeln(`\r\n\x1b[31m✗ 连接失败: ${error instanceof Error ? error.message : '未知错误'}\x1b[0m`)
      }
    }
  }, [isLogin, terminalReady, createSession, connectWebSocket])

  // 断开连接
  const handleDisconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnectionStatus('disconnected')
    setSession(null)
    
    if (xtermRef.current) {
      xtermRef.current.writeln('\r\n\x1b[33m→ 连接已断开\x1b[0m')
    }
    toast.info('已断开连接')
  }, [])

  // 清屏
  const handleClear = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear()
    }
  }, [])

  // 窗口大小调整
  const handleResize = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit()
      }, 100)
    }
  }, [])

  // 初始化和清理
  useEffect(() => {
    if (open) {
      initializeTerminal()
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      cleanupTerminal()
      setConnectionStatus('disconnected')
      setSession(null)
    }
  }, [open, initializeTerminal, cleanupTerminal])

  // 窗口大小变化监听
  useEffect(() => {
    if (open && terminalReady) {
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [open, terminalReady, handleResize])

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
              
              {terminalReady && (
                <>
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
                </>
              )}
              
              {!terminalReady && (
                <Button size="sm" disabled>
                  初始化中...
                </Button>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            通过WebShell连接到服务器进行命令行操作
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div 
            ref={terminalRef}
            className="flex-1 border rounded"
            style={{ minHeight: '400px' }}
            onClick={() => {
              if (xtermRef.current && connectionStatus === 'connected') {
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