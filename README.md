## 打开操控设备

>   多选一

### Ubuntu物理机模式

推荐使用Ubuntu22.04，其他版本要配置python环境

#### 配置 python 环境

>   Ubuntu22.04 不用

1.   **安装编译Python所需的依赖**

     ```bash
     sudo apt update
     sudo apt install -y build-essential libssl-dev zlib1g-dev \
     libncurses5-dev libncursesw5-dev libreadline-dev libsqlite3-dev \
     libgdbm-dev libdb5.3-dev libbz2-dev libexpat1-dev liblzma-dev \
     tk-dev libffi-dev wget curl git
     ```

2.   **安装 pyenv**

     ```bash
     curl https://pyenv.run | bash
     ```

     安装完成后，需要把 pyenv 添加到 shell 配置文件（如 `~/.bashrc` 或 `~/.zshrc`）：

     ```bash
     # 添加到 ~/.bashrc 的底部
     export PATH="$HOME/.pyenv/bin:$PATH" # 把pyenv添加到PATH中
     eval "$(pyenv init --path)"          # 初始化pyenv
     eval "$(pyenv virtualenv-init -)"    # 初始化pyenv的virtualenv插件
     
     # 为 python3 创建别名（可选）
     alias python=python3
     alias pip=pip3
     ```

     然后 **重新加载 shell**，并检查 pyenv 是否安装成功

     ```bash
     source ~/.bashrc
     pyenv --version
     ```

3.    **安装 Python 3.10**

     ```bash
     pyenv update          # 确保 pyenv 使用的是最新的 Python 构建信息
     pyenv install 3.10.19 # 安装 Python 3.10.19
     ```

     >   如果出现 `md5sum mismatch` 或下载错误，可以手动先下载源码，再放到 pyenv 缓存目录：
     >
     >   ```bash
     >   mkdir -p ~/.pyenv/cache
     >   wget https://www.python.org/ftp/python/3.10.19/Python-3.10.19.tgz -O ~/.pyenv/cache/Python-3.10.19.tgz
     >   pyenv install 3.10.19
     >   ```
     >
     >   注：编译一般要2~6分钟，并且没有进度条

4.   **设置全局或本地 Python 版本**

     >   二选一

     ```bash
     # 设置全局默认 Python（系统所有终端生效）
     pyenv global 3.10.19 
     
     # 设置某个项目目录使用（只对当前目录有效）
     cd /path/to/robot-dog
     pyenv local 3.10.19
     ```

     检查 Python 版本

     ```bash
     python --version
     # 或
     python3 --version
     ```

5.    通过虚拟环境来隔离（可选）

     ```bash
     pyenv virtualenv 3.10.19 myenv  # 创建虚拟环境
     pyenv activate myenv            # 启用虚拟环境
     pyenv deactivate                # 退出虚拟环境
     ```

     


### WSL 镜像网络模式

让 **局域网内任意设备**（手机、平板、另一台电脑）通过
`http://Windows局域网IP:端口` 直接访问 **WSL2** 里运行的服务（Flask、Node、Docker、SSH …）。

1. **下载WSL2的Ubuntu22.04**

   >   因为自带python3.10，不用再配环境

   1.   点击开始菜单，搜索 `microsoft store`

   2.   下载 Ubuntu22.04

        ![下载Ubuntu22.04](./docs/文档图片/README//下载Ubuntu22.04.png)

    3.   （可选）切换为默认实例

         >   切换后可以直接输入 `wsl` 打开

         ```bash
         wsl -l -v                      # 查看当前实例（带*的为默认实例）
         wsl --setdefault Ubuntu-22.04 # 设置默认实例为22.04
         wsl -l -v                      # 查看是否设置成功
         
         wsl -d Ubuntu-22.04            # 直接打开22.04
         wsl                            # 打开默认实例
         ```
         
         ​     

2. **切换为镜像网络模式**

   1. 点击开始菜单，搜索 `wsl settings`
   2. 切换镜像网络模式![WSL2切换为镜像网络模式](./docs/文档图片/README/WSL2切换为镜像网络模式.png)

   > 说明：
   > `mirrored` 模式下，WSL2 拿到的 IP == Windows 局域网 IP，**无需再手动端口转发**。

3. **重启 WSL**

    ```powershell
    wsl --shutdown      # 完全关闭所有子系统
    wsl -d ubuntu-22.04 # 重新进入22.04实例
    ```



## 连接机器狗

### 配置网络

#### 1. AP（热点）直连

1. **找到机械狗遥控器并连接上遥控器上写的机器狗自身的 WIFI**

2. **ssh远程登陆机器狗**
   
    ```bash
    ssh firefly@192.168.234.1  # ip是固定的，用户名和密码默认是：firefly
    ```
3. **查看本地 IP**

     ```bash
    ip addr # ip a
    ```

    ![1762423310618](https://youke1.picui.cn/s1/2025/11/06/690cae043f51d.png)

    > 这是机械狗 WIFI 分配给本地的局域网 IP

4. **修改 SDK 配置文件**

   ```bash
   sudo vim /opt/export/config/sdk_config.yaml
   ```

   ![1762423774051](https://youke1.picui.cn/s1/2025/11/06/690cae232ebae.png)
   
   ```bash
   > `target_ip` 修改为本地 IP，端口一般不用改
   ```
   
   

#### 2. WIFI 局域网连接

1. **按照 [AP 直连步骤 1、2](####1. AP（热点）直连)，远程登陆**

2. **机械狗连接 WIFI**

   ```bash
   # 查看附近网络
   sudo nmcli device wifi list
   
   # 连接WIFI网络
   sudo nmcli device wifi connect WIFI名称 password WIFI密码 ifname wlan0
   
   # 关闭网络清除服务 (防止每次关机后都清除网络)
   sudo systemctl stop networkmanager-cleanup.service
   sudo systemctl disable networkmanager-cleanup.service
   
   # 开启自动连接
   sudo nmcli connection modify WIFI名称 connection.autoconnect yes
   ```

   ![1762437011780](https://youke1.picui.cn/s1/2025/11/06/690cae4408870.png)
   
   > 成功连接 WIFI 后，重新远程登录，这里会显示机械狗在局域网中的 IP
   
3. **本机连上 WIFI 后，可以使用机械狗局域网 IP 进行 ssh 远程登录**

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
   echo "start motion control" # 启动运动控制
   
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

5. **参照 [AP 直连步骤 4](####1. AP（热点）直连)，修改 SDK 配置文件**

6. **重启运控**

    ```bash
    robot-launch restart 4
    ```
    
    > 注意：在重启运控之前必须让机械狗先卧倒，否则会急停



## 运行代码

```bash
python3 ./src/python/dance_1dog.py 
```



## 其他

.so 库文件是目前是单独放到一个git仓库中

```bash
# 克隆远程仓库到临时目录
git clone <远程仓库地址> /tmp/so_repo

# 移动需要的 .so 文件到目标目录
mkdir -p lib/so
cp /tmp/so_repo/*.so lib/so/

# 可选：删除临时仓库
rm -rf /tmp/so_repo

```
