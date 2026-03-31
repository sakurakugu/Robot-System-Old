# 机器狗 AI 入门教程

这部分文档面向已经有基础 Python 能力的中小学生，目标不是一次性讲清所有原理，而是用最短路径带学生跑通一个完整项目：

`输入一句话 -> AI 理解 -> Python CLI 调用 -> 机器狗执行动作`

当前先提供教程规划，后续可以继续按这个规划逐章展开。

## 文档列表

1. [1. 教程总规划.md](D:\elric\Code\Repos\robot-system\docs\教程\1. 教程总规划.md)
2. [2. 第1章 我们要做什么.md](D:\elric\Code\Repos\robot-system\docs\教程\2. 第1章 我们要做什么.md)
3. [3. 第2章 先用扣子做一个机器狗助手.md](D:\elric\Code\Repos\robot-system\docs\教程\3. 第2章 先用扣子做一个机器狗助手.md)
4. [4. 第3章 用 Python 写一个 AI 命令行助手.md](D:\elric\Code\Repos\robot-system\docs\教程\4. 第3章 用 Python 写一个 AI 命令行助手.md)
5. [5. 第4章 用 Python 控制机器狗.md](D:\elric\Code\Repos\robot-system\docs\教程\5. 第4章 用 Python 控制机器狗.md)
6. [6. 第5章 让 AI 来控制机器狗.md](D:\elric\Code\Repos\robot-system\docs\教程\6. 第5章 让 AI 来控制机器狗.md)
7. [7. 第6章 做一个自己的小项目.md](D:\elric\Code\Repos\robot-system\docs\教程\7. 第6章 做一个自己的小项目.md)
8. [8. 教学实施建议.md](D:\elric\Code\Repos\robot-system\docs\教程\8. 教学实施建议.md)
9. [9. 老师讲课稿.md](D:\elric\Code\Repos\robot-system\docs\教程\9. 老师讲课稿.md)
10. [10. 第2章课堂版 扣子操作指引.md](D:\elric\Code\Repos\robot-system\docs\教程\10.%20第2章课堂版%20扣子操作指引.md)
11. [11. 学生练习单.md](D:\elric\Code\Repos\robot-system\docs\教程\11.%20学生练习单.md)
12. [12. 课堂口令清单.md](D:\elric\Code\Repos\robot-system\docs\教程\12.%20课堂口令清单.md)
13. [13. 第3章课堂版 Python调用AI操作指引.md](D:\elric\Code\Repos\robot-system\docs\教程\13.%20第3章课堂版%20Python调用AI操作指引.md)
14. [14. 第4章课堂版 控制机器狗操作指引.md](D:\elric\Code\Repos\robot-system\docs\教程\14.%20第4章课堂版%20控制机器狗操作指引.md)
15. [15. 第5章课堂版 AI控制机器狗操作指引.md](D:\elric\Code\Repos\robot-system\docs\教程\15.%20第5章课堂版%20AI控制机器狗操作指引.md)

## 教程目标

- 先让学生知道 AI 不只是聊天，还能把自然语言变成动作指令
- 先用扣子建立直觉，再切到 Python 自己写代码
- 先单独打通 AI，再单独打通机器狗 SDK，最后再合并
- 只追求最小可运行版本，不追求复杂 Agent 和高自由度控制

## 最终效果

学生在命令行输入一句话，例如：

```text
让小狗站起来，然后向前走两步
```

程序完成以下流程：

1. 调用 AI，把自然语言转换成动作列表
2. 解析动作列表
3. 调用机器狗 SDK
4. 让机器狗按顺序执行动作

## 编写原则

- 每一章都要能独立验证
- 每一章都要有“本章完成效果”
- 示例代码尽量短，避免学生一开始看到太长代码
- 动作集合保持精简，优先保证成功率
- 先跑通，再解释原理
