<template>
  <div class="robot-preview">
    <div ref="canvasContainer" class="canvas-container"></div>
    <div class="preview-controls">
      <div class="control-row">
        <span class="label">当前时间:</span>
        <span class="value">{{ formatTime(currentTime) }}</span>
      </div>
      <div class="control-row">
        <span class="label">当前动作:</span>
        <span class="value">{{ currentActionName || '无' }}</span>
      </div>
      <div class="control-row">
        <el-button size="small" @click="resetView">重置视角</el-button>
        <el-button size="small" @click="toggleGrid">{{ showGrid ? '隐藏网格' : '显示网格' }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ActionBlock, Track } from '../types/timeline'

// 机器人预览组件
interface Props {
  currentTime: number // 当前时间
  isPlaying: boolean  // 是否正在播放
  tracks?: Track[]    // 动作轨道 
}

const props = withDefaults(defineProps<Props>(), {
  currentTime: 0,
  isPlaying: false,
  tracks: () => []
})

const canvasContainer = ref<HTMLDivElement | null>(null) // 渲染画布容器
const showGrid = ref(true) // 是否显示网格
const currentActionName = ref<string>('') // 当前动作名称

let scene: THREE.Scene                        // 场景
let camera: THREE.PerspectiveCamera           // 相机
let renderer: THREE.WebGLRenderer             // 渲染器
let controls: OrbitControls                   // 轨道控制
let robotModel: THREE.Group | null = null     // 机器人模型
let mixer: THREE.AnimationMixer | null = null // 动画混合器
let gridHelper: THREE.GridHelper              // 网格辅助器
let animationId: number | null = null         // 动画ID

// 存储机器人的默认姿态
let defaultPose: {
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
} | null = null

// 格式化时间
const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  const ms = Math.floor((time % 1) * 100)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
}

const initScene = () => {
  if (!canvasContainer.value) return

  // 创建场景
  scene = new THREE.Scene()
  const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--el-bg-color-page').trim()
  scene.background = new THREE.Color(bgColor || '#1a1a1a')

  // 创建相机
  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
  camera.position.set(3, 2, 3)
  camera.lookAt(0, 0.5, 0)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  canvasContainer.value.appendChild(renderer.domElement)

  // 添加轨道控制
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 0.5, 0)
  controls.update()

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 5)
  directionalLight.castShadow = true
  directionalLight.shadow.camera.near = 0.1
  directionalLight.shadow.camera.far = 50
  directionalLight.shadow.camera.left = -10
  directionalLight.shadow.camera.right = 10
  directionalLight.shadow.camera.top = 10
  directionalLight.shadow.camera.bottom = -10
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  scene.add(directionalLight)

  // 添加网格
  gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222)
  scene.add(gridHelper)

  // 添加地面
  const groundGeometry = new THREE.PlaneGeometry(10, 10)
  const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // 加载机器人模型
  loadRobotModel()

  // 开始渲染循环
  animate()

  // 处理窗口大小变化
  window.addEventListener('resize', handleResize)
}

const loadRobotModel = () => {
  const loader = new GLTFLoader()

  loader.load(
    '/models/robot_dog.glb',
    (gltf: any) => {
      const model = gltf.scene
      robotModel = model

      model.traverse((child: any) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      // 设置模型位置和缩放
      model.position.set(0, 0, 0)
      model.scale.set(1, 1, 1)

      scene.add(model)

      // 如果模型包含动画，创建动画混合器
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model)
        // 可以在这里处理内置动画
      }

      // 保存默认姿态
      saveDefaultPose()

      console.log('机器人模型加载成功')
    },
    (progress: any) => {
      const percent = (progress.loaded / progress.total) * 100
      console.log(`模型加载中: ${percent.toFixed(2)}%`)
    },
    (error: any) => {
      console.error('模型加载失败:', error)
    }
  )
}

const saveDefaultPose = () => {
  if (!robotModel) return

  defaultPose = {
    position: robotModel.position.clone(),
    rotation: robotModel.rotation.clone(),
    scale: robotModel.scale.clone()
  }
}

const animate = () => {
  animationId = requestAnimationFrame(animate)

  controls.update()

  // 更新动画混合器
  if (mixer) {
    mixer.update(0.016) // 假设60fps
  }

  renderer.render(scene, camera)
}

const handleResize = () => {
  if (!canvasContainer.value) return

  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()

  renderer.setSize(width, height)
}

const resetView = () => {
  camera.position.set(3, 2, 3)
  camera.lookAt(0, 0.5, 0)
  controls.target.set(0, 0.5, 0)
  controls.update()

  // 重置机器人姿态
  if (robotModel && defaultPose) {
    robotModel.position.copy(defaultPose.position)
    robotModel.rotation.copy(defaultPose.rotation)
    robotModel.scale.copy(defaultPose.scale)
  }
}

const toggleGrid = () => {
  showGrid.value = !showGrid.value
  if (gridHelper) {
    gridHelper.visible = showGrid.value
  }
}

// 根据当前时间更新机器人动画
const updateRobotAnimation = () => {
  if (!robotModel) return

  const time = props.currentTime
  currentActionName.value = ''

  // 遍历所有动作轨道
  for (const track of props.tracks) {
    if (track.type === 'action' && track.blocks && track.visible) {
      // 找到当前时间点正在执行的动作块
      for (const block of track.blocks) {
        const blockEndTime = block.startTime + block.duration

        if (time >= block.startTime && time < blockEndTime) {
          // 当前正在执行这个动作
          currentActionName.value = block.name
          const progress = (time - block.startTime) / block.duration

          // 应用动作到机器人模型
          applyActionToRobot(block, progress)
          break
        }
      }
    }
  }
}

// 应用动作到机器人模型
const applyActionToRobot = (block: ActionBlock, progress: number) => {
  if (!robotModel) return

  // 根据不同的动作类型应用不同的变换
  const actionType = block.actionType || ''

  // 重置到默认姿态
  if (defaultPose && progress === 0) {
    robotModel.position.copy(defaultPose.position)
    robotModel.rotation.copy(defaultPose.rotation)
  }

  // 根据动作类型应用变换
  switch (actionType) {
    case 'stand_up':
      applyStandUpAnimation(progress)
      break
    case 'lie_down':
      applyLieDownAnimation(progress)
      break
    case 'lean_left':
      applyLeanAnimation(progress, -1)
      break
    case 'lean_right':
      applyLeanAnimation(progress, 1)
      break
    case 'lean_forward':
      applyPitchAnimation(progress, 1)
      break
    case 'lean_backward':
      applyPitchAnimation(progress, -1)
      break
    case 'move_forward':
      applyMoveAnimation(progress, 1, 0)
      break
    case 'move_backward':
      applyMoveAnimation(progress, -1, 0)
      break
    case 'move_left':
      applyMoveAnimation(progress, 0, -1)
      break
    case 'move_right':
      applyMoveAnimation(progress, 0, 1)
      break
    case 'turn_left':
      applyTurnAnimation(progress, -1)
      break
    case 'turn_right':
      applyTurnAnimation(progress, 1)
      break
    case 'head_up':
      applyHeadAnimation(progress, -0.5, 0)
      break
    case 'head_down':
      applyHeadAnimation(progress, 0.5, 0)
      break
    case 'head_left':
      applyHeadAnimation(progress, 0, -0.8)
      break
    case 'head_right':
      applyHeadAnimation(progress, 0, 0.8)
      break
    case 'sit':
      applySitAnimation(progress)
      break
    case 'shake_hand':
      applyShakeHandAnimation(progress)
      break
    case 'jump':
      applyJumpAnimation(progress)
      break
    default:
      // 默认动作或自定义动作
      break
  }
}

// 站立动画
const applyStandUpAnimation = (progress: number) => {
  if (!robotModel || !defaultPose) return

  // 从趴下姿态过渡到站立姿态
  const startHeight = -0.3
  const endHeight = 0
  const currentHeight = startHeight + (endHeight - startHeight) * easeInOutCubic(progress)

  robotModel.position.y = defaultPose.position.y + currentHeight
}

// 趴下动画
const applyLieDownAnimation = (progress: number) => {
  if (!robotModel || !defaultPose) return

  const startHeight = 0
  const endHeight = -0.3
  const currentHeight = startHeight + (endHeight - startHeight) * easeInOutCubic(progress)

  robotModel.position.y = defaultPose.position.y + currentHeight
}

// 左右倾斜动画
const applyLeanAnimation = (progress: number, direction: number) => {
  if (!robotModel || !defaultPose) return

  const maxRoll = 0.3 * direction // 最大倾斜角度（弧度）
  const roll = maxRoll * Math.sin(progress * Math.PI)

  robotModel.rotation.z = defaultPose.rotation.z + roll
}

// 前后俯仰动画
const applyPitchAnimation = (progress: number, direction: number) => {
  if (!robotModel || !defaultPose) return

  const maxPitch = 0.25 * direction
  const pitch = maxPitch * Math.sin(progress * Math.PI)

  robotModel.rotation.x = defaultPose.rotation.x + pitch
}

// 移动动画
const applyMoveAnimation = (progress: number, forwardDir: number, strafeDir: number) => {
  if (!robotModel || !defaultPose) return

  const distance = 0.5 // 移动距离
  const x = strafeDir * distance * progress
  const z = -forwardDir * distance * progress

  robotModel.position.x = defaultPose.position.x + x
  robotModel.position.z = defaultPose.position.z + z

  // 添加行走的上下晃动
  const bounce = Math.sin(progress * Math.PI * 4) * 0.05
  robotModel.position.y = defaultPose.position.y + bounce
}

// 转向动画
const applyTurnAnimation = (progress: number, direction: number) => {
  if (!robotModel || !defaultPose) return

  const maxRotation = Math.PI / 4 * direction // 45度
  const rotation = maxRotation * progress

  robotModel.rotation.y = defaultPose.rotation.y + rotation
}

// 头部动画
const applyHeadAnimation = (progress: number, pitch: number, yaw: number) => {
  if (!robotModel) return

  // 查找头部骨骼或部件
  const head = robotModel.getObjectByName('head') || robotModel.getObjectByName('Head')

  if (head) {
    const targetPitch = pitch * Math.sin(progress * Math.PI)
    const targetYaw = yaw * Math.sin(progress * Math.PI)

    head.rotation.x = targetPitch
    head.rotation.y = targetYaw
  }
}

// 坐下动画
const applySitAnimation = (progress: number) => {
  if (!robotModel || !defaultPose) return

  const sitHeight = -0.2
  const currentHeight = sitHeight * easeInOutCubic(progress)

  robotModel.position.y = defaultPose.position.y + currentHeight

  // 后腿弯曲的效果（如果有骨骼）
  const backTilt = 0.2 * easeInOutCubic(progress)
  robotModel.rotation.x = defaultPose.rotation.x + backTilt
}

// 握手动画
const applyShakeHandAnimation = (progress: number) => {
  if (!robotModel) return

  // 查找前腿或手臂
  const rightFrontLeg = robotModel.getObjectByName('right_front_leg') ||
    robotModel.getObjectByName('RightFrontLeg')

  if (rightFrontLeg) {
    // 抬起前腿并摆动
    const lift = Math.sin(progress * Math.PI) * 0.5
    const shake = Math.sin(progress * Math.PI * 8) * 0.1

    rightFrontLeg.rotation.x = -lift
    rightFrontLeg.rotation.z = shake
  }
}

// 跳跃动画
const applyJumpAnimation = (progress: number) => {
  if (!robotModel || !defaultPose) return

  // 使用抛物线轨迹
  const jumpHeight = 0.5
  const height = jumpHeight * Math.sin(progress * Math.PI)

  robotModel.position.y = defaultPose.position.y + height

  // 添加轻微的前倾
  const pitch = Math.sin(progress * Math.PI * 2) * 0.1
  robotModel.rotation.x = defaultPose.rotation.x + pitch
}

// 缓动函数
const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// 监听时间变化
watch(() => props.currentTime, () => {
  updateRobotAnimation()
})

// 监听轨道变化
watch(() => props.tracks, () => {
  updateRobotAnimation()
}, { deep: true })

onMounted(() => {
  initScene()
})

onUnmounted(() => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
  }

  window.removeEventListener('resize', handleResize)

  if (renderer) {
    renderer.dispose()
  }

  if (controls) {
    controls.dispose()
  }
})
</script>

<style scoped lang="scss">
.robot-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color-page);
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;

  canvas {
    display: block;
  }
}

.preview-controls {
  padding: 12px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color);

  .control-row {
    display: flex;
    align-items: center;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-right: 8px;
      min-width: 70px;
    }

    .value {
      font-size: 12px;
      color: var(--el-text-color-primary);
      font-family: monospace;
    }

    .el-button {
      margin-right: 8px;

      &:last-child {
        margin-right: 0;
      }
    }
  }
}
</style>
