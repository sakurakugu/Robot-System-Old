import { getMainDatabase, initMainDatabase, ProjectDatabase } from './index';
import { PATHS, CONFIG } from '../config';
import fs from 'fs';

async function init() {
  console.log('初始化数据库中...');
  console.log(`数据目录: ${CONFIG.DATA_DIR}`);
  console.log(`主数据库: ${PATHS.mainDb}`);
  console.log(`工程目录: ${PATHS.projectsDir}`);

  // 确保必要的目录存在
  const dirs = [
    CONFIG.DATA_DIR,
    PATHS.configDir,
    PATHS.logsDir,
    PATHS.cacheDir,
    PATHS.projectsDir,
  ];

  let flag = false
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      if (!flag){
        console.log('正在创建不存在的目录...');
        flag = true;
      }
      console.log(`创建目录: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 初始化主数据库
  await initMainDatabase();
  console.log('主数据库初始化成功！');

  // 测试查询
  const db = await getMainDatabase();
  const users = await db.all('SELECT * FROM users');
  console.log('用户:', users);

  const projects = await db.all('SELECT * FROM project_index');
  console.log('工程:', projects);

  console.log('\n数据库初始化完成！');
}

init().catch(console.error);
