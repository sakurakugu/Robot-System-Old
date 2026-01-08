from lib.api import CrazyRobotDog

# 初始化85号狗
dog_85 = CrazyRobotDog(
    name='85',               # 名称，用于日志输出
    robot_ip='192.168.0.85',   # 机器人IP
    local_ip='192.168.0.88', # 本地IP
    local_port=10085          # 本地端口，一般设置为 `10000 + 狗狗编号`
)

dog_89 = CrazyRobotDog(
    name='89',               # 名称，用于日志输出
    robot_ip='192.168.0.89',   # 机器人IP
    local_ip='192.168.0.88', # 本地IP
    local_port=10089          # 本地端口，一般设置为 `10000 + 狗狗编号`
)

# 让狗站立（大约花费4.5秒）
dog_85.stand_up()
dog_89.stand_up()
