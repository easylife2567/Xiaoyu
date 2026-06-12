const globalForPrisma = globalThis

export async function getPrismaClient() {
  if (globalForPrisma.__xiaoyuPrisma) {
    return globalForPrisma.__xiaoyuPrisma
  }

  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__xiaoyuPrisma = prisma
  }

  return prisma
}
