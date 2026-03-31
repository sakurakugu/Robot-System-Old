import archiver from 'archiver';
import extractZip from 'extract-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';
import { logger } from '../../core/logger';
import { 编舞项目存储, type 项目文件节点 } from './storage/project-storage';
import type { ChoreoProject } from './types';

type 项目获取器 = (projectUuid: string) => ChoreoProject;
type 项目索引保存器 = () => Promise<void>;
type 项目注册器 = (project: ChoreoProject) => void;
type 项目ID生成器 = () => string;

/**
 * 编舞项目文件与资源服务
 * 负责项目文件、音频资源以及导入导出相关操作
 */
export class 编舞项目文件资源服务 {
  constructor(
    private readonly 获取项目记录: 项目获取器,
    private readonly 存储: 编舞项目存储,
    private readonly 保存项目索引: 项目索引保存器,
    private readonly 注册项目: 项目注册器,
    private readonly 生成项目ID: 项目ID生成器 = uuidv7,
  ) {}

  async getProjectFiles(projectUuid: string): Promise<项目文件节点[]> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.读取项目文件树(project);
  }

  async getFileContent(projectUuid: string, filePath: string): Promise<string> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.读取项目文件(project, filePath);
  }

  async saveFileContent(projectUuid: string, filePath: string, content: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);
    await this.存储.保存项目文件(project, filePath, content);
    await this.刷新项目更新时间(project);
  }

  async deleteFile(projectUuid: string, filePath: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);
    await this.存储.删除项目文件(project, filePath);
    await this.刷新项目更新时间(project);
  }

  getProjectFolder(projectUuid: string): string {
    return this.获取项目记录(projectUuid).folder_path;
  }

  async getAudioPath(projectUuid: string, filename: string): Promise<string> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.获取音频路径(project, filename);
  }

  async saveAudioFile(projectUuid: string, filename: string, buffer: Buffer): Promise<string> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.保存音频文件(project, filename, buffer);
  }

  async listAudioFiles(projectUuid: string): Promise<string[]> {
    const project = this.获取项目记录(projectUuid);
    return this.存储.列出音频文件(project);
  }

  async deleteAudioFile(projectUuid: string, filename: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);
    await this.存储.删除音频文件(project, filename);
  }

  async saveProject(projectUuid: string): Promise<void> {
    const project = this.获取项目记录(projectUuid);
    project.updated_at = new Date().toISOString();
    await this.存储.保存项目元数据(project);
    await this.保存项目索引();
    logger.info(`保存项目: ${project.name}`, { uuid: projectUuid });
  }

  async exportProject(projectUuid: string): Promise<{ exportPath: string; fileName: string }> {
    const project = this.获取项目记录(projectUuid);
    const { exportPath, fileName, exportFiles } = await this.存储.准备项目导出(project);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(exportPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        logger.info(`项目已导出: ${fileName}`, {
          uuid: projectUuid,
          size: archive.pointer(),
        });
        resolve({ exportPath, fileName });
      });

      archive.on('error', (error) => {
        reject(error);
      });

      archive.pipe(output);
      for (const file of exportFiles) {
        archive.file(file.fullPath, { name: file.relativePath });
      }
      archive.finalize();
    });
  }

  async importProject(filePath: string, _originalName: string): Promise<ChoreoProject> {
    const tempExtractDir = path.join(os.tmpdir(), 'robot-system-extracts', `extract_${Date.now()}`);

    try {
      await extractZip(filePath, { dir: tempExtractDir });

      const projectJsonPath = await this.存储.查找项目元文件(tempExtractDir);
      if (!projectJsonPath) {
        throw new Error('压缩包中未找到 project.json 文件');
      }

      const projectRootDir = path.dirname(projectJsonPath);
      const projectMeta = await this.存储.读取JSON对象<Partial<ChoreoProject>>(projectJsonPath);
      const 项目名称 = projectMeta.name;
      if (!项目名称) {
        throw new Error('project.json 格式不正确，缺少 name 字段');
      }

      const newUuid = this.生成项目ID();
      const targetPath = this.存储.生成项目目录路径(项目名称, newUuid);
      await this.存储.移动目录(projectRootDir, targetPath);

      const now = new Date().toISOString();
      const project: ChoreoProject = {
        uuid: newUuid,
        name: 项目名称,
        description: projectMeta.description || '',
        folder_path: targetPath,
        created_at: projectMeta.created_at || now,
        updated_at: now,
      };

      await this.存储.保存项目元数据(project);
      this.注册项目(project);
      await this.保存项目索引();

      logger.info(`导入项目成功: ${project.name}`, { uuid: newUuid });
      return project;
    } finally {
      await this.存储.删除目录(tempExtractDir);
    }
  }

  private async 刷新项目更新时间(project: ChoreoProject): Promise<void> {
    project.updated_at = new Date().toISOString();
    await this.保存项目索引();
  }
}

export default 编舞项目文件资源服务;
