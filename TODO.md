### 主要需求

1. 实现远程更新

   - 服务端将机器狗的包下载到手机端，让手机端更新机器狗端
   - 服务器直接远程更新机器狗端

2. 优化大模型的各种内容

   - 比如：让 apikey 输入优化
   - 让使用的模型为真实的模型等等

3. 机器狗端：

   - 让摇杆指令编程如果有下一个指令，上一个还没执行的话就直接吞掉（udp？）

4. aaa

   1. 删除服务器端的 gstream 的视频流（这个原本是测试用的，现在不需要了）d:\elric\Code\Repos\robot-dog\app\robot-cloud\后端\src\modules\机器人交互\video-service.ts 改成成从手机发送 webrtc 视频流而到服务端（不是发送图片）（手机先拉机器狗视频，再转推到服务端，只有在手机进入机器狗操作页面是才可以拉，p2p 转发到前端）
   2. 然后手机端在设置里面添加一个 switch，是否允许将视频流转发到服务端，默认开启（当然要服务器向手机端询问视频流时，手机端才向服务端（前端）发送）d:\elric\Code\Repos\robot-dog\app\robot-
      phone\RobotPhone\src\features\settings\screens\SettingsScreen.tsx
   3. 然后手机端向服务器发送时，会在手机端的机器人操作的顶部显示向云端上传的图标 d:\elric\Code\Repos\robot-dog\app\robot-phone\RobotPhone\src\features\robots\screens\RobotOperationScreen.tsx
   4. 点击后在右边显示弹窗正在向云端发送视频流（使用点击动作然后在右边显示的弹窗）（就是把手机的通过后端转发到前端）1. 删除服务器端的 gstream 的视频流（这个原本是测试用的，现在不需要了）d:\elric\Code\Repos\robot-dog\app\robot-cloud\后端\src\modules\机器人交互\video-
      service.ts
      可以全部重构，不要向前兼容。可以全部重构，不要向前兼容。可以全部重构，不要向前兼容。

5. 将配置文件导出的功能，方便测试版回滚

   ```
   Android

    1 // 直接保存到 Download 目录，用户可在文件管理器访问
    2 const androidPath = '/storage/emulated/0/Download/robot-data.json';

   iOS

    1 // 保存到文档目录，用户可通过"文件"App 访问
    2 const iosPath = RNFS.DocumentDirectoryPath + '/robot-data.json';
    3
    4 // 可选：调用系统分享，让用户选择保存位置
    5 Share.share({
    6   url: 'file://' + path,
    7   title: '导出数据'
    8 });

   推荐实现

     1 import { Platform, Share } from 'react-native';
     2 import RNFetchBlob from 'react-native-blob-util';
     3
     4 const exportData = async (data: object) => {
     5   const json = JSON.stringify(data, null, 2);
     6   const filename = `robot-backup-${Date.now()}.json`;
     7
     8   if (Platform.OS === 'android') {
     9     // Android: 直接保存到 Download
    10     const path = RNFetchBlob.fs.dirs.DownloadDir + '/' + filename;
    11     await RNFetchBlob.fs.writeFile(path, json, 'utf8');
    12     Toast.show('已保存到 下载/robot-backup.json');
    13   } else {
    14     // iOS: 保存后调用系统分享
    15     const path = RNFetchBlob.fs.dirs.DocumentDir + '/' + filename;
    16     await RNFetchBlob.fs.writeFile(path, json, 'utf8');
    17
    18     // 让用户选择如何处理（保存到文件/分享等）
    19     await Share.share({
    20       url: 'file://' + path,
    21       title: '机器人数据备份'
    22     });
    23   }
    24 };

   用户体验

    - Android: 保存后通知用户去「文件管理器 → 下载」查看
    - iOS: 弹出系统分享菜单，用户可选择「存储到文件」或分享给其他人
   ```

6. 当手机连上机器狗热点（机器狗为 192.168.234.1）时，支持使用 ssh 将文件上传到机器狗（主要是第一次上传没有机器狗本地跑的文件）

### 次要需求

1. 改一下动作的提示词
2. 下面的 bug
3. 走路速度等调整
4. 知识库
5. 搞定群控
6. https://grpc.org.cn/docs/what-is-grpc/introduction/
   让机器人端通过 grpc 连接到后端的 python 服务，然后把结果返回给 nodejs 服务
7. 让大模型调用工具而不是通过提示词来行动
   https://bailian.console.aliyun.com/cn-beijing/?spm=5176.29597918.J_SEsSjsNv72yRuRFS2VknO.2.55ed7b08Zvf6Yi&tab=doc#/doc/?type=model&url=2862208
8. 到时候支持将 robot-server 的账号密码发送到服务端（cloud）进行保存，然后手机端如果尝试密码错误后，从服务器获取最新的密码，防止改了密码后，手机端登录不了
9. 关闭 sdk 模式后，可以尝试让手机端通过智元自带的来控制移动

### 其他需求

还有文件内部的 TODO

### 待整理到 docs 中的内容

1. 启动手机端的注意事项：
   - 要设置 ANDROID_HOME 环境变量，指向 android sdk 的安装目录,类似`C:\Users\<用户名>\AppData\Local\Android\Sdk`，java 要 java17（以上的没试过）
