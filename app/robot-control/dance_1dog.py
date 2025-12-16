# 一条狗跳舞
from lib.api import CrazyRobotDog
import time

DOGS_CONFIG = {
    "131": ("192.168.1.110", 10131),
    "47": ("192.168.1.116", 10047),
}

LOCAL_IP = "192.168.1.105"

dog1 = CrazyRobotDog(
    name="131",
    robot_ip=DOGS_CONFIG["131"][0],
    local_ip=LOCAL_IP,
    local_port=DOGS_CONFIG["131"][1],
)

dog1.stand_up(0)
time.sleep(0.8)

dog1.nod_up(2)
dog1.nod_down(2)
dog1.max_height(2)
dog1.nod_up(2)

for _ in range(3):
    dog1.rotate_clockwise()
    dog1.rotate_counterclockwise()

dog1.turn_around(angle=90)
time.sleep(0.8)
dog1.back_flip()

for _ in range(8):
    dog1.rotate_counterclockwise()
    dog1.rotate_clockwise()

dog1.min_height(1)
dog1.max_height(2)
dog1.nod_down(2)

dog1.jump()

for _ in range(14):
    dog1.max_height(0.3)
    dog1.min_height(0.3)

dog1.shake_hand()
time.sleep(1)
dog1.lean_left(2)
dog1.lean_right(2)

for _ in range(10):
    dog1.min_height(0.3)
    dog1.max_height(0.3)

for _ in range(2):
    dog1.rotate_clockwise(0.5)
    dog1.rotate_counterclockwise(0.5)

dog1.nod_down(2)
dog1.nod_up(2)
dog1.min_height(1.5)
dog1.nod_down(2)

for _ in range(3):
    dog1.rotate_counterclockwise(0.5)
    dog1.rotate_clockwise(0.5)

dog1.turn_around(angle=90, direction='ccw')
time.sleep(1)
dog1.jump()
time.sleep(0.8)

dog1.nod_up(2)
dog1.lean_right(1.5)
dog1.lean_left(1.5)
dog1.attitude_rest()

dog1.nod_up(2.5)
dog1.nod_down(2)
dog1.max_height(2)
dog1.nod_up(2)

for _ in range(8):
    dog1.rotate_clockwise(0.5)
    dog1.rotate_counterclockwise(0.5)

for _ in range(8):
    dog1.max_height(0.3)
    dog1.min_height(0.3)

dog1.jump()
time.sleep(1)

for _ in range(4):
    dog1.lean_left()
    dog1.lean_right()
    dog1.rotate_counterclockwise()
    dog1.rotate_clockwise()

dog1.lean_left()
dog1.lean_right()
dog1.nod_up()
dog1.nod_down()

dog1.lean_left()
dog1.lean_right()
dog1.nod_down()
dog1.nod_up()

dog1.lean_left()
dog1.lean_right()
dog1.nod_up()
dog1.nod_down()

time.sleep(2)

dog1.nod_up(2)
dog1.nod_down(2)
dog1.max_height(2)
dog1.nod_up(2)

dog1.shake_hand()
