# stabilize-candidate-pool-fixture-supply

让候选池 fixture 供给在"今日文件缺失"时不再开天窗:服务侧按窗口回退到最近一份并标 staleSourceDate,工程侧加一条 dev 脚本以最近一份为模板平移生成今日 fixture。
