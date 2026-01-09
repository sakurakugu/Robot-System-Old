from lib.api import CrazyRobotDog

# 初始化131号狗
dog_131 = CrazyRobotDog(
    name='131',               # 名称，用于日志输出
    robot_ip='192.168.0.2',   # 机器人IP
    local_port=10131          # 本地端口，一般设置为 `10000 + 狗狗编号`
)

# 让狗站立（大约花费4.5秒）
dog_131.stand_up()