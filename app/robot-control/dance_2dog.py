"""
ssh firefly@192.168.234.1  # 默认密码：firefly

sudo vim /opt/export/config/sdk_config.yaml

robot-launch restart 4
"""
# 两条狗跳舞
from lib.api import CrazyRobotDog, execute_concurrently as ec
import time

# 实例化狗1、2
dog1 = CrazyRobotDog(
    name="47",
    robot_ip="192.168.0.85",
    local_port=10085,
)
dog2 = CrazyRobotDog(
    name="131",
    robot_ip="192.168.0.89",
    local_port=10089,
)

# 让狗站起来，如果已经站起来就在写入0
dog1.stand_up(0)
dog2.stand_up(0)

time.sleep(0.8)

# execute_concurrently 并发执行的缩写，如上
# 狗1、2同时执行 nod_up(2)，lambda用于包装函数，传入指针
ec(lambda: dog1.nod_up(2), lambda: dog2.nod_up(2))
ec(lambda: dog1.nod_down(2), lambda: dog2.nod_down(2))
ec(lambda: dog1.max_height(2), lambda: dog2.max_height(2))
ec(lambda: dog1.nod_up(2), lambda: dog2.nod_up(2))

for _ in range(3):
    ec(lambda: dog1.rotate_clockwise(), lambda: dog2.rotate_clockwise())
    ec(lambda: dog1.rotate_counterclockwise(),
       lambda: dog2.rotate_counterclockwise())

ec(lambda: dog1.turn_around(angle=90, direction='cw'),
   lambda: dog2.turn_around(angle=90, direction='ccw'))

time.sleep(0.8)
ec(lambda: dog1.back_flip(), lambda: dog2.back_flip())

for _ in range(8):
    ec(lambda: dog1.rotate_counterclockwise(),
       lambda: dog2.rotate_counterclockwise())
    ec(lambda: dog1.rotate_clockwise(), lambda: dog2.rotate_clockwise())

ec(lambda: dog1.min_height(1), lambda: dog2.min_height(1))
ec(lambda: dog1.max_height(2), lambda: dog2.max_height(2))
ec(lambda: dog1.nod_down(2), lambda: dog2.nod_down(2))

ec(lambda: dog1.jump(), lambda: dog2.jump())

for _ in range(14):
    ec(lambda: dog1.max_height(0.3), lambda: dog2.max_height(0.3))
    ec(lambda: dog1.min_height(0.3), lambda: dog2.min_height(0.3))

ec(lambda: dog1.shake_hand(), lambda: dog2.shake_hand())
time.sleep(1)
ec(lambda: dog1.lean_left(2), lambda: dog2.lean_left(2))
ec(lambda: dog1.lean_right(2), lambda: dog2.lean_right(2))

for _ in range(10):
    ec(lambda: dog1.min_height(0.3), lambda: dog2.min_height(0.3))
    ec(lambda: dog1.max_height(0.3), lambda: dog2.max_height(0.3))

for _ in range(2):
    ec(lambda: dog1.rotate_clockwise(0.5), lambda: dog2.rotate_clockwise(0.5))
    ec(lambda: dog1.rotate_counterclockwise(0.5),
       lambda: dog2.rotate_counterclockwise(0.5))

ec(lambda: dog1.nod_down(2), lambda: dog2.nod_down(2))
ec(lambda: dog1.nod_up(2), lambda: dog2.nod_up(2))
ec(lambda: dog1.min_height(1.5), lambda: dog2.min_height(1.5))
ec(lambda: dog1.nod_down(2), lambda: dog2.nod_down(2))

for _ in range(3):
    ec(lambda: dog1.rotate_counterclockwise(0.5),
       lambda: dog2.rotate_counterclockwise(0.5))
    ec(lambda: dog1.rotate_clockwise(0.5), lambda: dog2.rotate_clockwise(0.5))

ec(lambda: dog1.turn_around(angle=90, direction='ccw'),
   lambda: dog2.turn_around(angle=90, direction='cw'))
time.sleep(1)
ec(lambda: dog1.jump(), lambda: dog2.jump())
time.sleep(0.8)

ec(lambda: dog1.nod_up(2), lambda: dog2.nod_down(2))
ec(lambda: dog1.lean_right(1.5), lambda: dog2.lean_left(1.5))
ec(lambda: dog1.lean_left(1.5), lambda: dog2.lean_right(1.5))
ec(lambda: dog1.attitude_rest(), lambda: dog2.attitude_rest())

ec(lambda: dog1.nod_up(2.5), lambda: dog2.nod_down(2.5))
ec(lambda: dog1.nod_down(2), lambda: dog2.nod_up(2))
ec(lambda: dog1.max_height(2), lambda: dog2.min_height(2))
ec(lambda: dog1.nod_up(2), lambda: dog2.nod_down(2))

for _ in range(8):
    ec(lambda: dog1.rotate_clockwise(0.5),
       lambda: dog2.rotate_counterclockwise(0.5))
    ec(lambda: dog1.rotate_counterclockwise(0.5),
       lambda: dog2.rotate_clockwise(0.5))

for _ in range(8):
    ec(lambda: dog1.max_height(0.3), lambda: dog2.min_height(0.3))
    ec(lambda: dog1.max_height(0.3), lambda: dog2.min_height(0.3))

ec(lambda: dog1.jump(), lambda: dog2.jump())
time.sleep(1)

for _ in range(4):
    ec(lambda: dog1.lean_left(), lambda: dog2.lean_right())
    ec(lambda: dog1.lean_right(), lambda: dog2.lean_left())
    ec(lambda: dog1.rotate_counterclockwise(),
       lambda: dog2.rotate_clockwise())
    ec(lambda: dog1.rotate_clockwise(), lambda: dog2.rotate_counterclockwise())

ec(lambda: dog1.lean_left(), lambda: dog2.lean_right())
ec(lambda: dog1.lean_right(), lambda: dog2.lean_left())
ec(lambda: dog1.nod_up(), lambda: dog2.nod_down())
ec(lambda: dog1.nod_down(), lambda: dog2.nod_up())

ec(lambda: dog1.lean_left(), lambda: dog2.lean_right())
ec(lambda: dog1.lean_right(), lambda: dog2.lean_left())
ec(lambda: dog1.nod_down(), lambda: dog2.nod_up())
ec(lambda: dog1.nod_up(), lambda: dog2.nod_down())

ec(lambda: dog1.lean_left(), lambda: dog2.lean_right())
ec(lambda: dog1.lean_right(), lambda: dog2.lean_left())
ec(lambda: dog1.nod_up(), lambda: dog2.nod_up())
ec(lambda: dog1.nod_down(), lambda: dog2.nod_down())

time.sleep(2)

ec(lambda: dog1.nod_up(2), lambda: dog2.nod_up(2))
ec(lambda: dog1.nod_down(2), lambda: dog2.nod_down(2))
ec(lambda: dog1.max_height(2), lambda: dog2.max_height(2))
ec(lambda: dog1.nod_up(2), lambda: dog2.nod_up(2))

ec(lambda: dog1.shake_hand(), lambda: dog2.shake_hand())
