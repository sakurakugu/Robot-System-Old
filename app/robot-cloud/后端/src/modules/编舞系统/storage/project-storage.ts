import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../../../core/logger';
import type {
  ChoreoProject,
  CustomAction,
  TimelineData,
} from '../types';

type 导出文件 = {
  fullPath: string;
  relativePath: string;
};

export type 项目文件节点 = {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: 项目文件节点[];
  size?: number;
  modifiedTime?: Date;
};

const APP_NAME = 'RobotDogChoreo';

const 获取默认数据目录 = (): string => {
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, APP_NAME);
  }

  if (os.platform() === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }

  return path.join(os.homedir(), '.local', 'share', APP_NAME);
};

const 获取默认项目目录 = (): string => {
  return path.join(os.homedir(), 'Documents', `${APP_NAME}Projects`);
};

const 异步文件系统 = fs.promises;

export class 编舞项目存储 {
  constructor(
    private readonly 数据目录: string = process.env.CHOREO_DATA_DIR || 获取默认数据目录(),
    private readonly 项目目录: string = process.env.CHOREO_PROJECTS_DIR || 获取默认项目目录(),
  ) {}

  获取项目根目录(): string {
    return this.项目目录;
  }

  生成项目目录路径(projectName: string, projectUuid: string): string {
    const folderName = `${projectName.replace(/[<>:"/\\|?*]/g, '_')}_${projectUuid.substring(0, 8)}`;
    return path.join(this.项目目录, folderName);
  }

  async 初始化(): Promise<void> {
    await Promise.all(
      [this.数据目录, this.项目目录].map(async (dir) => {
        await 异步文件系统.mkdir(dir, { recursive: true });
        logger.info(`确保目录存在: ${dir}`);
      }),
    );
  }

  async 加载项目索引(): Promise<ChoreoProject[]> {
    const indexPath = path.join(this.数据目录, 'project-index.json');

    try {
      const raw = await 异步文件系统.readFile(indexPath, 'utf-8');
      const data = JSON.parse(raw);
      const projects = Array.isArray(data) ? data as ChoreoProject[] : [];
      logger.info(`加载了 ${projects.length} 个编舞项目`);
      return projects;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return [];
      }

      logger.error('加载项目索引失败', error as Error);
      return [];
    }
  }

  async 保存项目索引(projects: Iterable<ChoreoProject>): Promise<void> {
    const indexPath = path.join(this.数据目录, 'project-index.json');
    await 异步文件系统.writeFile(
      indexPath,
      JSON.stringify(Array.from(projects), null, 2),
    );
  }

  async 创建项目目录(project: ChoreoProject, 默认时间轴: TimelineData): Promise<void> {
    await Promise.all([
      异步文件系统.mkdir(project.folder_path, { recursive: true }),
      异步文件系统.mkdir(path.join(project.folder_path, 'audio'), { recursive: true }),
      异步文件系统.mkdir(path.join(project.folder_path, 'exports'), { recursive: true }),
      异步文件系统.mkdir(path.join(project.folder_path, 'backups'), { recursive: true }),
    ]);

    await Promise.all([
      this.保存项目元数据(project),
      this.保存时间轴(project, 默认时间轴),
    ]);
  }

  async 保存项目元数据(project: ChoreoProject): Promise<void> {
    await 异步文件系统.writeFile(
      path.join(project.folder_path, 'project.json'),
      JSON.stringify(project, null, 2),
    );
  }

  async 删除项目目录(project: ChoreoProject): Promise<void> {
    await 异步文件系统.rm(project.folder_path, { recursive: true, force: true });
  }

  async 读取时间轴(project: ChoreoProject, fallbackValue: TimelineData): Promise<TimelineData> {
    const timelinePath = path.join(project.folder_path, 'timeline.json');

    try {
      const raw = await 异步文件系统.readFile(timelinePath, 'utf-8');
      return JSON.parse(raw) as TimelineData;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return fallbackValue;
      }

      throw new Error('时间轴数据损坏');
    }
  }

  async 保存时间轴(project: ChoreoProject, timelineData: TimelineData): Promise<void> {
    await 异步文件系统.writeFile(
      path.join(project.folder_path, 'timeline.json'),
      JSON.stringify(timelineData, null, 2),
    );
  }

  async 读取自定义动作(project: ChoreoProject): Promise<CustomAction[]> {
    return this.读取JSON文件<CustomAction[]>(
      path.join(project.folder_path, 'custom-actions.json'),
      [],
    );
  }

  async 保存自定义动作列表(project: ChoreoProject, actions: CustomAction[]): Promise<void> {
    await 异步文件系统.writeFile(
      path.join(project.folder_path, 'custom-actions.json'),
      JSON.stringify(actions, null, 2),
    );
  }

  async 获取音频路径(project: ChoreoProject, filename: string): Promise<string> {
    const audioPath = this.解析音频路径(project, filename);

    try {
      await 异步文件系统.access(audioPath, fs.constants.F_OK);
      return audioPath;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new Error('音频文件不存在');
      }

      throw error;
    }
  }

  async 保存音频文件(project: ChoreoProject, filename: string, buffer: Buffer): Promise<string> {
    const audioDir = path.join(project.folder_path, 'audio');
    await 异步文件系统.mkdir(audioDir, { recursive: true });

    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    const safeFilename = `${basename}_${Date.now()}${ext}`;
    const audioPath = this.解析音频路径(project, safeFilename);

    await 异步文件系统.writeFile(audioPath, new Uint8Array(buffer));
    return safeFilename;
  }

  async 列出音频文件(project: ChoreoProject): Promise<string[]> {
    const audioDir = path.join(project.folder_path, 'audio');

    try {
      const files = await 异步文件系统.readdir(audioDir);
      return files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext);
      });
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  async 删除音频文件(project: ChoreoProject, filename: string): Promise<void> {
    const audioPath = this.解析音频路径(project, filename);

    try {
      await 异步文件系统.unlink(audioPath);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new Error('音频文件不存在');
      }

      throw error;
    }
  }

  async 读取项目文件树(project: ChoreoProject): Promise<项目文件节点[]> {
    return this.读取目录(project.folder_path);
  }

  async 读取项目文件(project: ChoreoProject, filePath: string): Promise<string> {
    const fullPath = this.解析项目内路径(project, filePath);

    try {
      const stat = await 异步文件系统.stat(fullPath);
      if (stat.isDirectory()) {
        throw new Error('无法读取文件夹内容');
      }

      return await 异步文件系统.readFile(fullPath, 'utf-8');
    } catch (error: any) {
      if (error?.message === '无法读取文件夹内容') {
        throw error;
      }

      if (error?.code === 'ENOENT') {
        throw new Error('文件不存在');
      }

      throw error;
    }
  }

  async 保存项目文件(project: ChoreoProject, filePath: string, content: string): Promise<void> {
    const fullPath = this.解析项目内路径(project, filePath);

    await 异步文件系统.mkdir(path.dirname(fullPath), { recursive: true });
    await 异步文件系统.writeFile(fullPath, content, 'utf-8');
  }

  async 删除项目文件(project: ChoreoProject, filePath: string): Promise<void> {
    const fullPath = this.解析项目内路径(project, filePath);

    try {
      const stat = await 异步文件系统.stat(fullPath);
      if (stat.isDirectory()) {
        await 异步文件系统.rm(fullPath, { recursive: true, force: true });
      } else {
        await 异步文件系统.unlink(fullPath);
      }
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new Error('文件不存在');
      }

      throw error;
    }
  }

  async 准备项目导出(project: ChoreoProject): Promise<{
    exportPath: string;
    fileName: string;
    exportFiles: 导出文件[];
  }> {
    const exportsDir = path.join(project.folder_path, 'exports');
    await 异步文件系统.mkdir(exportsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `${project.name}_${timestamp}.hhzip`;
    const exportPath = path.join(exportsDir, fileName);
    const exportFiles = await this.收集导出文件(project.folder_path);

    return {
      exportPath,
      fileName,
      exportFiles,
    };
  }

  async 查找项目元文件(dir: string): Promise<string | null> {
    const items = await 异步文件系统.readdir(dir, { withFileTypes: true });

    if (items.some((item) => item.isFile() && item.name === 'project.json')) {
      return path.join(dir, 'project.json');
    }

    const subdirs = items
      .filter((item) => item.isDirectory() && !item.name.startsWith('.'))
      .map((item) => item.name);

    if (subdirs.length === 1) {
      return this.查找项目元文件(path.join(dir, subdirs[0]));
    }

    return null;
  }

  async 读取JSON对象<T>(filePath: string): Promise<T> {
    const raw = await 异步文件系统.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  }

  async 移动目录(sourcePath: string, targetPath: string): Promise<void> {
    await 异步文件系统.rename(sourcePath, targetPath);
  }

  async 删除目录(targetPath: string): Promise<void> {
    await 异步文件系统.rm(targetPath, { recursive: true, force: true });
  }

  private 解析项目内路径(project: ChoreoProject, relativePath: string): string {
    return this.解析目录内路径(project.folder_path, relativePath);
  }

  private 解析音频路径(project: ChoreoProject, filename: string): string {
    return this.解析目录内路径(path.join(project.folder_path, 'audio'), filename);
  }

  private 解析目录内路径(rootDir: string, relativePath: string): string {
    if (!relativePath) {
      throw new Error('文件路径是必需的');
    }

    const 根目录 = path.resolve(rootDir);
    const 目标路径 = path.resolve(根目录, relativePath);
    const 允许前缀 = `${根目录}${path.sep}`;

    if (目标路径 !== 根目录 && !目标路径.startsWith(允许前缀)) {
      throw new Error('非法的文件路径');
    }

    return 目标路径;
  }

  private async 读取JSON文件<T>(filePath: string, fallbackValue: T): Promise<T> {
    try {
      const raw = await 异步文件系统.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return fallbackValue;
    }
  }

  private async 收集导出文件(
    dirPath: string,
    basePath: string = '',
  ): Promise<导出文件[]> {
    const entries = await 异步文件系统.readdir(dirPath, { withFileTypes: true });
    const result: 导出文件[] = [];

    for (const entry of entries) {
      if (entry.name === 'exports' || entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        result.push(...await this.收集导出文件(fullPath, relativePath));
      } else {
        result.push({ fullPath, relativePath });
      }
    }

    return result;
  }

  private async 读取目录(
    dirPath: string,
    relativePath: string = '',
  ): Promise<项目文件节点[]> {
    try {
      const entries = await 异步文件系统.readdir(dirPath, { withFileTypes: true });
      const items = await Promise.all(
        entries
          .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'backups')
          .map(async (entry) => {
            const fullPath = path.join(dirPath, entry.name);
            const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

            if (entry.isDirectory()) {
              return {
                name: entry.name,
                path: relPath,
                isDirectory: true,
                children: await this.读取目录(fullPath, relPath),
              } satisfies 项目文件节点;
            }

            const stat = await 异步文件系统.stat(fullPath);
            return {
              name: entry.name,
              path: relPath,
              isDirectory: false,
              size: stat.size,
              modifiedTime: stat.mtime,
            } satisfies 项目文件节点;
          }),
      );

      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return items;
    } catch (error) {
      logger.error(`读取目录失败: ${dirPath}`, error as Error);
      return [];
    }
  }
}
