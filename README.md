### 配置网络

#### ap（热点）直连

1. **找到机械狗遥控器并连接上遥控器上的 WIFI**

2. **远程登陆**
   
    ```bash
    ssh firefly@192.168.234.1  # 默认密码：firefly
    ```
>  AP 直连时，机械狗 IP **固定**为 `192.168.234.1`，不会变化
    >
    >  用户名：`firefly` 密码：`firefly` 

3. **查看本地 IP**

     ```bash
    ip a
    ```

    ![1762423310618](https://youke1.picui.cn/s1/2025/11/06/690cae043f51d.png)

    > 这是机械狗 WIFI 分配给本地的局域网 IP

4. **修改 SDK 配置文件**

   ```bash
   sudo vim /opt/export/config/sdk_config.yaml
   ```

   ![1762423774051](https://youke1.picui.cn/s1/2025/11/06/690cae232ebae.png )

	> `target_ip` 修改为本地 IP，端口一般不用改

#### WIFI 局域网连接

1. **按照 [ap 直连步骤 1、2](####ap（热点）直连)，远程登陆**

2. **机械狗连接 WIFI**

   ```bash
   # 查看附近网络
   sudo nmcli device wifi list
   
   # 连接网络
   sudo nmcli device wifi connect WIFI名称 password 密码 ifname wlan0
   
   # 关闭网络清除服务
   sudo systemctl stop networkmanager-cleanup.service
   sudo systemctl disable networkmanager-cleanup.service
   
   # 自动连接
   sudo nmcli connection modify WIFI名称 connection.autoconnect yes
   ```

   ![1762437011780](https://youke1.picui.cn/s1/2025/11/06/690cae4408870.png)
   
   > 成功连接 WIFI 后，重新远程登录，这里会显示机械狗在局域网中的 IP
   
3. **本机连上 WIFI 后，使用机械狗局域网 IP 远程登录**

4. **编辑运控文件，添加变量**

   ```bash
   sudo vim /opt/app_launch/start_motion_control.sh
   ```
   
    在文件 `/opt/app_launch/start_motion_control.sh` 中，于 `export ROBOT_TYPE=P2` 行之后，新增一行环境变量配置： 

   ```bash
   export SDK_CLIENT_IP='【机械狗局域网IP地址】'
   ```
   
   完整示例（添加后）：
   
   ```bash
   #!/bin/bash
   sleep 10
   echo "start motion control"
   
   # 共享内存文件路径
   SHM_FILE="/dev/shm/spline_shm"
   
   # 循环检查设备是否存在
   while true; do
       if [ -e "$SHM_FILE" ]; then
           echo "共享内存文件 $SHM_FILE 已存在。"
           break
       else
           echo "共享内存文件 $SHM_FILE 不存在，等待 1 秒后重试..."
           sleep 1
       fi
   done
   
   # 共享内存文件存在后执行的命令
   echo "共享内存文件已准备好，可以执行后续操作。"
   
   sudo ifconfig lo multicast
   sudo route add -net 224.0.0.0 netmask 240.0.0.0 dev lo
   
   export LD_LIBRARY_PATH=/opt/export/mc/bin
   export ROBOT_TYPE=P2
export SDK_CLIENT_IP='192.168.1.116'  
   
   cd /opt/export/mc/bin && taskset -c 7 ./mc_ctrl r
   ```
   
   > 注意：直连模式要删除或注释 `SDK_CLIENT_IP`，然后重启运控

5. **参照 [ap 直连步骤 4](####ap（热点）直连)，修改 SDK 配置文件**

6. **重启运控**

    ```bash
    robot-launch restart 4
    ```
    
    > 注意：在重启运控之前必须让机械狗先卧倒！
    




### WSL 镜像网络模式

让 **局域网内任意设备**（手机、平板、另一台电脑）通过
`http://Windows局域网IP:端口` 直接访问 **WSL2** 里运行的服务（Flask、Node、Docker、SSH …）。

1. **一键创建并打开配置文件**

   ```powershell
   # 创建空文件（若已存在则跳过）
   New-Item -Path $env:USERPROFILE\.wslconfig -ItemType File -Force
   
   # 用记事本打开
   notepad $env:USERPROFILE\.wslconfig
   ```

2. **粘贴以下内容 → 保存 → 关闭记事本**

   ```ini
   # 全局 WSL2 配置
   [wsl2]
   # 关键：启用镜像网络，WSL2 与 Windows 共享同一张网卡
   networkingMode=mirrored
   ```
   
   > 说明：
   > `mirrored` 模式下，WSL2 拿到的 IP == Windows 局域网 IP，**无需再手动端口转发**。
   
3. **重启 WSL**

    ```powershell
    wsl --shutdown     # 完全关闭所有子系统
    wsl                # 重新进入默认实例
    ```