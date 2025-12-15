from api import CrazyRobotDog

dog_131 = CrazyRobotDog(
    name='131',
    robot_ip='192.168.0.2',
    local_ip='192.168.0.214',
    local_port=10131
)

dog_131.stand_up()