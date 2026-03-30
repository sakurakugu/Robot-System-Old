import type { Robot, RobotMetadata, RobotStatus } from './types'

export type RawRobot = Partial<Robot> & {
  uuid: string
  status?: string | null
}

export function parseRobotMetadata(metadata: RawRobot['metadata']): RobotMetadata {
  if (!metadata) {
    return {}
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as Record<string, unknown>
      if (parsed && typeof parsed === 'object') {
        return parsed as RobotMetadata
      }
      return {}
    } catch {
      return {}
    }
  }

  return metadata as RobotMetadata
}

export function normalizeRobotTags(tags: RawRobot['tags']): string[] {
  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
  }

  if (typeof tags === 'string' && tags.trim().length > 0) {
    try {
      const parsed = JSON.parse(tags) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      }
    } catch {
      return []
    }
  }

  return []
}

export function normalizeRobotStatus(status?: string | null): RobotStatus {
  if (status === 'online' || status === 'connecting' || status === 'error') {
    return status
  }

  if (status === 'connected') {
    return 'online'
  }

  return 'offline'
}

export function normalizeRobot(rawRobot: RawRobot): Robot {
  const metadata = parseRobotMetadata(rawRobot.metadata)

  return {
    ...rawRobot,
    name: rawRobot.name || '',
    model: rawRobot.model || '',
    version: rawRobot.version || '',
    motion_control_version: rawRobot.motion_control_version || '',
    server_version: rawRobot.server_version || '',
    status: normalizeRobotStatus(rawRobot.status),
    last_connected: rawRobot.last_connected_at || rawRobot.last_connected || null,
    ip: rawRobot.ip ?? null,
    robot_ip: rawRobot.robot_ip ?? metadata.robot_ip ?? null,
    local_ip: rawRobot.local_ip ?? metadata.local_ip ?? null,
    local_port:
      typeof rawRobot.local_port === 'number'
        ? rawRobot.local_port
        : (typeof metadata.local_port === 'number' ? metadata.local_port : 10000),
    group_name: rawRobot.group_name ?? metadata.group_name ?? null,
    tags: normalizeRobotTags(rawRobot.tags),
    battery:
      typeof rawRobot.battery === 'number'
        ? rawRobot.battery
        : (typeof metadata.battery === 'number' ? metadata.battery : null),
    metadata,
  }
}
