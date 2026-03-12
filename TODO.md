### 需求

1. 机器狗端：
   - 让摇杆指令编程如果有下一个指令，上一个还没执行的话就直接吞掉（udp？）

2. 前端观看视频，使用手机端推送给后端，然后后端转发给前端（mediasoup），推送机器狗的视频流不是用手机自带的摄像头
   1. 前端改成从手机发送 webrtc 视频流而到服务端（不是发送图片）
   2. 然后手机端在设置里面添加一个 switch，是否允许将视频流转发到服务端，默认开启（当然要服务器向手机端询问视频流时，手机端才向服务端（前端）发送）d:\elric\Code\Repos\robot-dog\app\robot-phone\RobotPhone\src\features\settings\screens\SettingsScreen.tsx
   3. 然后手机端向服务器发送时，会在手机端的机器人操作的顶部显示向云端上传的图标 d:\elric\Code\Repos\robot-dog\app\robot-phone\RobotPhone\src\features\robots\screens\RobotOperationScreen.tsx
   4. 点击后在右边显示弹窗正在向云端发送视频流（使用点击动作然后在右边显示的弹窗）（就是把手机的通过后端转发到前端）

3. 手机和前端反馈入口，还有管理员以上可以查看反馈

4. 现在先是群控、编舞，然后是ai优化、然后是手机上传音频、然后是音频识别、等等，然后是人脸识别、物品识别

5. 手机端如果关闭了对话页面，之前的聊天记录不会储存

6. 改一下动作的提示词
7. 下面的 bug
8. 走路速度等调整
9. https://grpc.org.cn/docs/what-is-grpc/introduction/
   让机器人端通过 grpc 连接到后端的 python 服务，然后把结果返回给 nodejs 服务
10. 让大模型调用工具而不是通过提示词来行动
    https://bailian.console.aliyun.com/cn-beijing/?spm=5176.29597918.J_SEsSjsNv72yRuRFS2VknO.2.55ed7b08Zvf6Yi&tab=doc#/doc/?type=model&url=2862208
11. 到时候支持将 robot-server 的账号密码发送到服务端（cloud）进行保存，然后手机端如果尝试密码错误后，从服务器获取最新的密码，防止改了密码后，手机端登录不了
12. 关闭 sdk 模式后，可以尝试让手机端通过智元自带的来控制移动
13. 实现 `last_action_before_disable` 功能
    - 当前 `application.py` 中定义了 `last_action_before_disable` 变量但未实际使用
    - 设计目的是记录关闭 SDK 模式时机器狗的最后动作状态
    - 需要在关闭 SDK 模式前记录当前动作，重新开启时恢复该状态

### 其他需求

还有文件内部的 TODO
