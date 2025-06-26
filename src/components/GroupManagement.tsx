import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { createServerGroup, updateServerGroup, deleteServerGroup } from "@/lib/nezha-api"
import { ServerGroup, NezhaServer } from "@/types/nezha-api"
import { TrashIcon, PencilIcon, PlusIcon } from "@heroicons/react/20/solid"

interface GroupManagementProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: ServerGroup[]
  servers: NezhaServer[]
}

interface EditingGroup {
  id?: number
  name: string
  servers: number[]
}

export default function GroupManagement({ open, onOpenChange, groups, servers }: GroupManagementProps) {
  const queryClient = useQueryClient()
  const [editingGroup, setEditingGroup] = useState<EditingGroup | null>(null)

  const createMutation = useMutation({
    mutationFn: ({ name, servers }: { name: string; servers: number[] }) =>
      createServerGroup(name, servers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-group"] })
      toast.success("分组创建成功")
      setEditingGroup(null)
    },
    onError: (error: Error) => {
      toast.error(`创建失败: ${error.message}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ groupId, name, servers }: { groupId: number; name: string; servers: number[] }) =>
      updateServerGroup(groupId, name, servers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-group"] })
      toast.success("分组更新成功")
      setEditingGroup(null)
    },
    onError: (error: Error) => {
      toast.error(`更新失败: ${error.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (groupId: number) => deleteServerGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-group"] })
      toast.success("分组删除成功")
    },
    onError: (error: Error) => {
      toast.error(`删除失败: ${error.message}`)
    },
  })

  const handleCreateGroup = () => {
    setEditingGroup({ name: "", servers: [] })
  }

  const handleEditGroup = (group: ServerGroup) => {
    setEditingGroup({
      id: group.group.id,
      name: group.group.name,
      servers: group.servers || []
    })
  }

  const handleSaveGroup = () => {
    if (!editingGroup?.name.trim()) {
      toast.error("请输入分组名称")
      return
    }

    if (editingGroup.id) {
      // 更新现有分组
      updateMutation.mutate({
        groupId: editingGroup.id,
        name: editingGroup.name,
        servers: editingGroup.servers
      })
    } else {
      // 创建新分组
      createMutation.mutate({
        name: editingGroup.name,
        servers: editingGroup.servers
      })
    }
  }

  const handleDeleteGroup = (groupId: number) => {
    if (window.confirm("确定要删除这个分组吗？")) {
      deleteMutation.mutate(groupId)
    }
  }

  const handleServerToggle = (serverId: number, checked: boolean) => {
    if (!editingGroup) return
    
    setEditingGroup(prev => ({
      ...prev!,
      servers: checked 
        ? [...prev!.servers, serverId]
        : prev!.servers.filter(id => id !== serverId)
    }))
  }

  const isServerInGroup = (serverId: number) => {
    return editingGroup?.servers.includes(serverId) || false
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>分组管理</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex gap-6">
          {/* 左侧：分组列表 */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">分组列表</h3>
              <Button
                size="sm"
                onClick={handleCreateGroup}
                disabled={createMutation.isPending}
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                新建分组
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3">
              {groups.map((group) => (
                <Card key={group.group.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{group.group.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {group.servers?.length || 0} 台服务器
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditGroup(group)}
                          disabled={updateMutation.isPending}
                        >
                          <PencilIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteGroup(group.group.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <TrashIcon className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {group.servers && group.servers.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-1">
                        {group.servers.map((serverId) => {
                          const server = servers.find(s => s.id === serverId)
                          return server ? (
                            <Badge key={serverId} variant="outline" className="text-xs">
                              {server.name}
                            </Badge>
                          ) : null
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>

          <Separator orientation="vertical" />

          {/* 右侧：编辑表单 */}
          <div className="w-96 overflow-hidden flex flex-col">
            {editingGroup ? (
              <>
                <h3 className="text-lg font-medium mb-4">
                  {editingGroup.id ? "编辑分组" : "创建分组"}
                </h3>
                
                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                  <div className="space-y-2">
                    <Label htmlFor="groupName">分组名称</Label>
                    <Input
                      id="groupName"
                      value={editingGroup.name}
                      onChange={(e) => setEditingGroup(prev => prev ? { ...prev, name: e.target.value } : null)}
                      placeholder="输入分组名称"
                    />
                  </div>
                  
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <Label className="mb-3">选择服务器</Label>
                    <div className="flex-1 overflow-y-auto space-y-2 border rounded-md p-3">
                      {servers.map((server) => (
                        <div key={server.id} className="flex items-center space-x-3">
                          <Checkbox
                            id={`server-${server.id}`}
                            checked={isServerInGroup(server.id)}
                            onCheckedChange={(checked) => handleServerToggle(server.id, !!checked)}
                          />
                          <Label 
                            htmlFor={`server-${server.id}`}
                            className="flex-1 cursor-pointer text-sm"
                          >
                            {server.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSaveGroup}
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="flex-1"
                    >
                      {editingGroup.id ? "更新分组" : "创建分组"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditingGroup(null)}
                      className="flex-1"
                    >
                      取消
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>选择一个分组进行编辑，或创建新分组</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 