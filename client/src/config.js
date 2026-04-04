// 配置模块 - 动态获取服务器地址

// 获取服务器URL
export function getServerUrl() {
  // 优先使用环境变量（生产环境）
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL
  }
  // 开发环境默认使用本地服务器
  return 'http://localhost:3000'
}

export default {
  getServerUrl
}