// Helper to register routes on both /api/* and /* paths for Cloud Functions compatibility
export function registerRoute(fastify: any, method: string, path: string, handler: any) {
  const apiPath = path.startsWith('/api') ? path : `/api${path}`
  const basePath = path.startsWith('/api') ? path.substring(4) : path
  
  // Register on both paths
  fastify[method.toLowerCase()](apiPath, handler)
  fastify[method.toLowerCase()](basePath, handler)
}

export function registerRoutes(fastify: any) {
  return {
    get: (path: string, handler: any) => registerRoute(fastify, 'get', path, handler),
    post: (path: string, handler: any) => registerRoute(fastify, 'post', path, handler),
    put: (path: string, handler: any) => registerRoute(fastify, 'put', path, handler),
    delete: (path: string, handler: any) => registerRoute(fastify, 'delete', path, handler),
    patch: (path: string, handler: any) => registerRoute(fastify, 'patch', path, handler),
  }
}

module.exports = { registerRoute, registerRoutes }
export {}