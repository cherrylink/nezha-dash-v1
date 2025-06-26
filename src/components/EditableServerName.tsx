import React, { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { updateServerName } from "@/lib/nezha-api"
import { Input } from "./ui/input"

interface EditableServerNameProps {
  serverId: number
  initialName: string
  className?: string
  onNameUpdate?: (newName: string) => void
}

export default function EditableServerName({ 
  serverId, 
  initialName, 
  className,
  onNameUpdate 
}: EditableServerNameProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = async () => {
    if (name.trim() === initialName || !name.trim()) {
      setIsEditing(false)
      setName(initialName)
      return
    }

    setIsLoading(true)
    try {
      await updateServerName(serverId, name.trim())
      toast.success("服务器名称更新成功")
      setIsEditing(false)
      onNameUpdate?.(name.trim())
    } catch (error) {
      toast.error("更新失败: " + (error instanceof Error ? error.message : String(error)))
      setName(initialName)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setName(initialName)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        disabled={isLoading}
        className={cn("h-6 text-xs px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600", className)}
        maxLength={50}
      />
    )
  }

  return (
    <p 
      className={cn(
        "break-normal font-bold tracking-tight cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 transition-colors",
        className
      )}
      onClick={() => setIsEditing(true)}
      title="点击编辑服务器名称"
    >
      {name}
    </p>
  )
} 