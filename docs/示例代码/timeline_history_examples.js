// 时间线编辑器历史记录功能 - 使用示例

/**
 * 1. 基本操作示例
 */

// 添加轨道 - 会自动记录到历史
timelineEditor.addTrack(TrackType.ACTION)
// 历史记录: "添加动作轨道 1"

// 删除轨道 - 会自动记录到历史
timelineEditor.deleteTrack('track-1')
// 历史记录: "删除动作轨道 1"

// 撤回
timelineEditor.handleUndo()
// 结果: 轨道恢复

// 重做
timelineEditor.handleRedo()
// 结果: 轨道再次被删除

/**
 * 2. 动作块操作示例
 */

// 添加动作块
timelineEditor.addActionBlock('track-1')
// 历史记录: "在动作轨道 1中添加动作块"

// 编辑动作块
timelineEditor.editActionBlock('track-1', block)
// 用户在对话框中选择动作...
// 历史记录: "更新动作轨道 1中的站立"

// 删除动作块
timelineEditor.deleteSelectedBlock('track-1')
// 历史记录: "从动作轨道 1中删除动作块"

/**
 * 3. 机器狗绑定示例
 */

// 绑定机器狗到轨道
timelineEditor.selectRobotForTrack('track-1')
// 用户选择机器狗...
timelineEditor.confirmRobotSelection()
// 历史记录: "动作轨道 1 绑定到 机器狗A"

// 解除绑定
// 选择"取消绑定"选项...
// 历史记录: "动作轨道 1 解除绑定"

/**
 * 4. 跳转到历史点示例
 */

// 假设当前有以下历史:
// [0] 添加动作轨道 1
// [1] 添加动作块
// [2] 更新动作块 -> 站立
// [3] 添加动作块
// [4] 更新动作块 -> 行走 (当前位置)

// 跳转到索引 1（添加第一个动作块）
timelineEditor.handleJumpTo(1)
// 结果: 撤销了所有后续操作，回到只有一个空动作块的状态

/**
 * 5. 键盘快捷键示例
 */

// 用户按下 Ctrl+Z
// -> 自动调用 handleUndo()

// 用户按下 Ctrl+Shift+Z 或 Ctrl+Y
// -> 自动调用 handleRedo()

/**
 * 6. 历史记录数据结构示例
 */

const exampleHistoryRecord = {
  id: "history-1",
  type: HistoryActionType.ADD_TRACK,
  description: "添加动作轨道 1",
  timestamp: 1702876543210,
  trackId: "track-1",
  trackName: "动作轨道 1",
  data: {
    before: undefined,  // 添加操作没有 before 状态
    after: {            // 完整的轨道对象
      id: "track-1",
      name: "动作轨道 1",
      type: TrackType.ACTION,
      locked: false,
      visible: true,
      height: 85,
      blocks: []
    }
  }
}

/**
 * 7. 完整工作流示例
 */

// 1. 创建项目，添加第一个轨道
addTrack(TrackType.ACTION)

// 2. 绑定机器狗
selectRobotForTrack('track-1')
confirmRobotSelection()  // 选择 "机器狗A"

// 3. 添加动作
addActionBlock('track-1')
editActionBlock('track-1', block1)  // 设置为"站立"

// 4. 再添加一个动作
addActionBlock('track-1')
editActionBlock('track-1', block2)  // 设置为"行走"

// 5. 哎呀，"行走"参数设置错了，撤回
handleUndo()  // 撤销"更新动作块 -> 行走"

// 6. 重新设置
editActionBlock('track-1', block2)  // 重新设置为"行走"（参数正确）

// 7. 继续添加音频轨道
addTrack(TrackType.AUDIO)
updateTrackAudio('track-2', 'audio.mp3')

// 此时的历史记录:
// [0] 添加动作轨道 1
// [1] 动作轨道 1 绑定到 机器狗A
// [2] 在动作轨道 1中添加动作块
// [3] 更新动作轨道 1中的站立
// [4] 在动作轨道 1中添加动作块
// [5] 更新动作轨道 1中的行走 (当前位置)
// [6] 添加音频轨道 2
// [7] 更新音频轨道 2的音频

/**
 * 8. 测试撤回/重做链
 */

// 从当前位置撤回到开头
while (canUndo()) {
  handleUndo()
}
// 结果: 回到空白时间线

// 重做所有操作
while (canRedo()) {
  handleRedo()
}
// 结果: 回到最终状态

/**
 * 9. 分支测试
 */

// 当前在历史位置 5
// [0] 添加动作轨道 1
// [1] 添加动作块
// [2] 更新为站立
// [3] 添加动作块
// [4] 更新为行走
// [5] 添加音频轨道 (当前)
// [6] 更新音频

// 撤回两步
handleUndo()  // 回到 [4]
handleUndo()  // 回到 [3]

// 现在添加新操作
addTrack(TrackType.KEYFRAME)

// 历史变为:
// [0] 添加动作轨道 1
// [1] 添加动作块
// [2] 更新为站立
// [3] 添加动作块
// [4] 添加关键帧轨道 (新操作，[5]和[6]被删除)
