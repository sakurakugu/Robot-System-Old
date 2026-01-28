# # 使用 Ubuntu 22.04 作为基础镜像（这个下载安装比较慢）
# FROM ubuntu:22.04

# 使用官方 ROS 2 Humble 基础镜像 (基于 Ubuntu 22.04)
# 如果 Docker 使用的镜像网站没有该镜像，就删除镜像，使用官方镜像，或者将上面和下面注释的取消注释，改为官方源
FROM osrf/ros:humble-desktop

# 设置非交互环境和本地化
ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=zh_CN.UTF-8
ENV LC_ALL=zh_CN.UTF-8

# 更新系统并安装基本工具
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    lsb-release \
    software-properties-common \
    git \
    vim \
    x11-apps \
    wget \
    sudo \
    locales \
    python3-pip \
    python3-venv \
    build-essential \
    python-is-python3 \
    && locale-gen zh_CN.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

# 添加 ROS2 Humble 源
# RUN curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.asc | apt-key add - \
#     && sh -c 'echo "deb http://packages.ros.org/ros2/ubuntu $(lsb_release -cs) main" > /etc/apt/sources.list.d/ros2.list'

# # 安装 ROS2 Humble 桌面版和 Python 工具
# RUN apt-get update && apt-get install -y \
#     ros-humble-desktop \
#     python3-colcon-common-extensions \
#     python3-argcomplete \
#     && rm -rf /var/lib/apt/lists/*

# 自动设置 ROS2 环境
SHELL ["/bin/bash", "-c"]
RUN echo "source /opt/ros/humble/setup.bash" >> /etc/bash.bashrc

# 安装 VSCode Remote 依赖工具（用于 Remote-Containers 插件）
RUN apt-get update && apt-get install -y \
    sudo \
    git \
    procps \
    && rm -rf /var/lib/apt/lists/*

# 改成 vim 而不是难用的 nano (i插入; Esc、:wq写入; Esc、:q/:q! 退出/强制退出)
RUN git config --global core.editor vim
RUN git config --global core.sshCommand "/mnt/c/Windows/System32/OpenSSH/ssh.exe"

# 设置环境变量
# 将自定义库路径加入 PYTHONPATH，这样在任何地方都能 import SDK
# 假设 workspace 映射到 /workspaces/robot-dog (VS Code 默认行为)
ENV PYTHONPATH="${PYTHONPATH}:/workspaces/robot-dog/src/python/lib"
# 让 Python 可以自动找到 .so 库文件
ENV LD_LIBRARY_PATH="${LD_LIBRARY_PATH}:/workspaces/robot-dog/src/python/lib/so/x86_64"

# 默认启动 bash
CMD ["bash"]
